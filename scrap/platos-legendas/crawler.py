# docs/scrap/platos-legendas/crawler.py
import asyncio
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from playwright.async_api import async_playwright, Page, BrowserContext, Locator
from utils import (
    to_slug,
    build_output_path,
    format_md,
    clean_subtitle,
    extract_video_id,
    pick_transcript_source,
    normalize_protocol_relative_url,
)

SESSION_FILE = Path("session.json")
OUTPUT_DIR = Path("output")
ERRORS_LOG = Path("errors.log")
NO_TRANSCRIPT_LOG = Path("sem_legenda.log")
# Verificação ao vivo (Task 2) mostrou que "disciplina/{matricula}" sozinho é a
# página do CURSO (lista todas as disciplinas em abas/tabela) e não tem
# accordion de módulos/aulas. A URL real de conteúdo de uma disciplina segue o
# padrão "disciplina/conteudo/{matricula}/{course_card_id}/{id}" — o valor
# abaixo aponta para "APIs de IA Generativa e Prompt Engineering", confirmada
# com 7 módulos / 28 aulas (4,5,4,4,4,5,2), batendo com a descoberta manual.
DISCIPLINA_URL = "https://infoprod.platosedu.io/v2/lms/aluno/disciplina/conteudo/14082629/1083538/3867"
# O <title> da página é estático ("Ambiente Virtual de Aprendizagem") e não
# há breadcrumb com o nome real da disciplina confirmado na descoberta de
# seletores — por isso o nome usado nos paths de saída é fixo, derivado do
# ID da URL, em vez de extraído do DOM.
DISCIPLINA_NOME = "curso-14082629"

MODULE_NAME_RE = re.compile(r"^Módulo \d+$")


def _require_session() -> None:
    if not SESSION_FILE.exists():
        print("ERRO: session.json não encontrado. Execute: python login.py")
        sys.exit(1)


def _log_error(message: str) -> None:
    with ERRORS_LOG.open("a", encoding="utf-8") as f:
        f.write(message + "\n")
    print(f"  ✗ {message}")


async def _dismiss_overlays(page: Page) -> None:
    """Fecha os overlays chakra-portal que interceptam cliques no accordion/aulas:
    o modal 'Avalie nossa disciplina' e o tour de produto. Nenhum dos dois é
    garantido presente uma única vez por sessão — o modal de avaliação foi
    observado reaparecendo NO MEIO da execução (visto ao vivo: aulas #1-12 do
    Módulo 01-03 extraídas com sucesso, e a partir da aula #13 todo clique
    passou a falhar com "chakra-modal__content-container ... intercepts pointer
    events", até a conexão do browser cair). Por isso esta função precisa ser
    chamada antes de CADA tentativa de clique arriscado (expandir módulo, abrir
    aula), não só uma vez no começo do main(). A ordem importa: quando os dois
    overlays aparecem juntos, o modal de avaliação fica por cima e bloqueia o
    próprio botão "Fechar tour" — fechar o modal primeiro e o tour depois evita
    esse deadlock (confirmado ao vivo).
    """
    try:
        modal_close_button = page.get_by_test_id("modal-close-button")
        await modal_close_button.first.wait_for(state="visible", timeout=2000)
        await modal_close_button.first.click()
        await page.wait_for_timeout(300)
    except Exception:
        pass

    try:
        tour_close_button = page.get_by_label("Fechar tour")
        await tour_close_button.wait_for(state="visible", timeout=2000)
        await tour_close_button.click()
        await page.wait_for_timeout(300)
    except Exception:
        pass


async def _ensure_module_expanded(page: Page, header: Locator) -> Locator:
    """Garante que o accordion do módulo (dado o locator do seu header h3) esteja
    expandido, clicando no botão ancestral se `aria-expanded` não for "true".
    Retorna o locator do botão ancestral, para os chamadores que precisam dele
    (ex.: ler `aria-controls` para achar o painel de aulas)."""
    button = header.locator("xpath=ancestor::button[1]")
    if await button.get_attribute("aria-expanded") != "true":
        await button.click()
        await page.wait_for_timeout(300)
    return button


@dataclass
class Lesson:
    module_index: int
    module_name: str
    lesson_index: int
    lesson_name: str
    content_id: str


