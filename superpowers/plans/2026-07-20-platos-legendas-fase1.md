# Platos Legendas — Fase 1 (scaffold + limpeza de legenda + descoberta) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o scaffold do projeto `platos-legendas`, as funções puras de limpeza de legenda (VTT/SRT → texto), o login manual, e uma ferramenta de descoberta interativa para mapear os seletores reais do DOM do infoprod.platosedu.io — pré-requisito para escrever o `crawler.py` final (Fase 2, plano futuro).

**Architecture:** Python + Playwright (async), mesmo padrão do projeto de referência `C:\Users\thiago.silva\projects\rpa-full-cycle`: sessão salva em `session.json` via login manual, funções utilitárias puras testáveis com `pytest`, script de descoberta headed para inspecionar o DOM autenticado antes de fechar os seletores definitivos.

**Tech Stack:** Python 3.11+, `playwright` (async API), `python-slugify`, `pytest`.

## Global Constraints

- Disciplina fixa: `https://infoprod.platosedu.io/v2/lms/aluno/disciplina/14082629`. Não parametrizar por enquanto.
- Login manual (site pode ter SSO/2FA) — sem automação de usuário/senha.
- Saída final (Fase 2) será transcrição limpa (sem timestamps/cues), sem resumo via LLM.
- Projeto vive em `docs/scrap/platos-legendas/` com seu próprio `.venv`/`requirements.txt`.
- Os seletores de DOM reais (listagem de módulos/aulas, `<video><track>`) são **desconhecidos** — não podem ser hardcoded nesta fase. Esta fase entrega a ferramenta que descobre esses seletores; o `crawler.py` final é escopo de um Plano 2.

---

## File Structure

```
docs/scrap/platos-legendas/
  requirements.txt
  .env.example
  .gitignore
  README.md
  utils.py            # funções puras: clean_subtitle, to_slug, build_output_path, format_md
  test_utils.py        # testes pytest de utils.py
  login.py             # login manual, salva session.json
  explore.py           # ferramenta de descoberta interativa (headed)
```

- `utils.py` concentra toda a lógica pura e testável (sem I/O de rede/browser), para ficar isolada e fácil de testar.
- `login.py` e `explore.py` são scripts de I/O (Playwright), sem lógica de negócio — não ganham testes automatizados, só verificação manual.

---

## Task 1: Scaffold do projeto

**Files:**
- Create: `docs/scrap/platos-legendas/requirements.txt`
- Create: `docs/scrap/platos-legendas/.env.example`
- Create: `docs/scrap/platos-legendas/.gitignore`

**Interfaces:**
- Produces: ambiente Python instalável (`pip install -r requirements.txt`) usado por todas as tasks seguintes.

- [ ] **Step 1: Criar `requirements.txt`**

```
playwright>=1.48.0
python-slugify>=8.0.4
pytest>=8.3.0
```

- [ ] **Step 2: Criar `.env.example`**

```
# URL da disciplina fixa (informativo — o crawler final usa este valor hardcoded)
DISCIPLINA_URL=https://infoprod.platosedu.io/v2/lms/aluno/disciplina/14082629
```

- [ ] **Step 3: Criar `.gitignore`**

```
.venv/
__pycache__/
*.pyc
session.json
output/
errors.log
sem_legenda.log
.env
```

- [ ] **Step 4: Instalar dependências e o browser do Playwright**

Run (a partir de `docs/scrap/platos-legendas/`):
```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\playwright install chromium
```
Expected: instalação conclui sem erro; `.venv\Scripts\pytest --version` mostra a versão instalada.

- [ ] **Step 5: Commit**

```bash
git add docs/scrap/platos-legendas/requirements.txt docs/scrap/platos-legendas/.env.example docs/scrap/platos-legendas/.gitignore
git commit -m "chore: scaffold platos-legendas project"
```

---

## Task 2: `clean_subtitle` — limpeza de VTT/SRT para texto corrido

**Files:**
- Create: `docs/scrap/platos-legendas/utils.py`
- Test: `docs/scrap/platos-legendas/test_utils.py`

**Interfaces:**
- Produces: `clean_subtitle(raw: str) -> str` — recebe o conteúdo bruto de um arquivo VTT ou SRT e devolve texto corrido, sem timestamps, numeração de cue, tags e sem linhas duplicadas consecutivas (comuns em legendas "rolling caption").

- [ ] **Step 1: Escrever os testes (falhando)**

