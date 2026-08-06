# Multimodalidade em aplicações com LLM

**Categoria:** Conceitos Gerais de IA
**Relevante em:** aplicações que recebem imagem, PDF, áudio ou vídeo além de texto
**Módulo que trata do assunto:** [modulo07/01-artigo-multimodalidade-e-observabilidade.md](../curso-apis-ia-generativa/modulo07/01-artigo-multimodalidade-e-observabilidade.md)

---

## O que é multimodalidade, de fato

Um modelo **multimodal** é aquele que raciocina sobre mais de um tipo de dado
**ao mesmo tempo** — texto, imagem, áudio — mantendo acesso direto a cada
modalidade original enquanto gera a resposta. Não é sobre o formulário aceitar
vários tipos de arquivo; é sobre o modelo conseguir combinar informação de
fontes diferentes na hora de responder.

## Multimodal de verdade vs. pipeline "multi-etapas"

O erro comum é confundir multimodalidade com um pipeline sequencial que
**converte** uma modalidade em texto antes de chegar no modelo final:

```
Multimodal de verdade:
  [imagem + pergunta] ──────────► modelo ──► resposta
                 (ambos juntos, ao mesmo tempo)

Pipeline multi-etapas (não é multimodal):
  [imagem] ──► legenda/OCR/transcrição ──► [só o texto] ──► modelo ──► resposta
                        ↑
                perde informação aqui
```

Toda conversão prévia (legenda automática, OCR, transcrição de áudio) descarta
detalhes da modalidade original — uma legenda não captura tudo que está na
imagem, um OCR perde layout e elementos não-textuais, uma transcrição perde
tom de voz. O modelo final nunca "viu" a modalidade original, só um resumo
dela.

### Exemplo de questão de revisão

> Qual cenário representa melhor um uso realmente multimodal (e não apenas um
> fluxo "multi-etapas")?

**Resposta correta:** o sistema recebe imagem + pergunta textual juntas, e o
modelo responde considerando simultaneamente os elementos visuais relevantes
e o contexto da pergunta.

Errado seria: gerar legenda da imagem e responder só com base na legenda;
transcrever áudio e perder acesso ao áudio original; usar OCR e tratar o texto
extraído como equivalente completo à imagem; ou só permitir anexar arquivo
sem o modelo de fato processar o conteúdo original.

### Exemplo de questão de revisão (definição, não cenário)

> Qual alternativa descreve de forma mais precisa o que significa um modelo
> ser "multimodal"?

**Resposta correta:** é um modelo capaz de **processar e relacionar**
múltiplas modalidades (texto, imagem, áudio) dentro do **mesmo fluxo de
inferência**, preservando sinais relevantes de cada tipo de entrada.

Essa questão cobra a mesma ideia da anterior, só que pela definição em vez do
cenário de uso — vale reforçar os erros mais sutis:

- Janela de contexto maior (aceitar arquivo grande) não é o mesmo que
  relacionar modalidades diferentes — é só capacidade de tamanho de entrada.
- Gerar imagem e texto na **saída** sem conseguir compreender ambos como
  **entrada** não é multimodal — falta a parte de processar, só existe a de
  produzir.
- Converter tudo para texto antes da inferência principal (o pipeline
  "multi-etapas" do exemplo anterior) descarta o sinal da modalidade
  original — se "a modalidade real não importa" para o modelo, não é
  multimodal.
- Combinar vários modelos especializados (um de imagem, um de texto) **sem
  integração semântica** entre eles é um sistema de modelos isolados, não um
  modelo multimodal — falta justamente o "mesmo fluxo de inferência".

## Confiabilidade da resposta: não superestimar o modelo

Ter um modelo multimodal capaz de "ver" a imagem não significa que tudo que
ele diz sobre ela é observação visual direta. Parte da resposta pode ser
**inferência ou suposição disfarçada de fato** — ex: "a pessoa parece estar
triste" é hipótese (interpretação de expressão/contexto), não um dado visual
objetivo como "a pessoa está usando um casaco vermelho".

A prática que reduz esse risco, sem prometer mais do que o modelo entrega,
é dar **instruções claras sobre a tarefa**, **delimitar o que deve ser
observado** e **incentivar o modelo a distinguir observação visual de
inferência/hipótese** na própria resposta. Isso não aumenta a capacidade
real do modelo — só torna a resposta mais **auditável**: dá pra checar o que
é fato visual e o que é palpite.

### Exemplo de questão de revisão

> Qual prática tende a melhorar mais a confiabilidade da resposta sem
> superestimar a capacidade do modelo, ao analisar uma imagem?

**Resposta correta:** fornecer instruções claras sobre a tarefa, delimitar o
que deve ser observado e incentivar o modelo a distinguir observação visual
de inferência/hipótese.

Errado seria: pular etapas intermediárias achando que isso evita viés (na
prática esconde o raciocínio); tratar resposta longa como automaticamente
mais confiável (tamanho não tem relação com confiabilidade); assumir que
tudo numa descrição livre é observação direta (mistura fato com suposição
sem avisar); ou deixar o modelo responder sem nenhum direcionamento,
incentivando criatividade mesmo que misture observação com suposição.

## Na prática (padrão `generateWithDocument`)

O módulo 7 mostra que tecnicamente quase nada muda na estrutura já usada nos
módulos anteriores — a mensagem para o modelo ganha um campo extra apontando
para o arquivo (URL ou base64), junto com o texto da pergunta, na mesma
chamada:

```typescript
messages: [
  { role: "system", content: systemPrompt },
  {
    role: "user",
    content: [
      { type: "text", text: question },
      { type: "image_url", image_url: { url: `data:application/pdf;base64,${fileBase64}` } },
    ],
  },
]
```

O ponto chave: texto e imagem viajam **juntos, na mesma mensagem**, para o
modelo decidir com os dois ao mesmo tempo — isso é o que separa multimodal de
um pipeline disfarçado de multimodal.
