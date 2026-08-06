# Platos Legendas — Fase 2 (crawler.py final) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o `crawler.py` final do projeto `platos-legendas`, que descobre módulos/aulas da disciplina `14082629`, abre cada aula, extrai a transcrição do provedor de vídeo (mdstrm.com) e grava como Markdown — completando o fluxo iniciado na Fase 1.

**Architecture:** Python + Playwright (async), reaproveitando `utils.py` da Fase 1 (`clean_subtitle`, `to_slug`, `build_output_path`, `format_md`) e `session.json` (já gerado pelo usuário via `login.py`). Diferente do design original: o site **não** expõe `<video><track>` na página — o player é um iframe cross-origin do provedor mdstrm.com. O crawler descobre o `video_id` clicando em cada aula (não há link direto) e depois usa a **API JSON pública da mdstrm** (`https://mdstrm.com/video/{id}.json`, sem autenticação) para obter a transcrição.

**Tech Stack:** Python 3.11+, `playwright` (async API), `python-slugify`, `pytest` (já instalados na Fase 1).

## Global Constraints

- Disciplina fixa: `https://infoprod.platosedu.io/v2/lms/aluno/disciplina/14082629`.
- Escopo de módulos: apenas os que seguem o padrão de título `Módulo NN` (regex `^Módulo \d+$`). Ignorar `Podcast` e `Avaliação` — não são aulas em vídeo no mesmo formato.
- Preferência de transcrição por aula: `ai.transcription.textUrl` (texto corrido, limpo) da resposta JSON da mdstrm; se ausente, cair para `subtitles[0].file` (VTT) e limpar com `clean_subtitle` (já implementado e testado na Fase 1).
- URLs retornadas pela API da mdstrm são protocol-relative (`//...`) — normalizar para `https://...` antes de buscar.
- `session.json` (gerado pelo usuário) já existe em `docs/scrap/platos-legendas/session.json` — os testes/execuções ao vivo desta fase podem reutilizá-lo diretamente.
- Título de aula pode vir truncado com `"..."` no próprio DOM (não é truncamento CSS) — não há fonte alternativa para o título completo; usar o texto como está.

---

## File Structure

```
docs/scrap/platos-legendas/
  utils.py            # + extract_video_id, pick_transcript_source, normalize_protocol_relative_url
  test_utils.py        # + testes das novas funções puras
  crawler.py           # NOVO: fluxo principal (discovery + extração + index + logs)
```

`crawler.py` é o único arquivo novo desta fase — toda lógica pura adicional entra em `utils.py` (mesmo padrão da Fase 1: I/O de Playwright fica em `crawler.py`, lógica testável fica em `utils.py`).

---

## Task 1: Funções puras da mdstrm em `utils.py`

**Files:**
- Modify: `docs/scrap/platos-legendas/utils.py`
- Modify: `docs/scrap/platos-legendas/test_utils.py`

**Interfaces:**
- Consumes: nenhuma das tasks anteriores diretamente (funções independentes, mas vivem no mesmo `utils.py` de `clean_subtitle`).
- Produces:
  - `extract_video_id(iframe_src: str) -> str | None`
  - `pick_transcript_source(mdstrm_json: dict) -> tuple[str, str] | tuple[None, None]` — retorna `("text", url)`, `("vtt", url)` ou `(None, None)`.
  - `normalize_protocol_relative_url(url: str) -> str`
  - Estas assinaturas serão usadas por `crawler.py` na Task 3 — manter os nomes exatos.

- [ ] **Step 1: Escrever os testes (falhando)**