```python
# docs/scrap/platos-legendas/test_utils.py
from utils import clean_subtitle


def test_clean_subtitle_vtt_basic():
    raw = (
        "WEBVTT\n\n"
        "00:00:00.000 --> 00:00:02.000\n"
        "Ola mundo\n\n"
        "00:00:02.000 --> 00:00:04.000\n"
        "Segunda linha\n"
    )
    assert clean_subtitle(raw) == "Ola mundo\nSegunda linha"


def test_clean_subtitle_srt_basic():
    raw = (
        "1\n"
        "00:00:00,000 --> 00:00:02,000\n"
        "Ola mundo\n\n"
        "2\n"
        "00:00:02,000 --> 00:00:04,000\n"
        "Segunda linha\n"
    )
    assert clean_subtitle(raw) == "Ola mundo\nSegunda linha"


def test_clean_subtitle_removes_inline_tags():
    raw = (
        "WEBVTT\n\n"
        "00:00:00.000 --> 00:00:02.000\n"
        "<c>Ola</c> <00:00:01.000>mundo\n"
    )
    assert clean_subtitle(raw) == "Ola mundo"


def test_clean_subtitle_dedups_consecutive_rolling_captions():
    raw = (
        "WEBVTT\n\n"
        "00:00:00.000 --> 00:00:02.000\n"
        "Ola mundo\n\n"
        "00:00:01.500 --> 00:00:03.000\n"
        "Ola mundo\n\n"
        "00:00:03.000 --> 00:00:05.000\n"
        "Terceira linha\n"
    )
    assert clean_subtitle(raw) == "Ola mundo\nTerceira linha"


def test_clean_subtitle_ignores_note_and_style_blocks():
    raw = (
        "WEBVTT\n\n"
        "STYLE\n"
        "::cue { color: white; }\n\n"
        "NOTE isto e um comentario\n\n"
        "00:00:00.000 --> 00:00:02.000\n"
        "Ola mundo\n"
    )
    assert clean_subtitle(raw) == "Ola mundo"
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `.venv\Scripts\pytest docs/scrap/platos-legendas/test_utils.py -v`
Expected: `ModuleNotFoundError: No module named 'utils'` (ou `ImportError`) — `utils.py` ainda não existe.

- [ ] **Step 3: Implementar `clean_subtitle` em `utils.py`**

```python
# docs/scrap/platos-legendas/utils.py
import re

_TIMESTAMP_RE = re.compile(r"\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}")
_SEQUENCE_RE = re.compile(r"^\d+$")
_TAG_RE = re.compile(r"<[^>]+>")


def clean_subtitle(raw: str) -> str:
    lines: list[str] = []
    in_style_block = False

    for line in raw.splitlines():
        stripped = line.strip()

        if not stripped:
            in_style_block = False
            continue
        if stripped == "WEBVTT":
            continue
        if stripped.startswith("NOTE"):
            continue
        if stripped == "STYLE":
            in_style_block = True
            continue
        if in_style_block:
            continue
        if _TIMESTAMP_RE.search(stripped):
            continue
        if _SEQUENCE_RE.match(stripped):
            continue

        clean_line = _TAG_RE.sub("", stripped).strip()
        if not clean_line:
            continue
        if lines and lines[-1] == clean_line:
            continue
        lines.append(clean_line)

    return "\n".join(lines)
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `.venv\Scripts\pytest docs/scrap/platos-legendas/test_utils.py -v`
Expected: 5 testes `PASSED`.

- [ ] **Step 5: Commit**

```bash
git add docs/scrap/platos-legendas/utils.py docs/scrap/platos-legendas/test_utils.py
git commit -m "feat: add clean_subtitle for VTT/SRT to plain text"
```

---

## Task 3: `to_slug`, `build_output_path`, `format_md`

**Files:**
- Modify: `docs/scrap/platos-legendas/utils.py`
- Modify: `docs/scrap/platos-legendas/test_utils.py`

**Interfaces:**
- Consumes: nada de tasks anteriores (funções independentes).
- Produces:
  - `to_slug(text: str) -> str`
  - `build_output_path(output_dir: Path, disciplina: str, module_index: int, module_name: str, lesson_index: int, lesson_name: str) -> Path`
  - `format_md(title: str, module: str, disciplina: str, content: str) -> str`
  - Estas três assinaturas serão usadas pelo `crawler.py` na Fase 2 — manter os nomes exatos.

- [ ] **Step 1: Escrever os testes (falhando)**

