---
title: "Arestas condicionais: o fluxo que se ramifica de verdade"
modulo: 2
aula: 4
tipo: artigo
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [langgraph, conditional-edges, tdd]
fonte: docs/scrap/platos-legendas/output/curso-14082629/02-modulo-02/04-criando-pipeline-compl.md
---
# Arestas condicionais: o fluxo que se ramifica de verdade

> Aula "Criando pipeline completo com fluxos condicionais e testes automatizados".
> Continuação de [Da caixa vazia à lógica de verdade: identifyIntent e chatResponse](03-artigo-nodes-e-edges-lineares.md).

## Onde a gente parou

Na aula anterior, `identifyIntent` já calculava um `command` (`"upper"`, `"lower"` ou indefinido) a partir do texto recebido — mas esse valor ainda não influenciava em nada o caminho percorrido pelo grafo, que continuava sendo uma linha reta até `chatResponse`. Essa aula finalmente usa esse `command` para **desviar o fluxo de verdade**, além de criar os dois nós que fazem a transformação de texto propriamente dita.

## Dois nós quase idênticos: `upperCaseNode` e `lowerCaseNode`

Antes de mexer no roteamento, a aula cria os nós que efetivamente processam o texto: um aplica `.toUpperCase()`, o outro `.toLowerCase()`, cada um atualizando o campo `output` do estado. São nós propositalmente simples e "burros" — cada um faz **uma única coisa**, sem se preocupar com formatação de resposta (isso continua sendo trabalho do `chatResponse`) nem com decidir se deveria ser chamado ou não (isso é trabalho da aresta condicional).

Essa separação de responsabilidades é o que torna o grafo fácil de testar em pedaços: dá para confirmar que `upperCaseNode` faz exatamente o que promete, sem precisar rodar o grafo inteiro.

## A aresta condicional: uma função que decide o destino

Até aqui, toda aresta criada era **fixa**: "depois de A, sempre vai para B". Uma **aresta condicional** (*conditional edge*) é diferente — em vez de um destino fixo, ela usa uma função que **olha o estado e decide, na hora, para qual nó ir**.

A função de decisão, nessa aula, é só um `switch` sobre `state.command`: se for `"upper"`, vai para o nó de maiúsculo; se for `"lower"`, vai para o de minúsculo; qualquer outro caso (inclusive `command` indefinido) cai num caminho padrão — que, por enquanto, ainda não existe como nó de verdade (isso é criado só na próxima aula, o `fallbackNode`).

Esse é um padrão comum em qualquer sistema que decide **para onde ir** baseado em algum critério: sempre existe um caso "padrão" (o `default` do `switch`) cobrindo tudo que não bate com as opções esperadas — nunca deixar esse caso sem tratamento é o que evita que o sistema trave diante de uma entrada inesperada.

## Como o grafo passa a se desenhar

Depois de registrar a aresta condicional, o grafo deixa de ser uma linha reta e passa a ter uma ramificação visível no LangGraph Studio: a partir de `identifyIntent`, três setas diferentes podem ser seguidas (uma para cada valor possível de `command`, incluindo o caso padrão), e todas elas convergem de novo no mesmo lugar — `chatResponse` — antes de terminar. Esse formato de "leque que se abre e depois converge" é extremamente comum em agentes de IA: várias estratégias de processamento diferentes, mas sempre passando pelo mesmo ponto final de formatação de resposta.

## Testes: confirmando cada rota isoladamente

Seguindo o mesmo estilo de TDD (*test-driven development*) já usado nos módulos anteriores, cada rota do fluxo condicional ganha seu próprio teste: um envia um texto pedindo "upper case" e espera a resposta toda em maiúsculo; outro pede "lower case" e espera o oposto. Isso confirma, de ponta a ponta (da requisição HTTP até a resposta), que o roteamento está funcionando — não só que a função de decisão devolve a string certa, mas que o grafo inteiro, executado via API, produz o resultado esperado.

## Um detalhe chato de import que gera erro silencioso

Ao criar vários arquivos novos de nó em sequência, é fácil esquecer a extensão `.ts` nos imports relativos entre eles — e o efeito não é um erro de tipo bonitinho, é um erro de "módulo não encontrado" só ao rodar os testes. Vale conferir sistematicamente as extensões de import toda vez que um novo arquivo é criado e o projeto começa a reclamar do nada.

## Fechando o raciocínio

Com `upperCaseNode`, `lowerCaseNode` e a aresta condicional registrados, o grafo já processa de verdade dois dos três caminhos possíveis. Falta só o terceiro — o que acontece quando `command` não é nem `"upper"` nem `"lower"` — que é justamente o assunto da [próxima aula](05-artigo-fallback-e-ajustes-finais.md).

Para o passo a passo com o código completo explicado linha a linha, veja o [tutorial complementar](04-tutorial-pipeline-condicional-e-testes.md).
