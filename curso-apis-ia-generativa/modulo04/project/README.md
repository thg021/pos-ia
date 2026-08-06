# Módulo 04 — Recomendador de música com memória persistente

Assistente de recomendação musical via linha de comando que extrai preferências do
cliente durante a conversa (SQLite), guarda o histórico de mensagens (Postgres) e
resume o histórico automaticamente quando ele cresce demais.

## Como rodar

```bash
cp .env.example .env    # preencha OPENROUTER_API_KEY (e LANGSMITH_* se quiser tracing)
docker compose up -d    # sobe o Postgres usado pelo checkpointer/store do LangGraph
npm install
npm run chat -- --user=eric-wendel
```

Converse normalmente, mencionando nome, idade, bandas e gêneros favoritos aos poucos.
Encerre com `Ctrl+C` e rode o comando de novo com o mesmo `--user` — o assistente deve
recuperar as preferências salvas e continuar de onde parou.

## Testes

```bash
npm test
```

Os testes de `PreferencesService` rodam localmente contra um SQLite temporário (sem
dependências externas). O teste de fluxo do grafo chama a API de verdade via
`OpenRouterService`, então exige `OPENROUTER_API_KEY` configurada em `.env` para passar.
