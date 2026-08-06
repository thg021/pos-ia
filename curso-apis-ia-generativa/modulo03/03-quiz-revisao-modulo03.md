---
title: "Quiz de revisão — Módulo 3 (agendamento e cancelamento com output estruturado)"
modulo: 3
tipo: quiz
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [langgraph, structured-output, zod, openrouter, revisao, quiz]
---
# Quiz de revisão — Módulo 3

15 perguntas de múltipla escolha cobrindo as 4 aulas do módulo (structured output, identificação de intenção, agendamento/cancelamento, geração de mensagens). Gabarito no final — tenta responder tudo antes de olhar.

---

**1. Qual é a ideia central de "structured output" (saída estruturada)?**

a) Reescrever o prompt em letras maiúsculas, pedindo com mais ênfase que o modelo obedeça as instruções à risca
b) Pedir, dentro do texto do prompt, que o modelo devolva só JSON, sem nenhuma validação depois de receber a resposta
c) Descrever um schema, por exemplo com Zod, que define os campos esperados, e o modelo devolve dados já validados
d) Rodar várias expressões regulares sobre o texto de resposta, tentando isolar cada campo relevante manualmente depois

**2. O que `withStructuredOutput(schema)` evita que você tivesse que fazer manualmente?**

a) Chamar `JSON.parse` na resposta do modelo e validar esse resultado na mão contra um schema próprio
b) Configurar o cliente `ChatOpenAI` com a chave de API e a URL base do provedor usado na chamada
c) Declarar, no arquivo `.env`, as variáveis de ambiente exigidas antes de subir o servidor Fastify
d) Montar as arestas condicionais do grafo LangGraph que decidem qual será o próximo nó a executar

**3. Por que este módulo troca o SDK nativo do OpenRouter pelo SDK da OpenAI (`@langchain/openai`), apontando `baseURL` para o OpenRouter?**

a) Porque a equipe do OpenRouter descontinuou o próprio SDK e recomendou migrar oficialmente para o da OpenAI
b) Porque o OpenRouter passou a exigir, por contrato, que toda integração use exclusivamente bibliotecas da OpenAI
c) Porque o SDK da OpenAI oferece um período de uso gratuito bem maior do que o SDK nativo do OpenRouter
d) Porque o OpenRouter é compatível com a API da OpenAI, e esse SDK tem suporte mais maduro a output estruturado

**4. O que são "few-shot examples" dentro de um system prompt, e por que o módulo insiste neles?**

a) Trechos do código-fonte do projeto colados dentro do prompt, para o modelo entender a arquitetura do sistema
b) Casos concretos de entrada e saída esperada incluídos no prompt, que ajudam o modelo a acertar o formato certo
c) Testes automatizados que rodam antes de cada chamada à IA, conferindo se o schema Zod está correto
d) Uma lista de modelos alternativos configurada para o OpenRouter tentar automaticamente caso o modelo principal escolhido falhe na chamada

**5. O schema `IntentSchema` usa `.nullable().optional()` em vários campos, em vez de só `.optional()`. Por quê?**

a) Porque `.nullable()` deixa o código mais elegante de se ler, sem nenhum efeito no comportamento em tempo de execução
b) Porque o TypeScript, ao compilar um `z.object`, passou a exigir que todo campo opcional seja também nullable
c) Porque a API, em modo de output estruturado estrito, exige todo campo como obrigatório — `null` simula "opcional"
d) Porque `GraphStateSchema`, que descreve o estado do grafo inteiro, também declara esses mesmos campos como nullable

**6. Qual é o papel do node `identifyIntent`?**

a) Chamar a IA para extrair a intenção do texto do cliente e os dados relevantes, devolvendo isso como estado parcial
b) Executar diretamente o agendamento ou cancelamento da consulta contra o banco de dados, sem passar por nenhuma etapa de validação
c) Montar a mensagem final de resposta que será enviada de volta ao cliente pela rota HTTP
d) Verificar, a cada requisição recebida, se a chave de API configurada em `config.ts` ainda é válida

**7. Se a chamada de IA dentro de `identifyIntentNode` falhar (erro de rede, autenticação, etc.), o que o node faz?**

a) Deixa a exceção propagar sem tratamento, derrubando a requisição HTTP inteira com um erro 500
b) Trava o processo do servidor Fastify até que alguém reinicie a aplicação manualmente depois
c) Tenta chamar a IA de novo, em loop infinito, até obter uma resposta válida ou esgotar a memória
d) Captura o erro e devolve `intent: "unknown"` com o erro em `actionError`, seguindo o fluxo até um fallback

**8. Por que `scheduleNode` revalida os dados (`professionalId`, `dateTime`, `patientName`) com seu próprio schema Zod, mesmo que `identifyIntentNode` já os tenha extraído e validado?**

a) Porque o Zod, por padrão, sempre exige que todo campo obrigatório seja validado duas vezes em nodes diferentes do fluxo
b) Segue o princípio "confio, mas confiro": cada node trata a etapa anterior como não confiável, revalidando por conta própria
c) Porque `IntentSchema` e `ScheduleRequiredSchema` descrevem, na prática, exatamente os mesmos campos e regras de negócio
d) Porque isso é apenas um resquício de código deixado pelo tutorial original, sem necessidade real hoje

