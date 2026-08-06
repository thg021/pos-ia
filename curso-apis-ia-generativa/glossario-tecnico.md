---
title: "Glossário técnico — Curso APIs de IA Generativa e Prompt Engineering"
tipo: glossario
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
---

# Glossário técnico

Todos os termos técnicos usados nos 7 módulos do curso, em ordem alfabética. Cada entrada indica em qual módulo o termo aparece primeiro — mas muitos conceitos (Zod, LangGraph, testes) atravessam vários módulos.

---

**`addConditionalEdges(origem, funçãoRoteamento, mapa)`** *[Módulo 2]*
Método do `StateGraph` que registra uma aresta condicional: recebe o nó de origem, uma função que examina o estado e retorna uma string, e um mapa que traduz essa string para o identificador real do próximo nó.

**`addEdge(origem, destino)`** *[Módulo 2]*
Método do `StateGraph` que liga dois nós numa ordem fixa (sem ramificação).

**Agente (agent)** *[Módulo 3]*
Termo genérico para um fluxo (grafo) que interpreta uma entrada em linguagem natural, decide uma ação e executa contra sistemas reais, geralmente combinando extração de dados via LLM, validação e execução de lógica de negócio.

**AI como serviço** *[Módulo 1]*
Modelo de negócio em que provedores (OpenAI, Google, Anthropic) tratam LLMs como infraestrutura, cobrando por uso via API.

**`app.inject()`** *[Módulo 1]*
Recurso do Fastify que simula uma requisição HTTP completa sem precisar subir um servidor real nem ocupar porta de rede — usado nos testes automatizados do curso inteiro.

**Applied AI Engineer** *[Módulo 1]*
Perfil profissional focado em construir produtos, pipelines e integrações com LLM, cuidando de observabilidade, custo e segurança — o foco do curso, em oposição a quem só "usa IA para trabalhar mais rápido".

**Aresta (edge)** *[Módulo 2]*
Elemento do grafo que define a ordem de execução entre nós. Toda aresta liga uma origem a um destino; pode ser fixa (`addEdge`) ou condicional (`addConditionalEdges`).

**Aresta condicional (conditional edge)** *[Módulo 2]*
Aresta cujo destino não é fixo — uma função examina o estado em tempo de execução e decide para qual nó o fluxo vai.

**Auto-correção** *[Módulo 6]*
Padrão em que, ao falhar, o sistema reenvia o erro (com contexto) para um novo passo de LLM pedindo correção, em vez de desistir ou repassar o erro cru ao cliente. Se repete até um limite de tentativas configurável.

**`BaseMessage`** *[Módulo 2]*
Tipo base do LangChain para qualquer mensagem de uma conversa (`HumanMessage`, `AIMessage`, `SystemMessage` herdam dele).

**Business context (contexto de negócio)** *[Módulo 6]*
Regras de domínio (ex: "status pode ser paid/refunded") injetadas no prompt de geração de query, ajudando o modelo a gerar queries semanticamente corretas, não só sintaticamente válidas.

**Checkpointer** *[Módulo 4]*
Componente do LangGraph que guarda o estado do grafo por *thread* (conversa), permitindo retomar exatamente de onde parou. Distinto do `store`, que guarda dados entre threads diferentes do mesmo usuário.

**`.compile()`** *[Módulo 2]*
Método do `StateGraph` que transforma a descrição do grafo (nós e arestas) num objeto executável, com método `.invoke(...)`.

**`command`** *[Módulo 2]*
Campo do estado calculado por um nó de identificação de intenção, usado depois por uma aresta condicional para decidir o roteamento — o nó que calcula o campo não decide o roteamento sozinho.

**Configuração sobrescrevível (`configOverride`)** *[Módulo 1]*
Padrão em que um serviço aceita uma configuração padrão, mas permite sobrescrever parcialmente alguns campos (ex: só o `sort`) via merge raso (`{ ...defaultConfig, ...configOverride }`), sem duplicar toda a config em cada teste.

**`console.assert`** *[Módulo 1]*
Usado para falhar cedo, com mensagem clara, quando uma variável de ambiente obrigatória (ex: `OPENROUTER_API_KEY`) não está definida.