```python
# adicionar em docs/scrap/platos-legendas/test_utils.py
from pathlib import Path
from utils import to_slug, build_output_path, format_md


def test_to_slug_basic():
    assert to_slug("Introdução ao Kubernetes") == "introducao-ao-kubernetes"


def test_build_output_path():
    path = build_output_path(
        output_dir=Path("output"),
        disciplina="Minha Disciplina",
        module_index=1,
        module_name="Módulo Um",
        lesson_index=2,
        lesson_name="Aula Dois",
    )
    assert path == Path("output/minha-disciplina/01-modulo-um/02-aula-dois.md")


def test_format_md():
    md = format_md(
        title="Aula Um",
        module="Módulo Um",
        disciplina="Minha Disciplina",
        content="Texto da legenda limpo.",
    )
    assert md == (
        "# Aula Um\n\n"
        "**Módulo:** Módulo Um  \n"
        "**Disciplina:** Minha Disciplina\n\n"
        "---\n\n"
        "Texto da legenda limpo.\n"
    )
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `.venv\Scripts\pytest docs/scrap/platos-legendas/test_utils.py -v`
Expected: `ImportError: cannot import name 'to_slug'` (as demais funções ainda não existem).

- [ ] **Step 3: Implementar as três funções em `utils.py`**

```python
# adicionar em docs/scrap/platos-legendas/utils.py
from pathlib import Path
from slugify import slugify


def to_slug(text: str) -> str:
    return slugify(text, allow_unicode=False, separator="-")


def format_md(title: str, module: str, disciplina: str, content: str) -> str:
    return (
        f"# {title}\n\n"
        f"**Módulo:** {module}  \n"
        f"**Disciplina:** {disciplina}\n\n"
        f"---\n\n"
        f"{content}\n"
    )


def build_output_path(
    output_dir: Path,
    disciplina: str,
    module_index: int,
    module_name: str,
    lesson_index: int,
    lesson_name: str,
) -> Path:
    disciplina_dir = to_slug(disciplina)
    module_dir = f"{module_index:02d}-{to_slug(module_name)}"
    lesson_file = f"{lesson_index:02d}-{to_slug(lesson_name)}.md"
    return output_dir / disciplina_dir / module_dir / lesson_file
```

- [ ] **Step 4: Rodar todos os testes de `utils.py` e confirmar que passam**

Run: `.venv\Scripts\pytest docs/scrap/platos-legendas/test_utils.py -v`
Expected: 8 testes `PASSED` (5 do Task 2 + 3 novos).

- [ ] **Step 5: Commit**

```bash
git add docs/scrap/platos-legendas/utils.py docs/scrap/platos-legendas/test_utils.py
git commit -m "feat: add to_slug, build_output_path, format_md helpers"
```

---

## Task 4: `login.py` — login manual e persistência de sessão

**Files:**
- Create: `docs/scrap/platos-legendas/login.py`

**Interfaces:**
- Produces: `session.json` (Playwright `storage_state`) na raiz do projeto — consumido por `explore.py` (Task 5) e pelo `crawler.py` da Fase 2.

- [ ] **Step 1: Implementar `login.py`**

```python
# docs/scrap/platos-legendas/login.py
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = "https://infoprod.platosedu.io/"
SESSION_FILE = Path("session.json")


async def main() -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        await page.goto(BASE_URL)
        print(f"Browser aberto em: {BASE_URL}")
        print("Faça login normalmente (inclusive SSO/2FA se houver) e pressione ENTER quando terminar...")
        input()

        await context.storage_state(path=str(SESSION_FILE))
        print(f"Sessão salva em {SESSION_FILE}")
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Verificação manual**

Run (a partir de `docs/scrap/platos-legendas/`):
```powershell
.venv\Scripts\python login.py
```
Expected: browser abre em `https://infoprod.platosedu.io/`, você faz login manualmente, pressiona ENTER no terminal, e o arquivo `session.json` é criado na pasta do projeto.

- [ ] **Step 3: Commit**

```bash
git add docs/scrap/platos-legendas/login.py
git commit -m "feat: add manual login script for platos-legendas"
```

---

## Task 5: `explore.py` — ferramenta de descoberta interativa

**Files:**
- Create: `docs/scrap/platos-legendas/explore.py`

**Interfaces:**
- Consumes: `session.json` gerado pela Task 4.
- Produces: arquivos HTML em `output/discovery/dump-N.html` e um log no console com todos os `<video>`/`<track>` encontrados a cada captura — usado manualmente para identificar os seletores reais que vão para o `crawler.py` da Fase 2.

- [ ] **Step 1: Implementar `explore.py`**

