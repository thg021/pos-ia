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

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\playwright install chromium
```

## Fluxo atual

### 1. Login (uma vez só)

```powershell
.venv\Scripts\python login.py
```

Abre o browser, você faz login manualmente (com SSO/2FA se houver), a sessão
é salva em `session.json`.

### 2. Descoberta de seletores

```powershell
.venv\Scripts\python explore.py
```

Abre a disciplina já autenticado. Navegue manualmente (abra módulos, aulas,
dê play nos vídeos) e pressione ENTER a cada passo para capturar o HTML da
página em `output/discovery/` e ver no console os `<video>`/`<track>`
encontrados. Use esses dumps para identificar os seletores reais.

### 3. Testes

```powershell
.venv\Scripts\pytest -v
```