```python
# adicionar em docs/scrap/platos-legendas/test_utils.py
from utils import extract_video_id, pick_transcript_source, normalize_protocol_relative_url


def test_extract_video_id_from_embed_url():
    src = "https://mdstrm.com/embed/69a03edb0a982b6ea69bf8b5?jsapi=true&autoplay=false"
    assert extract_video_id(src) == "69a03edb0a982b6ea69bf8b5"


def test_extract_video_id_returns_none_when_not_mdstrm():
    assert extract_video_id("https://example.com/other") is None


def test_pick_transcript_source_prefers_text_transcription():
    data = {
        "subtitles": [{"language": "pt", "file": "//cdn.example/subs/x.vtt"}],
        "ai": {"transcription": {"textUrl": "//cdn.example/transcription/x.txt"}},
    }
    assert pick_transcript_source(data) == ("text", "//cdn.example/transcription/x.txt")


def test_pick_transcript_source_falls_back_to_vtt():
    data = {
        "subtitles": [{"language": "pt", "file": "//cdn.example/subs/x.vtt"}],
        "ai": {},
    }
    assert pick_transcript_source(data) == ("vtt", "//cdn.example/subs/x.vtt")


def test_pick_transcript_source_returns_none_when_nothing_available():
    assert pick_transcript_source({}) == (None, None)


def test_normalize_protocol_relative_url_adds_https():
    assert normalize_protocol_relative_url("//cdn.example/file.vtt") == "https://cdn.example/file.vtt"


def test_normalize_protocol_relative_url_leaves_absolute_url_untouched():
    assert normalize_protocol_relative_url("https://cdn.example/file.vtt") == "https://cdn.example/file.vtt"
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `.venv\Scripts\pytest test_utils.py -v` (a partir de `docs/scrap/platos-legendas/`)
Expected: `ImportError: cannot import name 'extract_video_id'` (as novas funções ainda não existem).

- [ ] **Step 3: Implementar as três funções em `utils.py`**

```python
# adicionar em docs/scrap/platos-legendas/utils.py
import re

_MDSTRM_EMBED_RE = re.compile(r"mdstrm\.com/embed/([a-f0-9]+)")


def extract_video_id(iframe_src: str) -> str | None:
    match = _MDSTRM_EMBED_RE.search(iframe_src)
    return match.group(1) if match else None


def pick_transcript_source(mdstrm_json: dict) -> tuple[str, str] | tuple[None, None]:
    ai = mdstrm_json.get("ai") or {}
    transcription = ai.get("transcription") or {}
    text_url = transcription.get("textUrl")
    if text_url:
        return ("text", text_url)

    subtitles = mdstrm_json.get("subtitles") or []
    if subtitles:
        file_url = subtitles[0].get("file")
        if file_url:
            return ("vtt", file_url)

    return (None, None)


def normalize_protocol_relative_url(url: str) -> str:
    if url.startswith("//"):
        return "https:" + url
    return url
```

- [ ] **Step 4: Rodar todos os testes e confirmar que passam**

Run: `.venv\Scripts\pytest test_utils.py -v`
Expected: 16 testes `PASSED` (9 existentes da Fase 1 + 7 novos).

- [ ] **Step 5: Commit**

```bash
git add docs/scrap/platos-legendas/utils.py docs/scrap/platos-legendas/test_utils.py
git commit -m "feat: add mdstrm helpers (extract_video_id, pick_transcript_source, normalize_protocol_relative_url)"
```

---

## Task 2: `crawler.py` — descoberta de módulos e aulas

**Files:**
- Create: `docs/scrap/platos-legendas/crawler.py`

**Interfaces:**
- Consumes: `to_slug`, `build_output_path`, `format_md` de `utils.py` (Fase 1).
- Produces: `Lesson` (dataclass) e `discover_course_structure(page) -> list[Lesson]`, consumidos pela Task 3 e Task 4.

- [ ] **Step 1: Implementar o início de `crawler.py` com a descoberta de estrutura**

```python
# docs/scrap/platos-legendas/crawler.py
import asyncio
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from playwright.async_api import async_playwright, Page
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
DISCIPLINA_URL = "https://infoprod.platosedu.io/v2/lms/aluno/disciplina/14082629"
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

        button = header.locator("xpath=ancestor::button[1]")
        if await button.get_attribute("aria-expanded") != "true":
            await button.click()
            await page.wait_for_timeout(300)

        panel_id = await button.get_attribute("aria-controls")
        panel = page.locator(f"#{panel_id}")
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
```

- [ ] **Step 2: Verificação ao vivo — rodar a descoberta contra a disciplina real**

O `session.json` já existe (gerado pelo usuário na Fase 1). Rode este script auxiliar temporário para validar a descoberta sem precisar do restante do crawler:

```powershell
.venv\Scripts\python -c "
import asyncio
from playwright.async_api import async_playwright
from crawler import discover_course_structure, DISCIPLINA_URL, SESSION_FILE

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state=str(SESSION_FILE))
        page = await context.new_page()
        await page.goto(DISCIPLINA_URL, wait_until='domcontentloaded', timeout=60000)
        await page.wait_for_load_state('load')
        await page.wait_for_selector('h3.chakra-text', timeout=20000)
        lessons = await discover_course_structure(page)
        print(f'Total de aulas encontradas: {len(lessons)}')
        for l in lessons[:5]:
            print(l)
        await browser.close()

