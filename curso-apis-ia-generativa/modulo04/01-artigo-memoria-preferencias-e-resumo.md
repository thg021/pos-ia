---
title: "Memória em agentes de IA: preferências, histórico e resumo"
modulo: 4
aula: [1, 2, 3, 4]
tipo: artigo
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [memoria, langgraph, postgres, sqlite, resumo-de-contexto, personalizacao]
fonte: docs/scrap/platos-legendas/output/curso-14082629/04-modulo-04/
---

# Memória em agentes de IA: preferências, histórico e resumo

> Este artigo cobre as 4 aulas do módulo (recomendador de música, extração de preferências, armazenamento de memória, resumo de histórico) porque, assim como no módulo 3, elas constroem um único projeto contínuo — um assistente de recomendação musical que vai "conhecendo" o cliente ao longo da conversa.

## O problema: contexto tem um limite, e ele custa dinheiro

Todo modelo de LLM tem uma **janela de contexto** — um limite de quantos tokens ele consegue "ver" por chamada. Se você simplesmente for empilhando todo o histórico de uma conversa longa dentro do prompt, dois problemas aparecem: o custo por chamada sobe (mais tokens = mais caro) e, eventualmente, você estoura o limite da janela. Este módulo é sobre como lidar com isso de forma estruturada, em vez de simplesmente "jogar tudo no prompt e torcer".

## Dois tipos de memória, dois problemas diferentes

O módulo separa memória em duas categorias que resolvem problemas distintos:

- **Memória de curto prazo (short-term memory):** o histórico de mensagens de uma conversa específica (uma *thread*). Serve para o modelo lembrar o que foi dito há poucas mensagens, dentro da mesma sessão.
- **Memória de longo prazo (long-term memory):** informações que persistem **entre conversas diferentes** — as preferências de um cliente específico (nome, idade, gêneros musicais favoritos, bandas que gosta), que continuam disponíveis mesmo que o cliente volte dias depois e comece uma conversa nova.

Essa distinção importa porque cada uma tem uma estratégia de armazenamento diferente: o histórico de conversas tende a crescer (e precisa ser gerenciado/resumido), enquanto as preferências tendem a ser um conjunto pequeno e estável de fatos sobre o cliente — que pode (e deve) ser injetado em praticamente todo prompt, porque é barato em tokens e traz muito valor de personalização.

## Extraindo preferências como um efeito colateral da conversa

Em vez de fazer um formulário ou perguntar explicitamente "qual sua idade? qual seu gênero musical favorito?", o agente **extrai preferências implicitamente** de qualquer coisa que o cliente diga — se ele mencionar "adoro Foo Fighters" no meio de uma pergunta sobre outra coisa, isso já é capturado e persistido. Tecnicamente, isso usa a mesma técnica de **output estruturado** do módulo anterior: a cada mensagem, um schema pergunta ao modelo "que preferências dá para extrair daqui, se houver alguma?" — e o resultado é mesclado com o que já se sabia sobre aquele cliente (atualizando, não duplicando, quando a informação muda).

## Onde cada tipo de dado é armazenado

O projeto do módulo usa **dois bancos de dados diferentes**, de propósito — para mostrar as opções disponíveis, não porque seja estritamente necessário:
- **PostgreSQL**: armazena o histórico completo de mensagens de cada conversa (via os mecanismos nativos do LangGraph de *checkpointer* e *store*), permitindo retomar exatamente de onde uma conversa parou.
- **SQLite** (com um query builder simples, não um ORM completo): armazena as preferências extraídas de cada cliente — um conjunto de dados pequeno, que é lido no início de cada conversa nova para "lembrar" quem é aquele cliente.

## O checkpoint: retomar uma conversa de onde parou

O conceito de **checkpoint** do LangGraph é o que permite a um cliente encerrar uma conversa e, dias depois, continuar exatamente de onde parou — sem perder contexto. Isso é feito automaticamente pelo framework quando você configura um *checkpointer* (nesse caso, apontando para o PostgreSQL) na hora de compilar o grafo.

## Resumindo o histórico: comprimir sem perder o essencial

A segunda metade do módulo resolve o problema de a conversa crescer demais: em vez de guardar cada mensagem trocada indefinidamente, o agente monitora o tamanho do histórico e, ao ultrapassar um limite configurável (ex: mais de 6 mensagens), **gera um resumo** do que já foi conversado — e substitui as mensagens antigas por esse resumo, mantendo só as últimas 1-2 mensagens "crua" no estado.

Esse resumo em si é gerado por outra chamada de LLM (com seu próprio schema), que recebe o histórico completo mais qualquer resumo anterior (se já existir um), e produz uma nova versão consolidada. Isso significa que o processo é **incremental**: a cada vez que o limite é atingido de novo, o resumo anterior é combinado com as mensagens novas, em vez de recomeçar do zero.

## Por que isso é importante em produção

O ponto central do módulo (reforçado várias vezes pelo instrutor) é que esse tipo de gestão de memória **não é opcional em uma aplicação real** — é algo que qualquer produto com conversas longas (assistentes, chatbots de suporte, agentes de vendas) precisa resolver, porque sem isso o custo por conversa cresce sem limite e, eventualmente, a aplicação simplesmente para de funcionar quando estoura a janela de contexto do modelo.

## Verifique seu entendimento

1. Qual a diferença entre memória de curto prazo e memória de longo prazo, e por que elas costumam usar armazenamentos diferentes?
2. Como o agente extrai preferências dos clientes sem usar um formulário explícito?
3. O que é um "checkpoint" no contexto do LangGraph, e que problema ele resolve?
4. Por que resumir o histórico é incremental (junta o resumo anterior com as mensagens novas) em vez de sempre resumir do zero?
5. O que aconteceria com o custo e a confiabilidade de uma aplicação de chat se ela nunca resumisse ou limitasse o histórico de conversa?
