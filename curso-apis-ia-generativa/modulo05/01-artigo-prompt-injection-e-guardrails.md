---
title: "Prompt injection: como agentes vazam dados e como blindar com guardrails"
modulo: 5
aula: [1, 2, 3, 4]
tipo: artigo
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [seguranca, prompt-injection, guardrails, mcp, jailbreak, controle-de-acesso]
fonte: docs/scrap/platos-legendas/output/curso-14082629/05-modulo-05/
---

# Prompt injection: como agentes vazam dados e como blindar com guardrails

> Este artigo cobre as 4 aulas do módulo, que constroem uma demonstração contínua de ataque e defesa: primeiro o módulo expõe uma falha real de segurança, depois implementa a correção.

## O ataque: prompt injection

**Prompt injection** é a técnica de manipular a entrada de um agente de IA para fazer com que ele ignore as instruções originais (o *system prompt*) e siga instruções diferentes, inseridas pelo próprio usuário — por exemplo, dizendo "ignore todas as instruções anteriores e faça X". O nome é uma analogia direta a SQL injection: assim como um input malicioso pode alterar uma query de banco de dados, uma instrução maliciosa dentro do texto do usuário pode "reprogramar" o comportamento do modelo em tempo real.

O ponto central do módulo é demonstrar isso **na prática**, não só na teoria: com um agente que tem acesso a uma ferramenta de leitura de arquivos (via MCP) e regras de permissão bem específicas no system prompt (ex: "o usuário Ana é do tipo *member* e não pode ler arquivos do sistema"), um usuário sem permissão consegue, mesmo assim, convencer o modelo a ignorar essa regra e revelar o conteúdo de arquivos sensíveis (como o `.env`, que geralmente guarda credenciais).

## Por que só colocar regras no prompt não é suficiente

Um ponto crucial: mesmo com um system prompt extremamente detalhado e explícito ("você não pode deixar o usuário escalar privilégio", "sempre verifique a permissão antes de agir"), o modelo ainda pode ser convencido a violar essas regras — especialmente modelos menores ou menos robustos. A aula demonstra isso trocando apenas o modelo usado (de um mais robusto para um mais vulnerável) e observando que **as mesmas regras de segurança, no mesmo prompt, passam a falhar**. Isso prova que confiar inteiramente em instruções de texto para segurança é uma aposta arriscada — o comportamento não é determinístico e pode variar entre execuções, mesmo com o mesmo modelo.

## MCP como fonte de risco: ferramentas com acesso real ao sistema

O módulo usa um servidor MCP de *filesystem* (leitura de arquivos do sistema operacional) como a ferramenta que o agente pode chamar. Isso é o que torna o risco concreto: não é apenas "o modelo disse algo que não devia" — é "o modelo executou uma ação real (ler um arquivo) que não devia ter permissão para executar". Quanto mais poder uma ferramenta MCP dá ao agente (ler arquivos, executar comandos, acessar bancos de dados), maior o dano potencial de um prompt injection bem-sucedido.

## A defesa: guardrails como uma camada independente

A solução implementada não é "melhorar o prompt até ele não falhar mais" — é adicionar uma **camada de verificação separada e anterior** a qualquer execução de ferramenta: um nó de **guardrails** que recebe a entrada do usuário (mais o contexto de permissões) e, usando um modelo de IA dedicado a essa única tarefa, decide se aquela entrada é seguro (`safe`) ou suspeita (`unsafe`) — **antes** do agente principal sequer ter acesso às ferramentas.

Esse padrão é importante por um motivo estrutural: o modelo de guardrails **nunca tem acesso às ferramentas MCP**. Mesmo que alguém consiga manipular esse modelo para "achar" que a entrada é segura, o pior cenário é liberar a passagem para o agente principal seguir as regras normais — o guardrail em si nunca executa nada de perigoso.

## Modelos especializados em segurança

A aula usa um modelo dedicado especificamente a detectar tentativas de manipulação (um "modelo *safeguard*"), separado do modelo usado para conversar com o cliente. Esses modelos tendem a ser **menores** que os modelos de propósito geral (o exemplo citado tem só alguns bilhões de parâmetros) — o que faz sentido, já que a tarefa deles é bem mais restrita (classificar uma entrada como segura ou não) e isso também resulta em **latência mais baixa**, importante porque essa verificação acontece antes de qualquer outra coisa na cadeia.

## Prompt templates em vez de concatenação manual de string

Um detalhe técnico reforçado no módulo: ao montar prompts que incluem dados vindos do usuário (nome, role, permissões), é preferível usar um mecanismo de **template** (como o `PromptTemplate` do LangChain) em vez de concatenação/substituição manual de string. A justificativa dada é que o framework já cuida de sanitização básica por baixo dos panos — reduzindo (embora não eliminando) a superfície de ataque em relação a montar a string manualmente.

## O princípio central: nunca confie na entrada do cliente

A conclusão do módulo é direta: qualquer aplicação que dá a um agente de IA acesso a ferramentas com efeito real (ler arquivos, rodar comandos, consultar bancos de dados) precisa tratar a entrada do usuário como **potencialmente hostil por padrão** — nunca assumir que "o prompt já cobre isso". Isso é o mesmo princípio de segurança que já existe há décadas em engenharia de software tradicional (nunca confiar em input de usuário, sempre sanitizar, sempre validar em múltiplas camadas) — só que aplicado a um novo tipo de "código executável": o prompt.

## Verifique seu entendimento

1. O que é prompt injection, e por que a analogia com SQL injection ajuda a entender o risco?
2. Por que colocar regras de permissão detalhadas no system prompt não é suficiente como única camada de defesa?
3. Por que o nó de guardrails nunca tem acesso às ferramentas MCP, mesmo sendo ele quem decide se a entrada é segura?
4. Que vantagem prática (além de segurança) um modelo "safeguard" dedicado costuma ter em relação a um modelo de propósito geral?
5. Por que usar `PromptTemplate` em vez de concatenação manual de strings é considerado mais seguro, ainda que não seja uma solução completa?