**Cypher** *[Módulo 6]*
Linguagem de consulta do Neo4j, usada para escrever queries contra o banco de grafos.

**Decomposição** *[Módulo 6]*
Quando uma pergunta é complexa demais para uma única query, o `query planner` a quebra em sub-perguntas menores, cada uma virando uma nova chamada ao gerador de query, em sequência.

**Distribuição (alcance)** *[Módulo 1]*
Fator apontado como tão importante quanto o produto em si para vencer no mercado de wrappers de IA — ter audiência/canal de aquisição.

**`EXPLAIN` (Cypher)** *[Módulo 6]*
Prefixo colocado antes de uma query Cypher para validar sua sintaxe sem executá-la de fato — o Neo4j monta o plano de execução e retorna erro se a query for inválida, sem tocar nos dados.

**Evaluation** *[Módulo 7]*
Prática de atribuir pontuações de qualidade a respostas de LLM de forma sistemática, já que comparação exata de string não é suficiente para validar qualidade (as respostas não são determinísticas). Pode ser integrada a pipelines de CI/CD.

**Fallback (nó de)** *[Módulo 2]*
Nó que trata o caso "nenhuma condição bateu" — o caminho padrão de uma aresta condicional quando o campo de roteamento não corresponde a nenhum caso esperado.

**Fastify** *[Módulo 1]*
Framework HTTP usado no curso para expor as rotas da API (`/chat`), com suporte nativo a validação de schema do corpo da requisição.

**Founder Engineer** *[Módulo 1]*
Pessoa que entra em um projeto tão cedo que decide stack, padrões e arquitetura desde o zero — normalmente compensado com equity pelo risco assumido.

**Gateway** *[Módulo 1]*
Metáfora usada para o OpenRouter: o código fala com o gateway, que decide (ou deixa o critério configurado decidir) qual modelo real responde.

**Grafo (graph)** *[Módulo 2]*
Estrutura que organiza o fluxo de uma aplicação como nós conectados por arestas, com um ponto de entrada (`START`) e um ou mais pontos de saída (`END`).

**Guardrails** *[Módulo 5]*
Camada de verificação separada e anterior a qualquer execução de ferramenta — um nó dedicado que decide se a entrada é segura (`safe`) ou suspeita (`unsafe`) antes do agente principal ter acesso a qualquer ferramenta.

**`HumanMessage` / `AIMessage` / `SystemMessage`** *[Módulo 2]*
Tipos de mensagem do LangChain, representando papéis numa conversa: usuário, modelo de IA e instrução de sistema, respectivamente.

**Human-in-the-loop** *[Módulo 2]*
Recurso do LangGraph (citado como extensão, não implementado no curso) que faz o fluxo parar e esperar uma decisão humana antes de continuar.

**Injeção de dependência** *[Módulo 1]*
Princípio de passar serviços (ex: `OpenRouterService`) como parâmetro para quem os usa (ex: a factory que cria as rotas), em vez de instanciá-los internamente — facilita testes com configuração diferente.

**`LANGSMITH_TRACING`** *[Módulo 2]*
Variável de ambiente que liga o rastreamento (tracing) das execuções do grafo para o painel do LangSmith. Sem ela, o código roda igual, só sem visibilidade no painel.

**LangChain** *[Módulo 2]*
Biblioteca/framework para encadear etapas de uma aplicação de IA (prompts, modelos, parsing de saída).

**LangFuse** *[Módulo 7]*
Ferramenta de observabilidade (open source, com opção de self-hosting) especializada em *tracing* de aplicações de IA — registra o caminho completo de uma requisição, operação por operação, com tempo e custo.

**LangGraph** *[Módulo 2]*
Extensão do LangChain para organizar fluxos como um grafo com desvios (arestas condicionais) e memória (checkpoints).

**LangGraph Studio** *[Módulo 2]*
Interface visual local que desenha o grafo da aplicação e permite interagir por chat, inspecionando o estado (JSON) em cada etapa — sem precisar construir um frontend.

