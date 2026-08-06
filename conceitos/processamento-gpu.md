# Processamento em GPU

**Categoria:** Conceitos Gerais de IA
**Relevante em:** TensorFlow.js, treinamento de modelos, inferência

---

## O que é GPU?

**GPU** = Graphics Processing Unit (Unidade de Processamento Gráfico)

Originalmente criada para renderizar jogos e vídeos. Descobriram que ela também é perfeita para Machine Learning — pelo mesmo motivo: os dois precisam fazer muitas operações matemáticas simples ao mesmo tempo.

---

## CPU vs GPU — a diferença fundamental

**CPU** (o processador principal do computador):
- Poucos núcleos (4, 8, 16...)
- Cada núcleo é muito rápido e inteligente
- Ótimo para tarefas complexas e sequenciais
- Toma decisões, gerencia memória, roda o sistema operacional

**GPU** (a placa de vídeo):
- Milhares de núcleos (3.000, 10.000+...)
- Cada núcleo é simples e especializado
- Ótimo para tarefas simples feitas em paralelo
- Não toma decisões — só executa operações matemáticas

---

## Analogia: multiplicar 1 milhão de números por 2

**CPU** — 4 funcionários super qualificados:
```
funcionário 1: processa 250.000 números  (demorado)
funcionário 2: processa 250.000 números
funcionário 3: processa 250.000 números
funcionário 4: processa 250.000 números
Tempo total: longo
```

**GPU** — 10.000 operários especializados:
```
todos os 10.000 ao mesmo tempo, cada um faz 100 números
Tempo total: muito mais curto
```

> **Resumo:** CPU = poucos especialistas. GPU = exército de operários. Para ML, o exército ganha.

---

## Por que GPU é ideal para Machine Learning?

Quase todo cálculo de ML se resume a **multiplicações de matrizes**:

```
Tensor de entrada × Pesos da camada = Saída

[0.3, 0.7, 0.1]   ×   [[0.5, 0.2],    =   [resultado]
                        [0.8, 0.4],
                        [0.1, 0.9]]
```

Cada número do resultado depende de multiplicações independentes entre si. Perfeito para paralelismo.

Em uma rede neural com 128 neurônios na primeira camada:
- CPU processa os 128 neurônios um após o outro
- GPU processa os 128 neurônios **ao mesmo tempo**

---

## No TensorFlow.js

```js
await tf.ready()
// ↑ verifica se a GPU está disponível e inicializa
// se não houver GPU, cai para CPU automaticamente (mais lento)
```

O TensorFlow.js tenta usar a GPU via **WebGL** (a API do browser para gráficos). Quando funciona:
- Treinamento: dezenas de vezes mais rápido
- Inferência: milissegundos em vez de segundos

### Por que tf.tidy() existe

Tensores vivem na **memória da GPU**, não na memória normal do JavaScript. O garbage collector do JS não enxerga essa memória — por isso precisamos do `tf.tidy()` e `tf.dispose()` para limpar manualmente.

```
Memória RAM (JS gerencia):   variáveis, arrays, objetos
Memória GPU (você gerencia): tensores do TensorFlow
```

### Warmup — aquecendo a GPU

```js
// worker.js
const dummyInput = tf.ones(_model.inputs[0].shape)
await _model.executeAsync(dummyInput)
tf.dispose(dummyInput)
```

Na primeira execução, a GPU precisa:
1. Compilar os **shaders** (programas que rodam nos núcleos da GPU)
2. Alocar buffers de memória
3. Otimizar o grafo computacional

Isso leva 1–3 segundos. O warmup faz isso com dados falsos para que a primeira inferência real seja rápida.

---

## CPU vs GPU no ciclo de ML

| Etapa | Quem faz | Por quê |
|---|---|---|
| Carregar dados, lógica, decisões | CPU | Trabalho sequencial e complexo |
| Multiplicar matrizes (treino/inferência) | GPU | Trabalho paralelo e repetitivo |
| Comunicação entre threads (postMessage) | CPU | Gerenciamento de sistema |
| Renderizar o jogo (PIXI.js) | GPU | Desenho de pixels — paralelismo |

---

## Resumo visual

```
CPU                          GPU
┌──────────────────┐         ┌──────────────────────────────────────┐
│ ████ ████        │         │ □□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□ │
│ ████ ████        │         │ □□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□ │
│                  │         │ □□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□ │
│  4–16 núcleos    │         │ □□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□ │
│  complexos       │         │    3.000–10.000+ núcleos simples     │
└──────────────────┘         └──────────────────────────────────────┘

Bom para:                    Bom para:
✓ Lógica condicional         ✓ Multiplicação de matrizes
✓ Gerenciar memória          ✓ Treinamento de redes neurais
✓ Rodar o sistema operacional✓ Inferência (model.predict)
✓ Código JavaScript          ✓ Renderização de jogos/gráficos
```
