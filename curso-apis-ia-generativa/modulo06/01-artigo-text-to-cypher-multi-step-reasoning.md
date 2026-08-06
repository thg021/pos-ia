---
title: "De pergunta em linguagem natural a query de grafo: multi-step reasoning"
modulo: 6
aula: [1, 2, 3, 4, 5]
tipo: artigo
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [neo4j, cypher, text-to-query, langgraph, multi-step, retry, self-correction]
fonte: docs/scrap/platos-legendas/output/curso-14082629/06-modulo-06/
---

# De pergunta em linguagem natural a query de grafo: multi-step reasoning

> Este artigo cobre as 5 aulas do módulo (template/arquitetura, query planner, cypher generator, cypher executor, correção e resposta analítica) — o projeto mais complexo do curso até aqui, construído de forma contínua ao longo das aulas.

## O problema: perguntas de negócio viram relatórios, sem dashboard fixo

O cenário do módulo é um sistema de vendas de cursos onde o cliente pode perguntar, em linguagem natural, coisas como "qual curso teve mais reembolsos?" ou "quais cursos costumam ser comprados juntos?". Em vez de construir dashboards fixos para cada pergunta possível, o agente **gera a query de banco de dados na hora**, a partir da pergunta — e qualquer pergunta nova, mesmo que ninguém tenha pensado nela antes, pode (em teoria) ser respondida sem escrever uma linha de código nova.

## Por que Neo4j (um banco de dados de grafos)

O módulo escolhe **Neo4j**, um banco orientado a grafos, em vez de um banco relacional (Postgres/MySQL) — não porque seja obrigatório para esse padrão (o mesmo texto → query também funciona com SQL), mas porque grafos tornam **relações entre dados** muito mais naturais de consultar e de visualizar: "quem comprou X também tende a comprar Y", "qual é o padrão de progresso de alunos com perfil parecido". A linguagem de consulta do Neo4j é o **Cypher**.

## O padrão central: text-to-query com validação e correção

A técnica é uma extensão do que já foi visto no módulo 3 (output estruturado): a pergunta do cliente vira, via LLM, uma **query gerada dinamicamente** — só que agora com uma camada extra de resiliência, porque gerar uma query sintaticamente válida é mais difícil para o modelo do que extrair alguns campos de um formulário. O fluxo lida com três desafios que não existiam nos módulos anteriores:

1. **A query pode ter erro de sintaxe** — precisa de um mecanismo de correção automática.
2. **A pergunta pode ser complexa demais para uma única query** — precisa ser decomposta em passos menores.
3. **O resultado bruto do banco de dados não é uma resposta apresentável** — precisa ser traduzido de volta para linguagem natural.

## Decomposição: quebrar perguntas complexas em sub-perguntas

O primeiro nó do fluxo (**query planner**) decide se a pergunta pode ser respondida com uma única query ("liste todos os cursos" — um único domínio de dados) ou se precisa ser **decomposta** em várias sub-perguntas menores ("compare o faturamento entre os cursos com mais e menos conclusão" — isso exige calcular médias, cruzar dados de vendas com dados de progresso, etc.). Quando decomposta, cada sub-pergunta vira, em sequência, uma nova chamada ao gerador de query — como se fosse um mini-pipeline dentro do pipeline principal.

Esse padrão de "pensar antes de agir, quebrando um problema grande em passos menores" é reaproveitável muito além de bancos de dados — o mesmo raciocínio se aplica a qualquer tarefa complexa demais para ser resolvida "de uma vez" por um modelo de LLM (edição de vídeo automatizada, geração de conteúdo em múltiplas etapas, etc.).

## Auto-correção: tratar a IA como algo que erra e se recupera

O segundo pilar do módulo é a **auto-correção**: se a query gerada falhar (erro de sintaxe, referência inválida), o sistema não desiste nem repassa o erro cru para o cliente — ele envia a query com erro de volta para outro nó de LLM, junto com a mensagem de erro e o schema do banco, pedindo para corrigir. Isso se repete até um número máximo de tentativas configurável, e só depois disso o sistema desiste e informa o cliente que não conseguiu.

Esse padrão espelha como ferramentas de IA para código já funcionam no dia a dia: tentar executar algo, ver que falhou, tentar de novo com o contexto do erro, em vez de parar na primeira falha.

## Limite de recursão como proteção contra loop infinito

Como o fluxo é literalmente um grafo com ciclos (planejador → gerador → executor → de volta ao gerador, se precisar de mais passos ou de correção), existe um risco real de loop infinito — por exemplo, se a condição de parada (quantidade de sub-perguntas já respondidas, ou tentativas de correção já esgotadas) não for calculada corretamente. O LangGraph tem uma proteção nativa (um limite de recursão padrão) que interrompe a execução e sinaliza erro em vez de rodar para sempre — uma rede de segurança, não uma substituição para desenhar corretamente as condições de parada.

## A etapa final: transformar dado bruto em resposta legível

Depois que todas as sub-perguntas foram respondidas (ou a pergunta simples foi resolvida em uma única query), um último nó recebe **todos os resultados acumulados** (a pergunta original, cada sub-pergunta, cada query executada, cada resultado) e gera um relatório em linguagem natural — a mesma ideia de "JSON → linguagem natural" que já apareceu nos módulos 3 e 4, agora aplicada a um conjunto de dados agregado ao longo de múltiplos passos, em vez de uma única resposta.

## Verifique seu entendimento

1. Por que o módulo usa um banco de dados de grafos em vez de um banco relacional para esse tipo de aplicação?
2. O que diferencia uma pergunta "simples" de uma "complexa" no critério usado pelo query planner?
3. Como funciona o mecanismo de auto-correção quando uma query gerada tem erro de sintaxe?
4. Por que existe um limite máximo de tentativas de correção, em vez de tentar indefinidamente até dar certo?
5. Por que o resultado bruto do banco de dados não pode simplesmente ser devolvido ao cliente final?
