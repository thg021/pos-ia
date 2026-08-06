---
title: "Tutorial: configurando o primeiro projeto LangChain + LangGraph"
modulo: 2
aula: 1
tipo: tutorial
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [langchain, langgraph, langsmith, setup-de-projeto, nodejs]
fonte: docs/scrap/platos-legendas/output/curso-14082629/02-modulo-02/01-introducao-ao-langchai.md
---
# Tutorial: configurando o primeiro projeto LangChain + LangGraph

> Antes de seguir esse tutorial, vale a pena ler o [artigo introdutório](01-artigo-introducao-langchain-langgraph.md) pra entender o que é cada peça (LangChain, LangGraph, LangSmith).
>
> Requisito do repositório: **Node.js 22+** (a aula usa Node 24 — confira sua versão com `node -v` antes de começar).

## O que você vai ter no final

Um projeto Node.js rodando localmente, conectado ao LangGraph Studio (a interface visual que mostra o "fluxograma" da sua aplicação), com monitoramento gratuito no LangSmith. Ainda **sem IA de verdade** — essa parte fica pras próximas aulas. Aqui o foco é a fundação.

## Passo 1 — Criar uma conta e uma API Key no LangSmith

1. Acesse o site do LangSmith e crie uma conta (ou faça login).
2. No menu, procure **Settings** (Configurações).
3. Clique em **API Key** → dê um nome pra ela (pode ser algo como `pos-graduacao`, só pra você identificar depois).
4. Não precisa selecionar um workspace específico nem preencher descrição — pode deixar em branco.
5. Clique em **Create**.
6. **Copie a chave gerada na hora** e guarde num lugar seguro (um gerenciador de senhas, por exemplo). Você não vai conseguir ver essa chave de novo depois de fechar a tela.

> **Dica de segurança (vale pra qualquer API key, não só essa):** no dia a dia profissional, o ideal é que chaves de API sejam **rotacionadas** periodicamente — por exemplo, gerar uma nova a cada 30 ou 90 dias, com alguma automação que atualiza o ambiente de produção sozinha. Assim, se uma chave antiga vazar, ela já não serve mais pra ninguém usar seus créditos sem permissão.

## Passo 2 — Preparar a pasta do projeto

Dentro da pasta do módulo 2 do curso, crie uma nova pasta pro projeto (seguindo a numeração usada no repositório, algo como `02-langchain`).

Copie dois arquivos que você já usou no módulo anterior:

- O `tsconfig.json` (configuração do TypeScript, só para o editor entender os tipos).
- O `.env.example` (modelo de variáveis de ambiente — sem valores reais, só os nomes).

Confira a versão do Node instalada:

```bash
node -v
```

Se não for a mesma versão usada no curso (Node 24, ou pelo menos 22+ como exige este repositório), instale/troque antes de continuar.

## Passo 3 — Configurar as variáveis de ambiente

Duplique o `.env.example` e renomeie a cópia para `.env` (esse arquivo **não é versionado no Git** — ele fica só na sua máquina, porque guarda segredos).

Você vai precisar de três variáveis relacionadas ao LangSmith. Os nomes exatos aparecem na documentação oficial do LangSmith, na seção "Open Source" → "LangSmith" (o nome pode variar ligeiramente de versão para versão da doc, então sempre confira lá):

```bash
# .env
LANGSMITH_API_KEY=cole_aqui_a_chave_que_voce_copiou_no_passo_1
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=02-langchain
```

Linha a linha:

- `LANGSMITH_API_KEY`: a chave que você gerou no Passo 1. É o que autentica seu projeto local com a conta do LangSmith.
- `LANGSMITH_TRACING=true`: liga o **tracing** (rastreamento) — é essa variável que faz o LangChain mandar, automaticamente, cada execução do grafo pro painel do LangSmith. Se ela estiver ausente ou `false`, o código roda igual, mas você não vê nada no painel.
- `LANGSMITH_PROJECT`: o nome do projeto como ele vai aparecer lá no painel — pode usar o mesmo nome da pasta, pra não se perder depois quando tiver vários projetos do curso rodando.

Nessa aula específica você **não precisa** de uma chave da OpenAI (tipo `OPENAI_API_KEY`), porque ainda não estamos chamando nenhum modelo de IA. Mesmo assim, é comum deixar a variável no `.env.example` como referência para quem for reaproveitar o projeto depois.

## Passo 4 — Iniciar o projeto Node.js

Dentro da pasta `02-langchain`:

```bash
npm init -y
```

Instale o Fastify (o mesmo framework de API usado no módulo anterior) e as bibliotecas do LangChain, **nas versões exatas usadas no curso** — isso importa porque a área de IA muda muito rápido e versões diferentes podem ter comportamento diferente:

```bash
npm install fastify
npm install langchain@0.1.19
npm install @langchain/langgraph@0.2.17
```

- `fastify`: o servidor HTTP — o mesmo papel que já teve no módulo 1.
- `langchain@0.1.19`: o pacote "guarda-chuva" do LangChain, com os tipos de mensagem (`HumanMessage`, `AIMessage`, `SystemMessage`) e outras utilidades.
- `@langchain/langgraph@0.2.17`: o pacote específico do LangGraph — é dele que vêm `StateGraph`, `START`, `END`, que você vai usar para montar o grafo no próximo tutorial.