```python
# docs/scrap/platos-legendas/explore.py
import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright

SESSION_FILE = Path("session.json")
DISCOVERY_DIR = Path("output/discovery")
DEFAULT_URL = "https://infoprod.platosedu.io/v2/lms/aluno/disciplina/14082629"


def _require_session() -> None:
    if not SESSION_FILE.exists():
        print("ERRO: session.json não encontrado. Execute: python login.py")
        sys.exit(1)


async def _dump(page, label: str) -> None:
    DISCOVERY_DIR.mkdir(parents=True, exist_ok=True)
    html_path = DISCOVERY_DIR / f"{label}.html"
    html_path.write_text(await page.content(), encoding="utf-8")

    videos = await page.eval_on_selector_all(
        "video",
        """els => els.map(v => ({
            outerHTML: v.outerHTML.slice(0, 300),
            tracks: [...v.querySelectorAll('track')].map(t => t.outerHTML)
        }))""",
    )

    print(f"\n[{label}] HTML salvo em {html_path}")
    print(f"[{label}] URL atual: {page.url}")
    print(f"[{label}] <video> encontrados: {len(videos)}")
    for i, v in enumerate(videos):
        print(f"  video[{i}]: {v['outerHTML']}")
        for j, t in enumerate(v["tracks"]):
            print(f"    track[{j}]: {t}")


async def main() -> None:
    _require_session()
    url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(storage_state=str(SESSION_FILE))
        page = await context.new_page()

        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_load_state("load")

        counter = 1
        while True:
            await _dump(page, f"dump-{counter}")
            print(
                "\nNavegue manualmente no browser (abra um módulo, entre numa aula, dê play no vídeo)."
                "\nPressione ENTER para capturar o estado atual de novo, ou digite 'q' + ENTER para sair."
            )
            answer = input()
            if answer.strip().lower() == "q":
                break
            counter += 1

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Verificação manual — rodar a descoberta contra a disciplina real**

Run:
```powershell
.venv\Scripts\python explore.py
```
Expected: browser abre já autenticado (usa `session.json`) na URL da disciplina `14082629`; o terminal imprime o dump inicial. Navegue manualmente:
1. Clique num módulo/aula na listagem, pressione ENTER — confira o dump, note os seletores/IDs/classes usados na listagem (module/lesson containers).
2. Dentro da página da aula, dê play no vídeo se necessário, pressione ENTER — confira se `<video>`/`<track>` aparecem no dump; note o `src` do `<track>`.
3. Digite `q` + ENTER para encerrar.

Guarde os arquivos `output/discovery/dump-*.html` — eles serão a referência para escrever os seletores reais do `crawler.py` na Fase 2.

- [ ] **Step 3: Commit**

```bash
git add docs/scrap/platos-legendas/explore.py
git commit -m "feat: add interactive DOM discovery tool for platos-legendas"
```

---

## Task 6: README do projeto

**Files:**
- Create: `docs/scrap/platos-legendas/README.md`

**Interfaces:**
- Produces: documentação do fluxo atual (Fase 1) para quem for continuar o trabalho.

- [ ] **Step 1: Escrever `README.md`**

```markdown
# Platos Legendas

Extrai legendas das aulas da disciplina `14082629` em
`https://infoprod.platosedu.io/v2/lms/aluno/disciplina/14082629` e converte em
material de estudo (transcrição limpa em Markdown).

Ver spec completo em `docs/superpowers/specs/2026-07-20-platos-legendas-crawler-design.md`.

## Status

**Fase 1 concluída:** scaffold, limpeza de legenda (VTT/SRT → texto, testado),
login manual, ferramenta de descoberta de seletores.

**Fase 2 (pendente):** `crawler.py` final — depende dos seletores reais do
DOM, mapeados via `explore.py` (Task 5). Ver `output/discovery/dump-*.html`
para referência antes de escrever o Plano 2.

## Pré-requisitos

\`\`\`powershell
python -m venv .venv
.venv\\Scripts\\pip install -r requirements.txt
.venv\\Scripts\\playwright install chromium
\`\`\`

## Fluxo atual

### 1. Login (uma vez só)

\`\`\`powershell
.venv\\Scripts\\python login.py
\`\`\`

Abre o browser, você faz login manualmente (com SSO/2FA se houver), a sessão
é salva em \`session.json\`.

### 2. Descoberta de seletores

\`\`\`powershell
.venv\\Scripts\\python explore.py
\`\`\`

Abre a disciplina já autenticado. Navegue manualmente (abra módulos, aulas,
dê play nos vídeos) e pressione ENTER a cada passo para capturar o HTML da
página em \`output/discovery/\` e ver no console os \`<video>\`/\`<track>\`
encontrados. Use esses dumps para identificar os seletores reais.

### 3. Testes

\`\`\`powershell
.venv\\Scripts\\pytest -v
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add docs/scrap/platos-legendas/README.md
git commit -m "docs: add README for platos-legendas phase 1"
```
