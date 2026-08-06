# Crawler de legendas — Infoprod/Platos Edu

**Status:** aprovado para plano de implementação
**Data:** 2026-07-20

## Objetivo

Extrair as legendas (`<video><track>`) das aulas da disciplina `14082629` em
`https://infoprod.platosedu.io/v2/lms/aluno/disciplina/14082629` e convertê-las
em material de estudo: transcrição limpa em Markdown, uma aula por arquivo.

Referência de arquitetura: `C:\Users\thiago.silva\projects\rpa-full-cycle`
(Python + Playwright, login manual persistido em `session.json`, crawler que
descobre módulos/aulas e grava saída em `output/`).

## Escopo da v1

- Disciplina fixa: `14082629`. Não parametrizar por enquanto.
- Login manual (site pode ter SSO/2FA) — sem automação de usuário/senha.
- Saída: transcrição limpa (sem timestamps/cues), sem resumo via LLM.
- Localização do projeto: `docs/scrap/platos-legendas/` (projeto Python
  independente, com seu próprio `.venv`/`requirements.txt`).

## Restrição conhecida

O site é um SPA autenticado — só renderiza conteúdo real após login (confirmado
via fetch: página carregada só mostra "Loading..."). Os seletores de DOM reais
(estrutura de módulos/aulas na listagem, e do `<video><track>` dentro da página
de cada aula) **não são conhecidos ainda** e precisam ser descobertos na
primeira execução guiada (fase de descoberta, ver abaixo).

## Arquitetura

```
docs/scrap/platos-legendas/
  login.py          # login manual, salva session.json
  crawler.py         # fluxo principal
  utils.py           # funções puras (slug, path, limpeza de legenda)
  requirements.txt
  .env.example
  session.json        # gerado, gitignored
  output/
    {disciplina}/
      index.md
      01-{modulo}/
        01-{aula}.md
  sem_legenda.log
  errors.log
```

### `login.py`
Igual ao padrão do `rpa-full-cycle`: abre browser headed em
`https://infoprod.platosedu.io/`, usuário loga manualmente, `ENTER` no
terminal salva `context.storage_state()` em `session.json`.

### `crawler.py`
1. `_require_session()` — aborta se `session.json` não existir.
2. Abre `context` com `storage_state=session.json`, navega até a URL fixa da
   disciplina.
3. `discover_course_structure(page)` — descobre lista de módulos e aulas
   (seletores a confirmar na fase de descoberta). Retorna nome da disciplina e
   lista de `Lesson(module_index, module_name, lesson_index, lesson_name, url)`.
4. `write_index(...)` — gera `output/{disciplina}/index.md` como checklist,
   igual ao formato atual do `rpa-full-cycle`.
5. Para cada aula ainda não extraída:
   - Abre a página da aula.
   - Localiza `<track src="...">` dentro do `<video>` (seletor a confirmar).
   - Resolve a URL absoluta do arquivo de legenda.
   - Baixa o conteúdo (via `page.context.request.get`, reaproveitando cookies
     da sessão).
   - Detecta formato: `WEBVTT` no início do arquivo → VTT; blocos numerados
     com `-->` → SRT.
   - Limpa timestamps, numeração de cue e tags residuais, junta falas em
     texto corrido (função pura em `utils.py`, testável).
   - Grava `.md` com cabeçalho (título da aula, módulo, disciplina) — mesmo
     formato do `format_md` atual.
6. Ao final, regrava `index.md` com status atualizado.

### Fase de descoberta (pré-requisito de implementação)

Como os seletores reais do DOM da Infoprod/Platos Edu são desconhecidos, a
primeira etapa do plano de implementação será rodar o crawler em modo
headed/verbose (equivalente ao `debug.py` do projeto de referência) contra a
disciplina real, com o usuário logado, para capturar os seletores corretos de:
- Listagem de módulos/aulas na página da disciplina.
- Elemento `<video>`/`<track>` dentro da página de cada aula.

Só depois disso os seletores definitivos entram no `crawler.py`.

## Tratamento de erro

- Aula sem `<track>`/legenda → loga em `sem_legenda.log`, não interrompe o
  processamento das demais aulas.
- Falha de rede/DOM ao processar uma aula → retry 2x com espera, depois loga
  em `errors.log` e segue para a próxima.
- Sessão expirada (redirecionado para login) → aborta com instrução para
  rodar `login.py` novamente.
- Aula já extraída (arquivo `.md` já existe) → pula, não baixa de novo.

## Testes

- `utils.py`: função de limpeza VTT/SRT → texto é pura e ganha testes
  unitários com `pytest` (dado um VTT de exemplo e um SRT de exemplo, valida
  a saída limpa, sem timestamps/numeração).
- Scraping autenticado: validado manualmente — primeira rodada headed numa
  aula só (fase de descoberta), depois rodada completa (headless) contra a
  disciplina inteira.

## Fora de escopo (v1)

- Parametrizar a URL da disciplina.
- Resumo/anotação didática via LLM em cima da transcrição.
- Suporte a múltiplas disciplinas/paginação.
- Interceptação de API do SPA (alternativa considerada, não usada nesta v1).