> Se algum desses pacotes já tiver uma versão mais nova quando você for fazer o curso, tudo bem seguir a versão mais recente — só tenha em mente que o comportamento pode divergir um pouco do que aparece na aula gravada.

## Passo 5 — Gerar um projeto de exemplo (só para referência)

O pacote de linha de comando do LangGraph consegue gerar um projeto de exemplo pronto, com boilerplate (código inicial padrão). Vale a pena rodar isso **fora** da pasta principal, só pra explorar:

```bash
npx create-langgraph
```

Durante o assistente interativo:

- Dê um nome ao projeto de exemplo (ex.: `my-app`).
- Escolha o tipo de projeto — opções comuns incluem um chatbot simples, um agente com padrão *ReAct*, ou exemplos com memória. Para só explorar a estrutura, escolha a opção mais simples (**new graph project**).
- Aceite inicializar com Git se for perguntado.

Entre na pasta gerada e instale as dependências:

```bash
cd my-app
npm install
```

Se o comando seguinte pedido pelo assistente (algo como `npx @langchain/langgraph-cli dev`) reclamar que não encontrou um arquivo `.env`, crie um vazio e rode de novo:

```bash
touch .env
npx @langchain/langgraph-cli dev
```

Isso deve abrir automaticamente uma aba no navegador com o **LangGraph Studio** rodando localmente.

## Passo 6 — Explorar o LangGraph Studio

Na interface que abriu:

1. Você vai ver um **grafo** (um desenho com caixinhas conectadas por setas) — é o fluxo da aplicação de exemplo.
2. Tem um campo de **chat** ao lado. Digite qualquer coisa, tipo `hello world`.
3. Repare que a resposta é bem rápida e, no fundo, é só um eco — o projeto de exemplo não usa nenhuma IA de verdade, só demonstra o mecanismo de ida e volta.
4. Isso já mostra a grande vantagem do Studio: você **não precisa construir um frontend completo** só pra testar seu fluxo de IA enquanto desenvolve. O Studio serve como uma interface de teste pronta.

## Passo 7 — Aproveitar só o essencial do projeto gerado

O projeto de exemplo gerado pelo `create-langgraph` costuma vir com algumas escolhas que talvez você não queira copiar direto:

- Usa o Jest como executor de testes, mesmo sem ter testes de verdade escritos (o Node já tem um executor de testes nativo, que é o padrão usado neste repositório).
- Vem fixado numa versão **beta** mais antiga do LangChain (a série `0.3.x`), enquanto o ideal para produção é a versão estável mais recente (`1.x`).

Por isso, a recomendação é: **não copie o projeto de exemplo inteiro**. Copie apenas o arquivo `langgraph.json` para a raiz do seu projeto real (`02-langchain`).

Exemplo de como esse arquivo costuma se parecer:

```json
{
  "graphs": {
    "agent": "./src/graph/graph.ts:graph"
  },
  "env": ".env"
}
```

Linha a linha:

- `"graphs"`: um objeto onde cada chave é um **nome de grafo** (aqui, `"agent"` — é só um rótulo, pode ser qualquer string) e o valor diz **onde encontrar a função exportada que representa esse grafo**.
- `"./src/graph/graph.ts:graph"`: o formato é `caminho/do/arquivo.ts:nomeDaExportação`. Ou seja, o LangGraph vai abrir `src/graph/graph.ts` e procurar por um `export` chamado `graph`. Sem esse arquivo apontando pro lugar certo (e sem essa exportação existindo), o LangGraph Studio não consegue achar o seu código e vai dar erro.
- `"env": ".env"`: diz ao LangGraph Studio para carregar as variáveis de ambiente desse arquivo antes de rodar — é assim que `LANGSMITH_API_KEY` e companhia chegam até o processo.

(O caminho exato depende de como você organizar as pastas do seu projeto — o importante é que ele aponte pra onde a função exportada realmente está. No [próximo tutorial](02-tutorial-grafo-langgraph-api.md), essa função `graph` é criada dentro de um arquivo `factory.ts`.)

Depois de copiar o `langgraph.json`, você pode apagar a pasta de exemplo (`my-app`) — ela já cumpriu o papel de te mostrar a estrutura e te dar esse arquivo de configuração.

## Onde isso te deixa

Com o `.env` configurado, as dependências instaladas e o `langgraph.json` apontando pro lugar certo, você tem a fundação pronta para, na próxima aula, começar a escrever de fato os nós do grafo (as funções que vão conversar com um modelo de IA, aplicar condicionais no fluxo e assim por diante).

## Verifique seu entendimento

1. Qual é a diferença entre `LANGSMITH_TRACING` e `LANGSMITH_PROJECT` — o que cada uma controla?
2. Por que a aula recomenda copiar só o `langgraph.json` do projeto gerado por `create-langgraph`, em vez do projeto inteiro?
3. No `langgraph.json`, o que significa o valor `"./src/graph/graph.ts:graph"`?
4. Por que essa aula não precisa de uma `OPENAI_API_KEY` no `.env`?
