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
