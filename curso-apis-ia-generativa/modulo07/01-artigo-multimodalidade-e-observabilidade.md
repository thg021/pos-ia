---
title: "Multimodalidade e observabilidade: fechando o ciclo de produção"
modulo: 7
aula: [1, 2]
tipo: artigo
curso: APIs de IA Generativa e Prompt Engineering
status: rascunho
tags: [multimodal, observabilidade, langfuse, opentelemetry, evaluation, tracing]
fonte: docs/scrap/platos-legendas/output/curso-14082629/07-modulo-07/
---

# Multimodalidade e observabilidade: fechando o ciclo de produção

> Este artigo cobre as 2 aulas finais do curso. Diferente dos módulos anteriores, aqui não há um projeto novo construído passo a passo — as aulas são um panorama de dois temas (entrada multimodal e observabilidade) com projetos de referência já prontos, por isso não há um tutorial separado: o conteúdo prático relevante já está resumido abaixo.

## Aula 1 — Modelos multimodais: além de texto puro

Um modelo **multimodal** é aquele que recebe (e às vezes também produz) mais do que texto — imagens, documentos, áudio, vídeo. A boa notícia mostrada na aula é que, tecnicamente, **quase nada muda** na estrutura já usada nos módulos anteriores: em vez de mandar só uma mensagem de texto para o modelo, você inclui um campo adicional apontando para o arquivo (uma URL ou o conteúdo em base64), e o resto do fluxo (prompt, schema de saída, tratamento de erro) permanece igual.

### O padrão: `generateWithDocument`

A diferença central em relação ao que já foi construído é uma função adicional no serviço de LLM que aceita um documento (imagem ou PDF) além da pergunta:

```typescript
async generateWithDocument(question: string, fileBase64: string): Promise<LlmResponse> {
  const response = await this.client.chat.completions.create({
    models: this.config.models,
    messages: [
      { role: "system", content: this.config.systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: question },
          { type: "image_url", image_url: { url: `data:application/pdf;base64,${fileBase64}` } },
        ],
      },
    ],
  });

  return { model: response.model, content: response.choices[0]?.message?.content ?? "" };
}
```

Note que o campo se chama `image_url` mesmo quando o conteúdo é um PDF — uma particularidade da API que a aula observa ser um pouco confusa, mas que funciona igual para diferentes tipos de arquivo.

### Limitação prática: o arquivo inteiro precisa ser enviado de uma vez

Um ponto de atenção: o endpoint usado não suporta enviar um documento em pedaços — o arquivo completo precisa ir em uma única requisição, em base64. Para arquivos muito grandes, isso pode ser inviável (tanto por tamanho de payload quanto por custo de tokens). Uma alternativa mencionada como prática mais comum em produção: fazer o **parse do documento no seu próprio servidor** (extrair o texto de um PDF, por exemplo) e enviar apenas o **texto extraído** para o modelo, em vez do arquivo bruto — voltando ao fluxo de texto puro já conhecido.

### Modelos de áudio e "realtime": o próximo nível

A aula também explora, em nível conceitual, modelos de **áudio** (enviar voz diretamente para o modelo, sem passar por transcrição manual) e modelos de **realtime** (uma conexão contínua — via WebRTC, WebSocket ou VoIP — onde o modelo escuta e responde em tempo real, sem o ciclo tradicional de "manda requisição, espera resposta"). O caso de uso mais citado é substituir centrais de atendimento telefônico tradicionais (aquelas de "aperte 1 para...") por um agente que entende a intenção da pessoa diretamente pela fala.

Dois pontos práticos de atenção citados:
- Modelos de áudio/realtime **custam significativamente mais** que os equivalentes de texto — a aula reforça que isso muda a equação de custo do projeto e deve ser avaliado com cuidado antes de adotar.
- Para a maioria dos projetos pessoais e de médio porte, uma abordagem mais simples (usuário aperta um botão para gravar, ou detecção de palavra-chave para iniciar a gravação, seguida de transcrição tradicional) já é suficiente — realtime nativo tende a fazer mais sentido para produtos de grande escala com investimento dedicado a essa experiência.

