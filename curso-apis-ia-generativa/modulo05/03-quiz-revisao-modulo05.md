---
title: "Quiz de revisão — Módulo 5 (prompt injection e guardrails)"
modulo: 5
tipo: quiz
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [seguranca, prompt-injection, guardrails, mcp, revisao, quiz]
---
# Quiz de revisão — Módulo 5

12 perguntas de múltipla escolha cobrindo as 4 aulas do módulo (prompt injection, MCP
como fonte de risco, guardrails como camada independente, modelos safeguard, roteamento
condicional de segurança). Gabarito no final — tenta responder tudo antes de olhar.

---

**1. O que é prompt injection, na definição usada neste módulo?**

a) Um bug de performance que faz o modelo responder mais devagar do que o esperado
b) A técnica de manipular a entrada do usuário para fazer o modelo ignorar suas instruções originais e seguir instruções diferentes
c) Um erro de configuração que impede o modelo de acessar qualquer ferramenta MCP
d) Um recurso oficial da OpenRouter para testar múltiplos modelos ao mesmo tempo

**2. Por que o módulo usa um servidor MCP de filesystem, em vez de só discutir o risco na teoria?**

a) Porque MCP é a única forma de conectar um agente LangGraph a qualquer ferramenta
b) Para tornar o risco concreto: o agente ganha acesso real a uma ação (ler um arquivo), não só a um discurso sobre segurança
c) Porque servidores MCP são mais rápidos que chamadas de função nativas do LangChain
d) Porque não é possível demonstrar prompt injection sem uma ferramenta de leitura de arquivos

**3. Por que colocar regras de permissão detalhadas no system prompt não é suficiente como única defesa?**

a) Porque o `PromptTemplate` do LangChain ignora silenciosamente qualquer regra escrita no template
b) Porque o modelo ainda pode ser convencido a violar essas regras, de forma não determinística, especialmente em modelos menores ou menos robustos
c) Porque o system prompt tem um limite rígido de caracteres que impede regras de segurança
d) Porque regras de segurança só podem ser aplicadas via ferramentas MCP, nunca via prompt

**4. Neste projeto, por que `guardrailsCheckNode` sempre roda antes de `chatNode`, no grafo?**

a) Porque o LangGraph exige, por regra da própria biblioteca, que todo grafo comece por um nó de validação
b) Porque só assim o agente principal (que tem acesso às ferramentas MCP) fica condicionado a passar por uma verificação de segurança antes de agir
c) Porque `chatNode` não tem permissão de ler o estado do grafo antes de `guardrailsCheckNode` rodar
d) É só uma convenção de nomenclatura, sem efeito real na ordem de execução

**5. Por que o `safeguardClient`, em `openrouter-service.ts`, nunca recebe as ferramentas MCP (`tools`)?**

a) Porque a API da OpenRouter bloqueia automaticamente ferramentas para qualquer modelo com "safeguard" no nome
b) Para garantir que, mesmo que esse modelo seja manipulado, o pior cenário seja classificar algo perigoso como seguro — ele mesmo não tem como executar nenhuma ação
c) Porque ferramentas MCP só funcionam com o modelo configurado como principal em `config.models[0]`
d) Porque adicionar `tools` a esse cliente causaria um erro de tipo no TypeScript

**6. O que aconteceria, na prática, se `guardrailsCheckNode` simplesmente deixasse passar (`safe: true`) sempre que a chamada ao modelo de guardrail falhasse (erro de rede, por exemplo)?**

a) Nada mudaria — o comportamento seria idêntico ao atual, que também libera em caso de erro
b) O sistema ficaria mais rápido, sem nenhum efeito colateral negativo
c) Uma falha de infraestrutura (não relacionada à mensagem em si) acabaria liberando acesso às ferramentas sem nenhuma verificação de segurança ter realmente passado
d) O `chatNode` recusaria a resposta automaticamente, então não haveria risco real

**7. Por que o modelo "safeguard" tende a ser menor (menos parâmetros) que o modelo principal de conversa?**

