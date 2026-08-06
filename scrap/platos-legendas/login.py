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