async def discover_course_structure(page: Page) -> list[Lesson]:
    """Descobre módulos (título 'Módulo NN') e suas aulas na sidebar em accordion."""
    lessons: list[Lesson] = []

    module_headers = page.locator("h3.chakra-text").filter(has_text=MODULE_NAME_RE)
    module_count = await module_headers.count()

    for module_idx in range(module_count):
        header = module_headers.nth(module_idx)
        module_name = (await header.inner_text()).strip()

        button = await _ensure_module_expanded(page, header)

        panel_id = await button.get_attribute("aria-controls")
        panel = page.locator(f'[id="{panel_id}"]')
        rows = panel.locator('[data-testid^="sidebar-menu-item-"]')
        row_count = await rows.count()

        for lesson_idx in range(row_count):
            row = rows.nth(lesson_idx)
            testid = await row.get_attribute("data-testid")
            content_id = testid.replace("sidebar-menu-item-", "")

            h4s = row.locator("h4")
            h4_count = await h4s.count()
            if h4_count >= 2:
                lesson_name = (await h4s.nth(1).inner_text()).strip()
            elif h4_count == 1:
                lesson_name = (await h4s.nth(0).inner_text()).strip()
            else:
                lesson_name = f"Aula {lesson_idx + 1}"

            lessons.append(
                Lesson(
                    module_index=module_idx + 1,
                    module_name=module_name,
                    lesson_index=lesson_idx + 1,
                    lesson_name=lesson_name,
                    content_id=content_id,
                )
            )

    return lessons


async def open_lesson_and_get_video_id(page: Page, lesson: "Lesson") -> str | None:
    """Clica na aula na sidebar e extrai o video_id do iframe da mdstrm que aparece."""
    # O accordion de módulos é single-expand (Chakra Accordion sem allowMultiple):
    # abrir um módulo fecha o anterior. discover_course_structure() percorre todos
    # os módulos e deixa apenas o último expandido, então a linha da aula alvo
    # pode estar presente no DOM mas invisível (painel do módulo colapsado).
    # Reabrir o módulo certo aqui evita um timeout de clique em elemento oculto.
    module_header = page.locator("h3.chakra-text").filter(
        has_text=re.compile(rf"^{re.escape(lesson.module_name)}$")
    )
    await _ensure_module_expanded(page, module_header)

    row = page.locator(f'[data-testid="sidebar-menu-item-{lesson.content_id}"]')
    await row.click()

    # A verificação ao vivo mostrou que '[data-testid="embed-container"] iframe'
    # às vezes casa com 2 elementos (o iframe do player mdstrm + um iframe do
    # widget de chat "Asistente Virtual" da edu.tech.cogna.com.br que aparece
    # dentro do mesmo container na primeira aula aberta), o que dispara uma
    # violação de strict mode do Playwright — silenciosamente capturada pelo
    # except abaixo, resultando em None mesmo com o vídeo presente. Filtrar
    # pelo src do mdstrm evita a colisão.
    iframe = page.locator('[data-testid="embed-container"] iframe[src*="mdstrm.com"]')
    try:
        await iframe.wait_for(state="attached", timeout=15000)
    except Exception:
        return None

    src = await iframe.get_attribute("src")
    if not src:
        return None
    return extract_video_id(src)


async def fetch_transcript(context: BrowserContext, video_id: str) -> tuple[str, str] | None:
    """Busca a transcrição/legenda de um vídeo via API pública da mdstrm."""
    metadata_response = await context.request.get(f"https://mdstrm.com/video/{video_id}.json")
    if metadata_response.status != 200:
        return None

    data = await metadata_response.json()
    kind, url = pick_transcript_source(data)
    if not url:
        return None

    url = normalize_protocol_relative_url(url)
    content_response = await context.request.get(url)
    if content_response.status != 200:
        return None

    raw = await content_response.text()
    return (kind, raw)


