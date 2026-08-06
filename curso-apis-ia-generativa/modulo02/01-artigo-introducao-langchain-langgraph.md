---
title: "O que é LangChain (e por que ele se chama assim)?"
modulo: 2
aula: 1
tipo: artigo
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [langchain, langgraph, langsmith, setup-de-projeto]
fonte: docs/scrap/platos-legendas/output/curso-14082629/02-modulo-02/01-introducao-ao-langchai.md
---
# O que é LangChain (e por que ele se chama assim)?

## Para quem está chegando agora

Imagina que você quer construir um assistente de IA. Esse assistente precisa fazer várias coisinhas em sequência: receber a pergunta do usuário, buscar informação relevante, mandar tudo isso para um modelo de linguagem (tipo o GPT), pegar a resposta, formatar e devolver para o usuário.

Você **poderia** escrever tudo isso na mão, um passo depois do outro, com vários `if`s pra tratar casos diferentes. Funciona, mas vira uma bagunça rápido — cada vez que você quiser mudar a ordem dos passos ou adicionar um novo, vai ter que reescrever um bloco de código emaranhado. O **LangChain** existe pra te dar peças prontas pra montar esse tipo de fluxo — e ele tem uma versão para Python e uma para TypeScript/JavaScript (que é a que o curso vai usar daqui pra frente).

**Por que "Chain" (corrente/cadeia)?** Porque a ideia central é *encadear* funções: o resultado de uma etapa vira a entrada da próxima, como elos de uma corrente. Cada elo faz uma coisa pequena e bem definida.

## Duas ferramentas, dois papéis diferentes

Esse é o ponto que mais confunde quem está começando, então vale grifar:

| Ferramenta          | Pra que serve                                                                                                                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LangChain** | A biblioteca/framework em si — o código que você importa no seu projeto pra montar os fluxos de IA.                                                                                                                       |
| **LangGraph** | Uma extensão do LangChain pra montar esses fluxos como um **grafo** (uma espécie de fluxograma), inclusive com desvios condicionais e memória. É o que o pessoal mais usa no dia a dia pra criar agentes.         |
| **LangSmith** | Um painel**na nuvem**, gratuito para o uso do curso, que mostra o que aconteceu por trás dos panos: quais funções foram chamadas, em que ordem, quanto tempo levou. Serve como "raio-x" (debug) da sua aplicação. |

Uma analogia: se o **LangChain** é a caixa de ferramentas e o **LangGraph** é o projeto arquitetônico de como as peças se conectam, o **LangSmith** é a câmera de segurança que grava tudo que rolou dentro da obra, pra você conseguir investigar se algo deu errado.

E o melhor: nada disso te obriga a pagar. LangChain e LangGraph são open source (código aberto, de graça). O LangSmith tem um plano pago pra quem quer rodar em escala, mas pra estudar e até rodar aplicações reais em produção, o uso gratuito já é suficiente.

## "Mas isso não é igual ferramenta de low-code?"

Quando você abre o **LangGraph Studio** (a interface visual que mostra o fluxo rodando), a primeira impressão é mesmo parecida com ferramentas *low-code* (tipo n8n, Zapier): você vê caixinhas conectadas por setas, representando o caminho que a informação percorreu.

A diferença importante: cada uma dessas caixinhas (chamadas de **nós**, ou *nodes*) **é código de verdade**, escrito por você. O desenho é só uma forma de visualizar o que o seu código está fazendo — não é o low-code te escondendo a lógica, é você vendo a sua própria lógica de um jeito mais fácil de acompanhar.

## Por que essa aula não usa IA de verdade ainda

Se você acompanhar essa aula esperando ver um modelo de linguagem respondendo perguntas inteligentes, vai se decepcionar — e é de propósito. O objetivo aqui é só entender o **esqueleto**: como o projeto é montado, como o LangGraph Studio funciona, como a gente depura. Quando você manda "hello world" pro chatbot de exemplo gerado automaticamente, ele literalmente **repete o que você escreveu** — não tem nenhuma IA plugada ainda.

A lógica é: dominando esse esqueleto agora, nas próximas aulas fica bem mais fácil encaixar IA de verdade nesses mesmos fluxos, porque o "como o projeto se organiza" você já vai saber de cor.

## Um detalhe chato (mas importante): versões

Quando você manda o LangGraph gerar um projeto de exemplo pronto (via `create-langgraph` — mais sobre isso no tutorial), esse projeto vem configurado com uma versão **beta** mais antiga do LangChain (a `0.3.x`). Só que pra usar em produção de verdade, o ideal é a versão `1.x`, que é a estável.

Isso é comum em bibliotecas de IA: a área muda muito rápido, e os templates prontos às vezes ficam desatualizados. Por isso a aula ensina a **aproveitar só a parte útil do gerador automático** (o arquivo `langgraph.json`, que indica onde está o "mapa" do seu grafo) e montar o resto do projeto do zero, já na versão mais nova.

## Resumindo em uma frase

LangChain te dá as peças pra encadear etapas de um fluxo de IA; LangGraph te ajuda a organizar essas peças como um grafo com desvios e memória; e LangSmith te deixa espiar, de graça, o que aconteceu por trás de cada execução. Nenhum dos três, sozinho, "é" a IA — eles são a estrutura em volta dela.

Para o passo a passo prático de configuração (criar chave de API, iniciar o projeto, rodar o LangGraph Studio localmente), veja o [tutorial complementar](01-tutorial-configurando-langchain-langgraph.md).