**LangSmith** *[Módulo 2]*
Plataforma de observabilidade/rastreamento na nuvem que mostra o que aconteceu por trás dos panos de uma execução do LangChain/LangGraph.

**LLM Engineer** *[Módulo 1]*
Termo próximo de Applied AI Engineer, usado em vagas reais do mercado.

**`mergePreferences`** *[Módulo 4]*
Padrão de persistência que mescla dados novos com os já existentes (em vez de sobrescrever tudo), preservando informação extraída em conversas anteriores.

**Multimodal (modelo)** *[Módulo 7]*
Modelo que recebe (e às vezes produz) mais do que texto — imagens, documentos, áudio, vídeo.

**`needsSummarization`** *[Módulo 4]*
Campo do estado calculado comparando o tamanho do histórico de mensagens com um limite configurável, decidindo se o histórico deve ser resumido.

**Neo4j** *[Módulo 6]*
Banco de dados orientado a grafos, escolhido no módulo 6 por tornar relações entre dados mais naturais de consultar do que um banco relacional.

**Nó (node)** *[Módulo 2]*
Unidade do grafo: uma função que recebe o estado atual, processa e sempre devolve o estado (atualizado ou não). Todo nó no LangGraph tem a assinatura `(state) => state`.

**Node.js 22+/24+ com TypeScript nativo** *[Módulo 1]*
Versões recentes do Node executam arquivos `.ts` diretamente, ignorando anotações de tipo em runtime, sem gerar `.js` intermediário.

**`node --env-file .env`** *[Módulo 1]*
Flag nativa do Node para carregar variáveis de ambiente de um arquivo `.env`, sem depender de biblioteca externa (como `dotenv`).

**`node --test`** *[Módulo 1]*
Test runner nativo do Node.js, usado no curso inteiro sem dependências externas de teste.

**`node --watch`** *[Módulo 1]*
Modo watch nativo do Node que reinicia o processo automaticamente a cada alteração salva (live reload).

**NVM (Node Version Manager)** *[Módulo 1]*
Ferramenta recomendada para trocar de versão do Node (`nvm use 24`).

**OpenRouter** *[Módulo 1]*
Serviço que expõe uma API única na frente de dezenas de modelos de LLM de provedores diferentes, funcionando como um gateway/roteador.

**OpenTelemetry** *[Módulo 7]*
Padrão de instrumentação de observabilidade de software em geral (não exclusivo de IA), usado para integrar ferramentas como o LangFuse sem reescrever a instrumentação do zero.

**Optional chaining (`?.`) e nullish coalescing (`??`)** *[Módulo 1]*
Operadores usados juntos (ex: `lastMessage?.text ?? ""`) para nunca deixar um valor `undefined` vazar sem tratamento.

**Papéis de mensagem** *[Módulo 2]*
Ver `HumanMessage` / `AIMessage` / `SystemMessage`.

**`Partial<T>`** *[Módulo 1]*
Tipo utilitário do TypeScript usado para aceitar um objeto de configuração parcial/opcional (ex: `configOverride`).

**Prompt injection** *[Módulo 5]*
Técnica de manipular a entrada de um agente de IA para fazer com que ele ignore as instruções originais (system prompt) e siga instruções diferentes, inseridas pelo próprio usuário. Análoga a SQL injection.

**Prompt management** *[Módulo 7]*
Prática de versionar e comparar prompts fora do código da aplicação, permitindo testar variações sem precisar de deploy de código novo.

**`PromptTemplate`** *[Módulo 5]*
Mecanismo do LangChain para montar prompts com dados vindos do usuário, preferível a concatenação manual de string por já cuidar de sanitização básica.

**`Query planner`** *[Módulo 6]*
Primeiro nó do fluxo text-to-Cypher, que decide se a pergunta pode ser respondida com uma única query (caso simples) ou precisa ser decomposta em sub-perguntas (caso complexo).

**Realtime (modelo)** *[Módulo 7]*
Modelo de IA que mantém uma conexão contínua (WebRTC, WebSocket, VoIP), escutando e respondendo em tempo real, sem o ciclo tradicional de requisição/resposta.