def write_lesson(lesson: Lesson, content: str) -> Path:
    path = build_output_path(
        output_dir=OUTPUT_DIR,
        disciplina=DISCIPLINA_NOME,
        module_index=lesson.module_index,
        module_name=lesson.module_name,
        lesson_index=lesson.lesson_index,
        lesson_name=lesson.lesson_name,
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    md = format_md(
        title=lesson.lesson_name,
        module=lesson.module_name,
        disciplina=DISCIPLINA_NOME,
        content=content,
    )
    path.write_text(md, encoding="utf-8")
    return path


def write_index(lessons: list[Lesson]) -> Path:
    disciplina_dir = OUTPUT_DIR / to_slug(DISCIPLINA_NOME)
    index_path = disciplina_dir / "index.md"

    done_count = sum(
        1 for l in lessons
        if build_output_path(
            OUTPUT_DIR, DISCIPLINA_NOME, l.module_index, l.module_name, l.lesson_index, l.lesson_name
        ).exists()
    )

    lines = [
        f"# {DISCIPLINA_NOME}",
        "",
        f"> {len(lessons)} aulas | {done_count} extraídas | {len(lessons) - done_count} pendentes",
        "",
    ]

    current_module: int | None = None
    for lesson in lessons:
        if lesson.module_index != current_module:
            if current_module is not None:
                lines.append("")
            current_module = lesson.module_index
            lines.append(f"## {lesson.module_index}. {lesson.module_name}")
            lines.append("")
        path = build_output_path(
            OUTPUT_DIR, DISCIPLINA_NOME, lesson.module_index, lesson.module_name, lesson.lesson_index, lesson.lesson_name
        )
        check = "x" if path.exists() else " "
        rel = path.relative_to(disciplina_dir)
        lines.append(f"- [{check}] {lesson.lesson_index:02d}. {lesson.lesson_name} — `{rel}`")

    lines.append("")
    disciplina_dir.mkdir(parents=True, exist_ok=True)
    index_path.write_text("\n".join(lines), encoding="utf-8")
    return index_path


async def main() -> None:
    # Desvio do brief: o console do Windows (cp1252) não codifica os caracteres
    # ✓/✗ usados nos prints de progresso, e um UnicodeEncodeError no print()
    # derrubava o script inteiro no meio da primeira aula bem-sucedida (visto
    # ao vivo). Reconfigurar stdout/stderr para UTF-8 corrige isso sem mudar
    # o texto dos logs.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    _require_session()

    ERRORS_LOG.unlink(missing_ok=True)
    NO_TRANSCRIPT_LOG.unlink(missing_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state=str(SESSION_FILE))
        page = await context.new_page()

        await page.goto(DISCIPLINA_URL, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_load_state("load")
        # Desvio do brief: `page.wait_for_selector("h3.chakra-text")` (o literal do
        # Step 1) falha sempre com timeout na verificação ao vivo. A página tem 6
        # elementos "h3.chakra-text" ocultos (texto vazio, provavelmente placeholders
        # de outro componente) ANTES dos headers reais de módulo/curso, e o Playwright
        # resolve para o primeiro elemento do seletor amplo e espera por sua
        # visibilidade — que nunca ocorre. Trocado para esperar diretamente pelo
        # primeiro header de módulo real (mesmo filtro usado em discover_course_structure).
        await page.locator("h3.chakra-text").filter(has_text=MODULE_NAME_RE).first.wait_for(
            state="visible", timeout=20000
        )

        # Tasks anteriores identificaram um overlay de "product tour" e um modal
        # "Avalie nossa disciplina" que interceptam cliques no accordion/aulas no
        # primeiro carregamento da página (ver _dismiss_overlays). Fechados aqui
        # antes da descoberta da estrutura; o loop de aulas abaixo chama
        # _dismiss_overlays novamente a cada tentativa, pois o modal de avaliação
        # reaparece no meio da execução.
        await _dismiss_overlays(page)

        lessons = await discover_course_structure(page)

        if not lessons:
            print("ERRO: Nenhuma aula encontrada.")
            await browser.close()
            sys.exit(1)

        index_path = write_index(lessons)
        print(f"{len(lessons)} aulas encontradas | Índice: {index_path}\n")

        success = 0
        skipped = 0
        errors = 0
        total = len(lessons)

        for i, lesson in enumerate(lessons, start=1):
            label = f"[{i}/{total}] {lesson.module_name} > {lesson.lesson_name}"
            output_path = build_output_path(
                output_dir=OUTPUT_DIR,
                disciplina=DISCIPLINA_NOME,
                module_index=lesson.module_index,
                module_name=lesson.module_name,
                lesson_index=lesson.lesson_index,
                lesson_name=lesson.lesson_name,
            )

            if output_path.exists():
                success += 1
                continue

            for attempt in range(1, 3):
                try:
                    await _dismiss_overlays(page)
                    video_id = await open_lesson_and_get_video_id(page, lesson)
                    if not video_id:
                        skipped += 1
                        with NO_TRANSCRIPT_LOG.open("a", encoding="utf-8") as f:
                            f.write(f"{label} | sem video_id\n")
                        break

                    result = await fetch_transcript(context, video_id)
                    if not result:
                        skipped += 1
                        with NO_TRANSCRIPT_LOG.open("a", encoding="utf-8") as f:
                            f.write(f"{label} | video_id={video_id} sem transcrição\n")
                        break

                    kind, raw = result
                    content = raw.strip() if kind == "text" else clean_subtitle(raw)
                    write_lesson(lesson, content)
                    print(f"{label} ✓")
                    success += 1
                    break
                except Exception as e:
                    if attempt < 2:
                        await asyncio.sleep(3)
                        continue
                    _log_error(f"{label} — {e}")
                    errors += 1

        await browser.close()

    write_index(lessons)
    print(f"\nConcluído: {success} extraídas | {skipped} sem transcrição | {errors} erro(s)")
    if errors:
        print(f"Ver detalhes em: {ERRORS_LOG}")
    if skipped:
        print(f"Aulas sem transcrição em: {NO_TRANSCRIPT_LOG}")


if __name__ == "__main__":
    asyncio.run(main())