asyncio.run(main())
"
```

Expected: imprime `Total de aulas encontradas: 28` (7 módulos, contagens 4/5/4/4/4/5/2 confirmadas na descoberta manual) e as 5 primeiras aulas com `module_index`, `module_name`, `lesson_index`, `lesson_name`, `content_id` preenchidos corretamente (ex: primeira aula com `content_id="94726"`, `lesson_name` contendo "PANORAMA DO MERCADO DE...").

Se a sessão tiver expirado ou a contagem não bater, reporte BLOCKED com o output real — não ajuste os seletores às cegas.

- [ ] **Step 3: Commit**

```bash
git add docs/scrap/platos-legendas/crawler.py
git commit -m "feat: add course structure discovery to crawler.py"
```

---

## Task 3: `crawler.py` — abrir aula e extrair transcrição

**Files:**
- Modify: `docs/scrap/platos-legendas/crawler.py`

**Interfaces:**
- Consumes: `Lesson` (Task 2), `extract_video_id`/`pick_transcript_source`/`normalize_protocol_relative_url`/`clean_subtitle` (Task 1 e Fase 1).
- Produces: `open_lesson_and_get_video_id(page, lesson) -> str | None` e `fetch_transcript(context, video_id) -> tuple[str, str] | None` (retorna `(kind, content)` onde `kind` é `"text"` ou `"vtt"`), consumidos pela Task 4.

- [ ] **Step 1: Implementar as duas funções em `crawler.py`**

```python
# adicionar em docs/scrap/platos-legendas/crawler.py
from playwright.async_api import BrowserContext


async def open_lesson_and_get_video_id(page: Page, lesson: "Lesson") -> str | None:
    """Clica na aula na sidebar e extrai o video_id do iframe da mdstrm que aparece."""
    row = page.locator(f'[data-testid="sidebar-menu-item-{lesson.content_id}"]')
    await row.click()

    iframe = page.locator('[data-testid="embed-container"] iframe')
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
```

- [ ] **Step 2: Verificação ao vivo — abrir 2 aulas reais e confirmar extração**

```powershell
.venv\Scripts\python -c "
import asyncio
from playwright.async_api import async_playwright
from crawler import (
    discover_course_structure, open_lesson_and_get_video_id, fetch_transcript,
    DISCIPLINA_URL, SESSION_FILE,
)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state=str(SESSION_FILE))
        page = await context.new_page()
        await page.goto(DISCIPLINA_URL, wait_until='domcontentloaded', timeout=60000)
        await page.wait_for_load_state('load')
        await page.wait_for_selector('h3.chakra-text', timeout=20000)
        lessons = await discover_course_structure(page)

        for lesson in lessons[:2]:
            video_id = await open_lesson_and_get_video_id(page, lesson)
            print(f'{lesson.lesson_name} -> video_id={video_id}')
            if video_id:
                result = await fetch_transcript(context, video_id)
                if result:
                    kind, raw = result
                    print(f'  transcript kind={kind} len={len(raw)} preview={raw[:80]!r}')
                else:
                    print('  sem transcrição disponível')

        await browser.close()