**9. O que acontece quando `appointmentService.bookAppointment` encontra um horário já ocupado para o mesmo profissional?**

a) O novo agendamento sobrescreve, sem aviso nenhum, o horário que já estava reservado para outro paciente
b) O sistema agenda mesmo assim, deixando os dois compromissos duplicados na mesma lista de consultas
c) Lança uma exceção, capturada pelo `scheduleNode`, que devolve `actionSuccess: false` com a mensagem de erro explicando o motivo
d) Encerra por completo o processo do servidor Node, exigindo que toda a aplicação seja reiniciada manualmente em seguida

**10. Qual é o papel do node `messageGeneratorNode`?**

a) Chamar a IA de novo para transformar o resultado técnico numa mensagem amigável, e adicioná-la ao histórico
b) Identificar a intenção do cliente a partir da última mensagem recebida no histórico da conversa
c) Validar, antes de agendar de fato, se os dados extraídos atendem aos requisitos do `ScheduleRequiredSchema` definido previamente
d) Consultar a lista de profissionais disponíveis para sugerir horários alternativos livres ao cliente

**11. Por que `identifyIntentNode` e `messageGeneratorNode` recebem `llmClient` como dependência, mas `scheduleNode` e `cancelNode` não?**

a) Porque `scheduleNode` e `cancelNode` ainda não foram atualizados para a versão mais recente do projeto
b) Não há diferença real de comportamento entre os quatro nodes do grafo, é apenas uma escolha pessoal de estilo de código
c) Porque `llmClient` só pode ser instanciado uma única vez durante toda a execução do processo
d) Porque só os dois primeiros de fato chamam a IA — os outros só processam dados e chamam o serviço

**12. Como as dependências (`OpenRouterService`, `AppointmentService`) chegam até `buildGraph`?**

a) São instanciadas individualmente dentro de cada node, na primeira vez em que ele é executado
b) São recebidas como parâmetros de `buildGraph(llmClient, appointmentService)` — quem monta o grafo decide as instâncias
c) São lidas diretamente das variáveis de ambiente do arquivo `.env` dentro do próprio `graph.ts`
d) São expostas como variáveis globais, importadas de um único arquivo central de configuração do projeto

**13. O que o método `generateStructured` de `OpenRouterService` devolve, em vez de deixar uma exceção "vazar"?**

a) Sempre `undefined`, tanto em caso de sucesso quanto em caso de erro na chamada à IA
b) Um código de status HTTP qualquer, equivalente ao que a própria API da OpenAI sempre retornaria diretamente sem tratamento algum
c) Um objeto com `{ success, data }` ou `{ success, error }`, obrigando quem chama a tratar os dois casos
d) Uma string já formatada em HTML, pronta para ser exibida direto numa página do navegador do cliente

**14. Qual é a diferença entre `createServer` neste módulo e no módulo anterior?**

a) Aqui `createServer(graph)` recebe o grafo já montado como parâmetro, em vez de montá-lo internamente
b) Não há nenhuma diferença de assinatura ou de comportamento entre as duas versões da função
c) Aqui `createServer` deixou de aceitar qualquer argumento, montando tudo de forma implícita por dentro
d) Aqui `createServer` virou uma classe instanciável com `new`, em vez de uma função fábrica comum

**15. O que `routeByIntent` faz quando `state.intent` é `"unknown"` (ou ainda não foi definido)?**

a) Lança um erro que interrompe imediatamente toda a execução do grafo inteiro, sem gerar nenhuma resposta de fato
b) Repete a chamada ao node `identifyIntent` até que uma intenção válida seja finalmente retornada
c) Cancela automaticamente a consulta mais recente associada ao cliente que enviou a mensagem
d) Cai no caso `default`, roteando para `messageGeneratorNode` — que gera uma resposta adequada mesmo sem ação nenhuma

---

## Gabarito

1. c — schema define os campos, modelo devolve dados já validados nesse formato
2. a — evita `JSON.parse` manual e validação manual do resultado
3. d — compatibilidade de API + suporte mais maduro a output estruturado
4. b — exemplos concretos de entrada/saída que reduzem erros de extração
5. c — a API estrita exige campo obrigatório; `null` simula "opcional"
6. a — extrai intenção e dados via IA, devolvendo estado parcial
7. d — captura o erro, cai em `intent: "unknown"`, fluxo segue normalmente
8. b — princípio "confio, mas confiro", cada node revalida por conta própria
9. c — lança exceção, capturada como `actionSuccess: false`
10. a — transforma resultado técnico em mensagem amigável e atualiza o histórico
11. d — só os dois primeiros chamam a IA de fato
12. b — recebidas como parâmetros de `buildGraph`, decididas por quem monta o grafo
13. c — resultado explícito `{ success, data }` ou `{ success, error }`
14. a — `createServer(graph)` recebe o grafo pronto, em vez de montá-lo internamente
15. d — cai no `default`, roteando para `messageGeneratorNode`