**Recursão, limite de** *[Módulo 6]*
Proteção nativa do LangGraph que interrompe a execução de um grafo com ciclos (ex: gerador ↔ executor) caso ele nunca converta para uma condição de parada, evitando loop infinito.

**`RemoveMessage`** *[Módulo 4]*
Tipo especial do LangGraph que, incluído no retorno de um nó, instrui o *reducer* de mensagens a remover uma mensagem específica do estado acumulado — usado para "podar" o histórico depois de um resumo.

**`response.choices?.[0]?.message?.content ?? ""`** *[Módulo 1]*
Padrão defensivo (optional chaining + nullish coalescing) usado para nunca quebrar se a resposta do modelo vier vazia.

**Resultado explícito (`{ success, data | error }`)** *[Módulo 3]*
Padrão de retorno em que uma função nunca deixa uma exceção "vazar" — sempre devolve um objeto indicando sucesso (com `data`) ou falha (com `error`), obrigando quem chama a tratar os dois casos.

**Roteamento condicional (routing)** *[Módulo 2]*
Função (não um nó) que recebe o estado e retorna uma string identificando o próximo nó, usada dentro de `addConditionalEdges`.

**`safeguard` (modelo)** *[Módulo 5]*
Modelo de IA dedicado a detectar tentativas de manipulação/prompt injection, geralmente menor (menos parâmetros) e com latência mais baixa que modelos de propósito geral.

**`schema.body` (Fastify)** *[Módulo 1]*
Configuração de rota do Fastify que valida automaticamente o corpo da requisição antes do handler rodar.

**`sort` (OpenRouter)** *[Módulo 1]*
Campo de configuração que define o critério de ordenação de modelos candidatos: `"price"` (mais barato primeiro), `"throughput"` (mais tokens/segundo primeiro), entre outros.

**Spread operator (`...state`)** *[Módulo 2]*
Padrão de imutabilidade: copia o estado atual num objeto novo, sobrescrevendo só os campos alterados, em vez de mutar o objeto original diretamente.

**`START` / `END`** *[Módulo 2]*
Pontos especiais de entrada e saída de todo grafo LangGraph.

**`StateGraph`** *[Módulo 2]*
Classe do LangGraph usada para montar um grafo: registra nós (`.addNode`) e arestas (`.addEdge` / `.addConditionalEdges`) antes de ser compilado (`.compile()`).

**Store** *[Módulo 4]*
Componente do LangGraph que guarda dados que precisam sobreviver entre threads/conversas diferentes do mesmo usuário — distinto do `checkpointer`, que é por thread.

**Streaming** *[Módulo 1, implícito]*
Modo de resposta de um LLM em que o texto é enviado em pedaços à medida que é gerado (mencionado como `stream: false` nas chamadas do curso, que usam resposta completa de uma vez).

**Text-to-Cypher / text-to-query** *[Módulo 6]*
Padrão em que uma pergunta em linguagem natural é convertida, via LLM, numa query de banco de dados gerada dinamicamente — extensão do padrão de output estruturado (módulo 3) aplicado a queries.

**Throughput** *[Módulo 1]*
Taxa de tokens por segundo de um modelo — um dos critérios de ordenação de modelos no OpenRouter.

**Tracing** *[Módulo 2, 7]*
Registro do caminho completo de uma execução (que operação rodou, em que ordem, quanto tempo levou, quanto custou) — usado tanto no LangSmith/Studio (módulo 2) quanto no LangFuse (módulo 7).

**Wrapper** *[Módulo 1]*
Aplicação cujo diferencial é quase inteiramente a chamada a um modelo de LLM de terceiros — trocando o modelo, o produto continua funcionando quase igual.

**`withStructuredOutput(schema)`** *[Módulo 3]*
Método do LangChain que instrui o modelo a devolver dados já validados contra um schema Zod, sem precisar chamar `JSON.parse` manualmente.

**Zod** *[Módulo 2]*
Biblioteca de validação usada para descrever o formato do estado do grafo e de schemas de saída estruturada. O curso usa `zod@3` de propósito, por incompatibilidades conhecidas de versões mais novas com certas integrações do LangChain no momento da gravação.
