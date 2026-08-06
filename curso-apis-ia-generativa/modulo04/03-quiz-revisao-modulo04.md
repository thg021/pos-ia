---
title: "Quiz de revisão — Módulo 4 (memória, preferências e resumo de histórico)"
modulo: 4
tipo: quiz
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [langgraph, memoria, postgres, sqlite, checkpointer, store, resumo, revisao, quiz]
---
# Quiz de revisão — Módulo 4

15 perguntas de múltipla escolha cobrindo as 4 aulas do módulo (memória de curto e
longo prazo, extração implícita de preferências, checkpointer vs. store, Postgres vs.
SQLite, `RemoveMessage`, resumo incremental, roteamento condicional pós-chat). Gabarito
no final — tenta responder tudo antes de olhar.

---

**1. Qual é a diferença central entre memória de curto prazo e memória de longo prazo, no contexto deste módulo?**

a) Memória de curto prazo é mais cara em tokens; memória de longo prazo é sempre gratuita para qualquer modelo usado
b) Memória de curto prazo é o histórico de uma conversa (thread); memória de longo prazo são preferências que persistem entre conversas diferentes
c) Memória de curto prazo só existe no SQLite; memória de longo prazo só existe no Postgres, sem nenhuma exceção
d) Não existe diferença prática — os dois termos descrevem exatamente o mesmo mecanismo de armazenamento

**2. Como o agente extrai preferências do cliente (nome, idade, gêneros, bandas) neste projeto?**

a) Exibindo um formulário estruturado antes de iniciar qualquer conversa com o cliente
b) Perguntando explicitamente, em uma pergunta fixa no início de cada thread nova, cada campo de preferência
c) Via output estruturado: a cada mensagem, um schema pede ao modelo que extraia preferências, se houver alguma
d) Rodando uma expressão regular sobre a mensagem do cliente, procurando nomes de bandas conhecidas

**3. Qual é a diferença de papel entre `checkpointer` e `store` no LangGraph, como usados em `memoryService.ts`?**

a) `checkpointer` guarda o estado do grafo por thread; `store` existe para dados que sobrevivem entre threads diferentes
b) `checkpointer` só funciona com SQLite; `store` só funciona com Postgres, por limitação da própria biblioteca
c) `store` é apenas um cache de leitura; `checkpointer` é quem efetivamente grava qualquer dado no banco
d) Não há diferença de propósito — são dois nomes para a mesma classe, mantidos por compatibilidade com versões antigas

**4. Por que o projeto usa Postgres para o histórico de mensagens e SQLite para as preferências, em vez de um banco só?**

a) Porque o LangGraph exige, por padrão, que checkpointer e preferências fiquem sempre em bancos diferentes
b) Para mostrar as opções disponíveis: histórico usa os mecanismos nativos do LangGraph (Postgres); preferências são um dado simples e pequeno, guardado à parte
c) Porque o SQLite não suporta nenhum tipo de dado além de texto, então o histórico não poderia ser guardado nele de forma alguma
d) Porque o Postgres é gratuito e o SQLite é pago acima de um certo volume de dados armazenados

**5. O que é um "checkpoint" no LangGraph, e que problema ele resolve?**

a) Um log de erros da aplicação, usado só para depuração durante o desenvolvimento
b) Um snapshot do estado do grafo salvo por thread, que permite retomar uma conversa exatamente de onde parou
c) Um mecanismo de cache de respostas do modelo, para economizar chamadas repetidas com o mesmo prompt
d) Um arquivo de configuração que define quais nodes existem no grafo antes de ele ser compilado

**6. Por que o resumo de histórico (`summarizeNode`) é descrito como "incremental"?**

a) Porque ele aumenta o limite de mensagens automaticamente a cada vez que é executado
b) Porque cada resumo novo incorpora o resumo anterior (se existir) junto com as mensagens novas, em vez de recomeçar do zero
c) Porque ele soma o número de tokens gastos em cada chamada e guarda esse total acumulado
d) Porque ele só roda uma única vez durante toda a vida útil da aplicação, nunca mais que isso

**7. Para que serve o tipo especial `RemoveMessage`, usado dentro de `summarizeNode`?**

a) Serve só para registrar, em log, quais mensagens deveriam ter sido removidas, sem removê-las de fato do estado
b) Formata a mensagem removida como markdown antes de exibi-la de volta ao cliente na tela do terminal
c) Quando incluído no retorno de um node, instrui o reducer de mensagens a remover aquela mensagem específica do estado acumulado
d) Cancela, no Postgres, o checkpoint mais recente salvo para aquela thread específica da conversa

**8. Por que `messages`, em `graph.ts`, precisa de `.langgraph.reducer(messagesStateReducer, ...)` para que `RemoveMessage` funcione de verdade?**

a) Porque sem um reducer que saiba interpretar `RemoveMessage`, o retorno parcial de um node simplesmente substituiria o array inteiro, sem remover nada de fato
b) Porque `RemoveMessage` só existe como conceito teórico e nunca teve implementação real dentro do LangGraph
c) Porque o Zod exige, por padrão, que todo array declarado num schema tenha algum reducer configurado
d) Porque isso é só uma formalidade sem efeito prático nenhum sobre o comportamento em tempo de execução

