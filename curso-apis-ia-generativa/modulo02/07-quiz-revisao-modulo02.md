---
title: "Quiz de revisão — Módulo 2 (LangChain e LangGraph)"
modulo: 2
tipo: quiz
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [langchain, langgraph, revisao, quiz]
---
# Quiz de revisão — Módulo 2

15 perguntas de múltipla escolha cobrindo as 5 aulas do módulo (LangChain/LangGraph/LangSmith, estado, nodes/edges, arestas condicionais, fallback). Gabarito no final — tenta responder tudo antes de olhar.

---

**1. Qual é a diferença central entre LangChain e LangGraph?**

a) São a mesma coisa, nomes diferentes para a mesma biblioteca
b) LangChain é a biblioteca/framework para encadear etapas; LangGraph é uma extensão para organizar esses fluxos como um grafo com desvios e memória
c) LangChain só funciona em Python; LangGraph só em TypeScript
d) LangGraph substitui completamente o LangChain nas versões mais novas

**2. Para que serve o LangSmith?**

a) Para rodar modelos de IA localmente sem custo
b) Para gerar automaticamente os nodes do grafo
c) Como painel na nuvem que mostra o que aconteceu por trás dos panos da execução (funções chamadas, ordem, tempo) — um "raio-x" de debug
d) Para validar o schema do estado com Zod

**3. Quando se abre o LangGraph Studio e vê caixinhas conectadas por setas, por que isso não é "igual a low-code" (tipo n8n/Zapier)?**

a) Porque o LangGraph Studio não permite visualizar o fluxo, só o código
b) Porque cada caixinha (node) é código de verdade escrito por você — o desenho só visualiza a lógica, não a esconde
c) Porque low-code não usa grafos, usa apenas listas
d) Porque o LangGraph Studio roda só localmente, nunca na nuvem

**4. O que é o "estado" (state) de um grafo no LangGraph?**

a) Um banco de dados externo que armazena logs de execução
b) Uma configuração fixa definida uma única vez no início do projeto
c) Uma "ficha de anotações" que passa de nó em nó — cada etapa lê o que já está escrito, faz seu trabalho e devolve atualizada
d) O status HTTP retornado pela API

**5. Qual biblioteca é usada para descrever o formato ("schema") do estado no exemplo do curso?**

a) Joi
b) Yup
c) Zod
d) Ajv

**6. Um node (nó) do grafo é, na prática:**

a) Uma tabela do banco de dados
b) Uma função que recebe o estado atual, faz o que for preciso e sempre devolve o estado (atualizado ou não)
c) Um arquivo de configuração JSON
d) Um endpoint HTTP exclusivo, sem relação com o grafo

**7. O que define START e END em um grafo LangGraph?**

a) São nós opcionais que podem ser omitidos em qualquer grafo
b) São os pontos especiais de entrada e saída do fluxo
c) São variáveis de ambiente do projeto
d) São comandos usados apenas no modo de teste

**8. Por que a mensagem do usuário é embrulhada em uma `HumanMessage` em vez de ser passada como string simples?**

a) Porque o Fastify exige esse formato para rotas HTTP
b) É só uma formalidade sem efeito prático
c) Porque o LangChain organiza conversas em torno de "papéis" (quem disse o quê) — isso importa para o modelo de IA entender o contexto depois
d) Porque strings simples não podem ser validadas com Zod

**9. No node `identifyIntent`, qual é o papel correto dele no fluxo, segundo o curso?**

a) Ele decide sozinho para qual node o fluxo deve seguir
b) Ele só anota uma informação no estado (`command`) — quem decide o próximo passo é a aresta condicional
c) Ele formata a resposta final da IA
d) Ele é responsável por chamar o modelo de linguagem

**10. Qual é a função do node `chatResponse`?**

a) Identificar a intenção do usuário
b) Pegar o `output` do estado e embrulhar numa `AIMessage`, adicionando ao histórico de mensagens
c) Validar o schema do estado com Zod
d) Rotear o fluxo condicionalmente

**11. O que diferencia uma aresta condicional (conditional edge) de uma aresta comum?**

a) Aresta condicional sempre aponta para o mesmo destino fixo
b) Aresta condicional usa uma função que olha o estado e decide, na hora, para qual node ir — em vez de destino fixo
c) Aresta condicional só existe em grafos sem node de fallback
d) Não há diferença técnica, só de nome

**12. Por que o `default` de um `switch` numa função de roteamento (aresta condicional) é importante?**

a) Não é importante, pode ser omitido sem problema
b) Porque cobre os casos que não batem com as opções esperadas, evitando que o sistema trave diante de entrada inesperada
c) Porque o TypeScript exige `default` em todo switch
d) Porque só o `default` é testado nos testes automatizados

**13. Qual é a função do `fallbackNode` no grafo completo do módulo?**

a) Transformar o texto em maiúsculo
b) Ser a rota padrão quando nenhuma opção esperada (`upper`/`lower`) se encaixa, avisando que o comando não foi reconhecido
c) Substituir o `chatResponse` como ponto final do grafo
d) Validar a chave de API do modelo

**14. Qual foi o problema identificado quando o `fallbackNode` criava sua própria `AIMessage`?**

a) Nenhum problema, essa era a prática recomendada
b) O grafo travava e não terminava a execução
c) A mensagem de fallback aparecia duplicada no histórico, porque o `chatResponse` também criava uma `AIMessage` sobre o mesmo `output`
d) O Zod rejeitava o schema por causa da duplicidade

**15. Depois de montado, como o grafo é exposto para quem consome a aplicação?**

a) Só pode ser acessado via LangGraph Studio, nunca por HTTP direto
b) Como uma API HTTP comum (ex: Fastify) — o cliente nem precisa saber que existe um grafo por trás
c) Precisa de um cliente especial que entenda o formato de grafo
d) Só funciona com WebSockets

---

## Gabarito

1. b — LangChain encadeia; LangGraph organiza como grafo com desvios/memória
2. c — painel de observabilidade/debug na nuvem
3. b — nodes são código real, o desenho só visualiza
4. c — ficha de anotações compartilhada entre nós
5. c — Zod
6. b — função que recebe e sempre devolve o estado
7. b — pontos especiais de entrada e saída
8. c — papéis (quem disse o quê) importam para o contexto do modelo
9. b — só anota `command`, não decide o roteamento
10. b — formata `output` como `AIMessage` final
11. b — decide dinamicamente com base no estado
12. b — evita que o sistema trave com entrada inesperada
13. b — rota padrão para comando não reconhecido
14. c — mensagem duplicada no histórico
15. b — continua sendo uma API HTTP comum