## Aula 2 — Observabilidade: sem monitoramento, você está no escuro

A segunda aula final do curso trata de um tema que se torna crítico assim que uma aplicação de IA vai para produção: **como saber o que está acontecendo** — quanto está sendo gasto, quais prompts estão sendo executados, onde estão os gargalos de latência, se algum cliente está abusando do sistema.

### Duas formas de monitorar

1. **No próprio provedor de LLM** (OpenRouter, OpenAI, Anthropic): configurar alertas e limites de uso diretamente no painel — a forma mais simples, mas limitada ao que o provedor expõe.
2. **Infraestrutura própria de observabilidade**: instrumentar a aplicação para registrar cada chamada de LLM (entrada, saída, latência, tokens usados, custo) em uma ferramenta dedicada — dando visibilidade completa e customizável.

### LangFuse: tracing especializado em aplicações de IA

A ferramenta destacada é o **LangFuse** (open source, com opção de self-hosting), que registra o que a aula chama de **tracing**: o caminho completo de uma requisição — de onde veio, que operação foi executada (chamada de modelo, uso de ferramenta MCP, function call), quanto tempo levou em cada etapa, e quanto custou. Isso é equivalente ao conceito de *tracing* já usado em observabilidade de sistemas tradicionais, só que aplicado especificamente a chamadas de LLM.

A integração é feita via **OpenTelemetry** (um padrão de instrumentação já usado em observabilidade de software em geral, não exclusivo de IA) — o que significa que, se sua aplicação já tem OpenTelemetry configurado (como o exemplo de monitoramento do módulo 1 do curso), adicionar o LangFuse é principalmente uma questão de configurar variáveis de ambiente apontando para o coletor, sem reescrever a instrumentação do zero.

### Gestão de prompts e "evaluation": medir qualidade, não só custo

Um conceito adicional trazido pela aula, além do monitoramento de custo/latência: **prompt management** — versionar e comparar prompts fora do código da aplicação, permitindo testar variações e medir qual delas performa melhor sem precisar fazer deploy de código novo.

Ligado a isso está o conceito de **evaluation**: como os módulos anteriores já mostraram, respostas de LLM não são determinísticas — o mesmo prompt pode gerar textos diferentes (mas semanticamente equivalentes) em execuções diferentes. Isso torna testes automatizados tradicionais (comparar string exata) inadequados para validar a *qualidade* da resposta em si — só a estrutura dos dados (como já vinha sendo validado via schemas Zod nos módulos anteriores). Evaluation resolve essa lacuna atribuindo **pontuações de qualidade** às respostas geradas, de forma sistemática — inclusive integrável a pipelines de CI/CD, para detectar quando uma mudança de prompt piora a qualidade das respostas antes de ir para produção.

## O fio condutor do curso, revisitado

Essas duas aulas finais amarram um tema que atravessou o curso inteiro: **usar IA em produção exige a mesma disciplina de engenharia de software que qualquer outro sistema** — só que aplicada a um componente nem sempre determinístico. Multimodalidade estende o tipo de entrada que o sistema aceita; observabilidade garante que, uma vez em produção, existam dados reais (não suposições) para decidir onde otimizar custo, corrigir prompts ou investigar comportamento inesperado.

## Verifique seu entendimento

1. O que muda estruturalmente no código para dar suporte a documentos/imagens, em relação ao fluxo de texto já construído nos módulos anteriores?
2. Por que enviar o texto já extraído de um PDF pode ser preferível a enviar o arquivo bruto para o modelo?
3. Qual a diferença entre o modelo tradicional de "requisição e resposta" e um modelo de "realtime" para áudio?
4. O que é *tracing* no contexto de observabilidade de aplicações de IA, e por que ele é mais detalhado do que só "logar erros"?
5. Por que testes automatizados tradicionais (comparação exata de string) não são suficientes para validar a qualidade de respostas geradas por LLM, e como o conceito de *evaluation* resolve isso?