a) Porque modelos safeguard são sempre versões desatualizadas de modelos maiores
b) Porque a tarefa dele é bem mais restrita (classificar segura/insegura), o que permite menor latência — importante já que ele roda antes de qualquer outra etapa
c) Porque modelos grandes são incapazes de detectar prompt injection, por limitação técnica
d) Porque o OpenRouter cobra mais caro por chamadas de classificação do que por chamadas de geração de texto

**8. Qual é a vantagem de usar `PromptTemplate` (em vez de concatenação manual de string) ao montar prompts com dados do usuário, segundo o artigo do módulo?**

a) `PromptTemplate` impede, de forma absoluta e garantida, qualquer tentativa de prompt injection
b) O framework já aplica alguma sanitização básica ao formatar o template, reduzindo (sem eliminar) a superfície de ataque em relação à concatenação manual
c) `PromptTemplate` é obrigatório por regra da API da OpenRouter para qualquer prompt com variáveis
d) Só `PromptTemplate` permite usar mais de uma variável dentro do mesmo prompt

**9. No projeto, por que `userRole` usa `state.userRole ?? "member"` como fallback em `chatNode.ts`, em vez de `?? "admin"`?**

a) Porque `"admin"` não é um valor válido no schema Zod do estado do grafo
b) Porque assumir o papel de menor privilégio por padrão é mais seguro caso o campo não esteja preenchido — o mesmo princípio de "falha fechado" usado no guardrail
c) Porque o usuário `"admin"` nunca é usado nos testes automatizados do projeto
d) Não há motivo de segurança — é só o valor que aparece primeiro no enum do Zod

**10. Por que `blockedNode`, neste projeto, não chama nenhum modelo de IA para montar sua resposta?**

a) Porque chamadas de IA custam mais caro que templates de texto simples, e isso é só uma otimização de custo
b) Porque o caminho de bloqueio é propositalmente o mais simples e previsível do grafo — sem superfície extra de comportamento inesperado justo no momento em que algo suspeito já foi detectado
c) Porque o LangGraph não permite que um nó de bloqueio chame um modelo de IA
d) Porque `blockedNode` roda antes de qualquer modelo estar disponível no estado do grafo

**11. O que muda no comportamento do agente, no código deste projeto, quando `GUARDRAILS_ENABLED=false` no `.env`?**

a) O `chatNode` deixa de existir no grafo, e todas as mensagens vão direto para `blockedNode`
b) `checkGuardrails` devolve `safe: true` sem chamar o modelo de guardrail, e `routeAfterGuardrails` manda toda mensagem direto para `chatNode`, reproduzindo a falha do Passo 6 do tutorial
c) O servidor MCP de filesystem é desligado automaticamente, então não há mais nenhum arquivo acessível
d) O modelo principal (`llmClient`) passa a receber as mesmas instruções que o `safeguardClient`

**12. Que princípio de segurança tradicional (fora do contexto de IA) este módulo está essencialmente reaplicando?**

a) Criptografia de dados em repouso
b) Nunca confiar cegamente em input do usuário — sempre validar/sanitizar em múltiplas camadas, independente das regras já declaradas em uma camada anterior
c) Balanceamento de carga entre múltiplos servidores
d) Versionamento semântico de APIs

---

## Gabarito

1. b — manipular a entrada para o modelo ignorar as instruções originais
2. b — torna o risco concreto: acesso real a uma ação, não só discurso teórico
3. b — o modelo ainda pode ser convencido a violar as regras, de forma não determinística
4. b — condiciona o agente principal (com ferramentas) a passar pela verificação antes
5. b — pior cenário vira "classificar errado", nunca "executar algo perigoso"
6. c — falha de infraestrutura liberaria acesso sem verificação real ter passado
7. b — tarefa mais restrita permite menor latência, importante por rodar primeiro
8. b — sanitização básica do framework, reduz (sem eliminar) a superfície de ataque
9. b — assume o menor privilégio por padrão, mesmo princípio de falha fechada
10. b — caminho de bloqueio propositalmente simples, sem superfície extra de risco
11. b — libera direto para chatNode sem checar, reproduzindo a falha do Passo 6
12. b — nunca confiar em input do usuário, validar em múltiplas camadas