**9. O que `chatNode` faz de diferente quando `state.userContext` já está preenchido, em vez de vazio?**

a) Ignora completamente as preferências salvas e trata o cliente como se fosse completamente desconhecido
b) Deleta as preferências salvas no SQLite, para forçar uma nova extração já na próxima mensagem
c) Evita consultar `preferencesService.getBasicInfo` de novo, reaproveitando o valor já carregado anteriormente na mesma conversa
d) Interrompe a conversa, pedindo ao cliente para confirmar manualmente se as preferências salvas ainda estão corretas

**10. Por que existem duas funções de roteamento (`routeAfterChat` e `routeAfterSavePreferences`) neste grafo, em vez de uma só?**

a) Porque o LangGraph proíbe, por regra da própria biblioteca, que um node tenha mais de uma aresta de saída
b) Porque, depois de `chatNode`, podem existir até dois efeitos colaterais pendentes (salvar preferências e resumir), não só um
c) Porque cada função de roteamento só pode verificar exatamente um campo do estado do grafo, nunca mais que isso
d) É só uma escolha de estilo, sem nenhuma diferença real de comportamento entre usar uma função ou duas

**11. O que `PreferencesService.mergePreferences` faz de diferente de um simples `UPDATE` que sobrescreve a linha inteira?**

a) Nada — `mergePreferences` é equivalente a um `UPDATE` comum, sem nenhuma lógica adicional
b) Mescla o dado novo com o que já existia, preservando campos antigos que não foram mencionados na mensagem atual
c) Apaga a linha inteira do usuário e cria uma nova só com os dados mencionados na mensagem mais recente
d) Só funciona na primeira vez que um usuário é salvo; chamadas seguintes para o mesmo `userId` sempre falham

**12. Por que `genres` e `bands` são guardados como texto (JSON serializado) nas colunas do SQLite, em vez de como array nativo?**

a) Porque arrays ocupam mais espaço em disco no SQLite do que qualquer outro tipo de dado suportado
b) Porque o SQLite não tem um tipo de coluna array nativo — o `PreferencesService` serializa e desserializa manualmente
c) Porque o knex não sabe lidar com nenhum tipo de dado além de string e number em suas migrações
d) Porque isso é uma exigência do LangGraph, que só aceita strings simples como valor de estado

**13. Neste projeto, `buildGraph` devolve um `StateGraph` ainda não compilado — quem chama `.compile()`?**

a) Ninguém — o grafo roda sem nunca ser compilado, direto a partir do `StateGraph` bruto
b) Só o LangGraph Studio compila o grafo; a linha de comando (`cli.ts`) não compila nada
c) `factory.ts` compila passando checkpointer/store; o teste do fluxo do grafo compila sem argumentos, quando não precisa de memória persistente
d) A compilação acontece automaticamente dentro do construtor de `GraphStateSchema`, sem código explícito

**14. Por que `chatNode` faz `state.messages.length + 1 > maxMessagesToSummarize` (com o `+1`), em vez de comparar sem esse ajuste?**

a) Porque `+1` corrige um bug conhecido e não documentado da própria biblioteca LangGraph
b) Porque a mensagem do assistente que acabou de ser gerada ainda não está refletida em `state.messages` neste ponto do código
c) Porque o valor de `maxMessagesToSummarize` já vem, por padrão, um número a menos do que deveria
d) Porque cada mensagem do cliente conta em dobro para efeito de cálculo do limite de resumo

**15. O que aconteceria, na prática, se `maxMessagesToSummarize` fosse aumentado de 6 para um valor bem mais alto (ex: 200) em produção?**

a) O resumo passaria a rodar a cada mensagem, tornando a aplicação mais lenta do que está hoje
b) O histórico cresceria mais antes de ser resumido, gastando mais tokens por chamada até o resumo acontecer, mas resumindo com menos frequência
c) O checkpointer do Postgres pararia de funcionar acima desse novo limite configurado
d) As preferências salvas no SQLite seriam apagadas automaticamente ao atingir esse novo valor

---

## Gabarito

1. b — curto prazo é o histórico de uma thread; longo prazo são preferências entre conversas
2. c — output estruturado extrai preferências como efeito colateral de qualquer mensagem
3. a — checkpointer é por thread; store sobrevive entre threads diferentes
4. b — mostra as opções: histórico usa os mecanismos nativos do LangGraph; preferências são dado simples à parte
5. b — snapshot do estado por thread, permite retomar a conversa de onde parou
6. b — cada resumo incorpora o anterior junto com as mensagens novas
7. c — instrui o reducer a remover aquela mensagem específica do estado
8. a — sem reducer que entenda `RemoveMessage`, o retorno só substituiria o array, sem remover nada
9. c — evita reconsultar o SQLite, reaproveitando o valor já carregado na mesma conversa
10. b — depois do chat podem existir até dois efeitos pendentes (salvar preferências e resumir)
11. b — mescla o dado novo com o que já existia, sem apagar campos antigos
12. b — SQLite não tem array nativo; a serialização/desserialização é manual
13. c — `factory.ts` compila com checkpointer/store; o teste compila sem argumentos
14. b — a mensagem do assistente ainda não está em `state.messages` neste ponto
15. b — histórico cresce mais antes de resumir: mais tokens por chamada, resumo menos frequente