asyncio.run(main())
"
```

Expected: para as 2 primeiras aulas, imprime o `video_id` extraído (formato hexadecimal, ex: `69a03edb0a982b6ea69bf8b5`) e `transcript kind=text len=NNNN preview='...'` com conteúdo real em português.

Se o clique não abrir o iframe, ou a API retornar 404, reporte BLOCKED com o output real.

- [ ] **Step 3: Commit**

```bash
git add docs/scrap/platos-legendas/crawler.py
git commit -m "feat: add lesson opening and mdstrm transcript fetching to crawler.py"
```

---

## Task 4: `crawler.py` — loop principal, índice e logs

**Files:**
- Modify: `docs/scrap/platos-legendas/crawler.py`

**Interfaces:**
- Consumes: tudo das Tasks 1-3.
- Produces: `write_index(lessons) -> Path`, `write_lesson(lesson, content) -> Path`, `main()` — ponto de entrada do script.

- [ ] **Step 1: Implementar índice, escrita de aula e loop principal**

```python
# adicionar em docs/scrap/platos-legendas/crawler.py

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
    _require_session()

    ERRORS_LOG.unlink(missing_ok=True)
    NO_TRANSCRIPT_LOG.unlink(missing_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state=str(SESSION_FILE))
        page = await context.new_page()

        await page.goto(DISCIPLINA_URL, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_load_state("load")
        await page.wait_for_selector("h3.chakra-text", timeout=20000)

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
```

- [ ] **Step 2: Verificação ao vivo — rodar o crawler completo contra a disciplina real**

```powershell
.venv\Scripts\python crawler.py
```

Expected: processa as 28 aulas, imprime progresso `[i/28] ...`, gera `output/curso-14082629/index.md` e um `.md` por aula em `output/curso-14082629/{modulo}/`. Ao final, imprime o resumo `Concluído: N extraídas | N sem transcrição | N erro(s)`.

Rode de novo logo em seguida (`python crawler.py`) e confirme que todas as aulas já extraídas são puladas (nenhum novo download) — isso valida o comportamento de resume.

Se a contagem de sucesso for muito menor que 28, inspecione `sem_legenda.log` e `errors.log` antes de reportar — pode ser aula legítima sem transcrição (ex: aula em formato diferente) e não um bug.

- [ ] **Step 3: Commit**

```bash
git add docs/scrap/platos-legendas/crawler.py
git commit -m "feat: add main crawler loop with index and error/skip logging"
```

---

## Task 5: Atualizar README

**Files:**
- Modify: `docs/scrap/platos-legendas/README.md`

**Interfaces:**
- Produces: documentação atualizada refletindo Fase 2 completa.

- [ ] **Step 1: Atualizar `README.md`**

Substituir a seção "Status" e adicionar instruções de uso do `crawler.py`:

```markdown
## Status

**Fase 1 e Fase 2 concluídas.** O crawler está funcional:
login manual, descoberta de módulos/aulas, extração de transcrição via API
pública da mdstrm.com (com fallback para legenda VTT), geração de
`output/curso-14082629/index.md` e um `.md` por aula.

## Fluxo completo

### 1. Login (uma vez só)

\`\`\`powershell
.venv\\Scripts\\python login.py
\`\`\`

### 2. Rodar o crawler

\`\`\`powershell
.venv\\Scripts\\python crawler.py
\`\`\`

Processa as 28 aulas da disciplina, salva as transcrições em
\`output/curso-14082629/\`, e loga aulas sem transcrição em
\`sem_legenda.log\` e erros em \`errors.log\`. Pode ser reexecutado — aulas
já extraídas são puladas.

### 3. Testes

\`\`\`powershell
.venv\\Scripts\\pytest -v
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add docs/scrap/platos-legendas/README.md
git commit -m "docs: update README for phase 2 completion"
```
