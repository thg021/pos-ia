# Curso: APIs de IA Generativa e Prompt Engineering

> Anotações de estudo geradas a partir das legendas das aulas (ver `docs/scrap/platos-legendas/`).
> Cada aula tem dois arquivos: um **artigo** (conceitual, "o que e por que") e um **tutorial**
> (prático, "como fazer", passo a passo próximo do que foi feito em aula).

Regra de geração: aulas **sem código** (conceituais/mercado) ganham só um artigo, com o
exercício prático incorporado nele. Tutorial separado é só para aulas onde a aula original
mostra implementação de verdade.

Como usar este material (recomendado):
1. Leia o **artigo** primeiro só até entender o problema que a aula resolve — não pule direto pro código.
2. Feche o tutorial e tente reproduzir o código sozinho, usando só os nomes dos conceitos.
3. Use o **tutorial** como gabarito, para comparar com o que você fez.
4. No fim, responda as perguntas de "verifique seu entendimento" sem consultar o material.

## Módulo 01 — Panorama do mercado e OpenRouter
> Aulas sem código (01, 02) têm só artigo, com o exercício prático incorporado nele — tutorial
> separado é reservado para aulas com implementação de verdade.
- [x] [01. Panorama do mercado de IA generativa](modulo01/01-artigo-panorama-mercado-ia-generativa.md) (artigo + exercício)
- [x] [02. Onde estão as oportunidades](modulo01/02-artigo-oportunidades-engenheiro-ia-aplicada.md) (artigo + exercício)
- [x] [03. OpenRouter na prática (parte 1)](modulo01/03-artigo-openrouter-fundamentos.md) · [tutorial](modulo01/03-tutorial-openrouter-fastify-typescript.md)
- [x] [04. OpenRouter na prática (parte 2)](modulo01/04-artigo-selecao-de-modelo-por-custo-e-desempenho.md) · [tutorial](modulo01/04-tutorial-openrouter-service-e-testes.md)
- [x] [05. Anotação: projeto smart-model-router-gateway explicado linha a linha](modulo01/05-anotacao-projeto-smart-model-router-gateway.md) (projeto implementado em `docs/Projetos/01-openrouter`)

## Módulo 02 — LangChain e LangGraph
> As 5 aulas constroem o mesmo grafo evoluindo passo a passo (estado → primeiro node → nodes
> lineares → pipeline condicional → fallback), mas aqui cada aula tem seu próprio artigo +
> tutorial (em vez de combinadas), com o código completo explicado **linha a linha** em cada
> tutorial. Havia uma versão anterior em `docs/modulo02/` — foi substituída por esta.
- [x] [01. Introdução ao LangChain](modulo02/01-artigo-introducao-langchain-langgraph.md) · [tutorial](modulo02/01-tutorial-configurando-langchain-langgraph.md)
- [x] [02. Gerenciando estados e primeiro node](modulo02/02-artigo-estado-e-primeiro-node.md) · [tutorial](modulo02/02-tutorial-estado-e-primeiro-node.md)
- [x] [03. Criando estrutura inicial de nodes e edges](modulo02/03-artigo-nodes-e-edges-lineares.md) · [tutorial](modulo02/03-tutorial-nodes-e-edges-lineares.md)
- [x] [04. Pipeline condicional e testes automatizados](modulo02/04-artigo-pipeline-condicional-e-testes.md) · [tutorial](modulo02/04-tutorial-pipeline-condicional-e-testes.md)
- [x] [05. Node de fallback e ajustes finais](modulo02/05-artigo-fallback-e-ajustes-finais.md) · [tutorial](modulo02/05-tutorial-fallback-e-ajustes-finais.md)
- [x] [06. Anotação: grafo LangGraph explicado linha a linha](modulo02/06-anotacao-projeto-grafo-langgraph.md) (projeto implementado em `docs/curso-apis-ia-generativa/modulo02/project`)

## Módulo 03 — Interpretação de intenção
> As 4 aulas constroem um único projeto contínuo (mesmo agente evoluindo aula a aula), por isso
> viraram 1 artigo + 1 tutorial combinados, em vez de 4 pares separados quase idênticos.
- [x] [01-04. JSON estruturado, agentes e agendamento/cancelamento](modulo03/01-artigo-json-estruturado-e-agentes.md) · [tutorial](modulo03/01-tutorial-agendamento-cancelamento-com-langgraph.md)
- [x] [02. Anotação: agente de agendamento/cancelamento explicado linha a linha](modulo03/02-anotacao-projeto-agendamento-cancelamento.md) (projeto implementado em `docs/curso-apis-ia-generativa/modulo03/project`)
- [x] [03. Quiz de revisão do módulo 3](modulo03/03-quiz-revisao-modulo03.md)

## Módulo 04 — Recomendação e memória
> Mesmo padrão dos módulos 2 e 3: as 4 aulas constroem 1 projeto contínuo (recomendador de
> música), viraram 1 artigo + 1 tutorial combinados.
- [x] [01-04. Memória, preferências e resumo de histórico](modulo04/01-artigo-memoria-preferencias-e-resumo.md) · [tutorial](modulo04/01-tutorial-recomendador-de-musica-com-memoria.md)
- [x] [02. Anotação: recomendador de música com memória explicado linha a linha](modulo04/02-anotacao-projeto-recomendador-musica-memoria.md) (projeto implementado em `docs/curso-apis-ia-generativa/modulo04/project`)
- [x] [03. Quiz de revisão do módulo 4](modulo04/03-quiz-revisao-modulo04.md)

## Módulo 05 — Segurança de prompts
> Mesmo padrão: 1 demonstração contínua de ataque (prompt injection via MCP) e defesa
> (guardrails), viraram 1 artigo + 1 tutorial combinados.
- [x] [01-04. Prompt injection e guardrails](modulo05/01-artigo-prompt-injection-e-guardrails.md) · [tutorial](modulo05/01-tutorial-guardrails-com-mcp-filesystem.md)
- [x] [02. Anotação: agente com guardrails e MCP filesystem explicado linha a linha](modulo05/02-anotacao-projeto-guardrails-mcp-filesystem.md) (projeto implementado em `docs/curso-apis-ia-generativa/modulo05/project`)
- [x] [03. Quiz de revisão do módulo 5](modulo05/03-quiz-revisao-modulo05.md)

## Módulo 06 — Grafos de conhecimento (Neo4j/Cypher)
> Mesmo padrão: as 5 aulas constroem 1 único agente de relatórios (text-to-Cypher com
> multi-step e auto-correção), viraram 1 artigo + 1 tutorial combinados.
- [x] [01-05. Agente de relatórios com Neo4j](modulo06/01-artigo-text-to-cypher-multi-step-reasoning.md) · [tutorial](modulo06/01-tutorial-agente-de-relatorios-com-neo4j.md)

## Módulo 07 — Multimodalidade e observabilidade
> As 2 aulas são panorama conceitual (projetos de referência já prontos, sem build passo a
> passo), então viraram só 1 artigo — sem tutorial separado, seguindo a regra do topo deste
> README.
- [x] [01-02. Multimodalidade e observabilidade](modulo07/01-artigo-multimodalidade-e-observabilidade.md)
