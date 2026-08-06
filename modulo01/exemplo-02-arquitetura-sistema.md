---
title: "Arquitetura do Sistema — Exemplo 02 Duck Hunt"
---

# Arquitetura do Sistema — Exemplo 02 Duck Hunt

**Módulo:** 01 — Fundamentos de IA e LLMs para Programadores
**Projeto:** DuckHunt-JS com YOLOv5n

---

## Visão Geral

Este documento descreve como todas as peças do projeto se conectam: o loop de captura, a comunicação entre threads, o HUD e a progressão pedagógica entre parte01 e parte02.

---

## 1. Loop de captura → inferência → ação

Este é o ciclo de vida completo da IA jogando. Repete indefinidamente enquanto o jogo está rodando.

```
┌──────────────────────────────────────────────────────┐
│                    LOOP (a cada 200ms)               │
│                                                      │
│  1. Captura           2. Envia           3. Worker   │
│  ┌──────────┐         ┌────────┐        ┌─────────┐  │
│  │ Canvas   │─bitmap─▶│postMsg │───────▶│TF.js    │  │
│  │ do jogo  │         └────────┘        │YOLO     │  │
│  └──────────┘                           │processo │  │
│                                         └────┬────┘  │
│  5. Ação              4. Resultado           │        │
│  ┌──────────┐         ┌────────┐             │        │
│  │ move mira│◀─{x,y}─│onmsg   │◀────────────┘        │
│  │ clica    │         └────────┘                      │
│  └──────────┘                                         │
└──────────────────────────────────────────────────────┘
```

### Passo a passo

**Passo 1 — Captura do canvas**
```js
const canvas = game.app.renderer.extract.canvas(game.stage)
```
O PIXI.js renderiza o jogo em um canvas WebGL. `extract.canvas()` converte aquele frame atual em um canvas HTML convencional, que pode ser lido pelo TensorFlow.

**Passo 2 — Conversão e envio**
```js
const bitmap = await createImageBitmap(canvas)
worker.postMessage({ type: 'predict', image: bitmap }, [bitmap])
```
Converte para ImageBitmap (eficiente) e transfere para o Worker sem copiar.

**Passo 3 — Processamento no Worker**
```js
const input = preprocessImage(data.image)          // pré-processa
const inferenceResults = await runInference(input) // YOLO detecta
```
Tudo acontece na thread do Worker — a UI do jogo continua rodando normalmente.

**Passo 4 — Resultado**
```js
for (const prediction of processPrediction(inferenceResults, width, height)) {
    postMessage({ type: 'prediction', ...prediction })
}
```
Para cada kite encontrado (pode ser 0 ou mais), envia as coordenadas de volta.

**Passo 5 — Ação no jogo**
```js
game.stage.aim.setPosition(data.x, data.y)
const position = game.stage.aim.getGlobalPosition()
game.handleClick({ global: position })
```
Move a mira para onde o kite está e simula um clique — o jogo entende como tiro.

---

## 2. Comunicação Worker ↔ Main Thread

A comunicação é **assíncrona** e **baseada em mensagens**. As duas threads não compartilham memória — toda troca de informação passa por `postMessage`.

### Protocolo de mensagens

O projeto define um protocolo simples usando o campo `type`:

```js
// Tipos de mensagem

// Main → Worker
{ type: 'predict', image: ImageBitmap }

// Worker → Main
{ type: 'model-loaded' }
{ type: 'prediction', x: Number, y: Number, score: String }
```

### Diagrama de sequência

```
main.js                          worker.js
   │                                 │
   │──── new Worker() ──────────────▶│ (Worker criado)
   │                                 │ loadModelAndLabels() ← inicia
   │                                 │   tf.ready()
   │                                 │   fetch(labels.json)
   │                                 │   tf.loadGraphModel()
   │                                 │   warmup inference
   │◀─── { type: 'model-loaded' } ───│
   │                                 │
   │ [setInterval 200ms começa]      │
   │──── { type: 'predict', image }─▶│
   │                                 │ preprocessImage()
   │                                 │ runInference()
   │                                 │ processPrediction()
   │◀─── { type: 'prediction', x,y }─│
   │ move mira                       │
   │ handleClick()                   │
   │                                 │
   │──── { type: 'predict', image }─▶│ (próximo frame)
   │                                 │ ...
```

### Implicação importante: estado no Worker

Como o Worker roda em thread separada, variáveis como `_model` e `_labels` vivem lá e não são acessíveis da página principal — é por isso que o Worker guarda seu próprio estado:

```js
// worker.js — variáveis de estado do Worker
let _labels = []  // só existe aqui
let _model = null // só existe aqui
```

---

## 3. HUD com PIXI.js

O HUD (Heads-Up Display) é o painel de informações sobrepostoo ao jogo. No Duck Hunt, mostra o score e as coordenadas da predição atual.

### O que é PIXI.js

PIXI.js é uma biblioteca de renderização 2D que usa WebGL para desenhar na tela. O Duck Hunt é feito inteiramente em PIXI.

### Estrutura do HUD

```js
// layout.js

const hud = new PIXI.Container()     // ← container que agrupa os textos
hud.zIndex = 1000                    // ← sempre na frente de tudo

const scoreText = new PIXI.Text({    // ← texto do placar
    text: 'Score: 0',
    style: { fontFamily: 'monospace', fontSize: 24, fill: 0xffffff }
})

const predictionsText = new PIXI.Text({ // ← coordenadas da IA
    text: 'Predictions:',
    style: { fontFamily: 'monospace', fontSize: 16, fill: 0xfff666 }
})

hud.addChild(scoreText)
hud.addChild(predictionsText)
app.stage.addChild(hud)
```

### Atualização dinâmica

```js
function updateHUD(data) {
    scoreText.text = `Score: ${data.score}`
    predictionsText.text = `Predictions: (${Math.round(data.x)}, ${Math.round(data.y)})`
    positionHUD()  // reposiciona no canto superior direito
}
```

A cada predição da IA, o HUD é atualizado com as coordenadas — útil para debugar se a IA está detectando corretamente.

### Posicionamento dinâmico

```js
function positionHUD() {
    const margin = 16
    const hudWidth = Math.max(scoreText.width, predictionsText.width)
    hud.x = app.renderer.width - hudWidth - margin  // ← cola no canto direito
}

// Repositiona se a janela for redimensionada
window.addEventListener('resize', positionHUD)
```

### O que o HUD expõe

```js
return { updateHUD }
// main.js usa: container.updateHUD(data)
```

O `buildLayout` retorna apenas a função `updateHUD` — o resto é encapsulado. Padrão de design: **expor só o que o chamador precisa**.

---

## 4. Progressão parte01 → parte02

O projeto é dividido em duas partes por um motivo pedagógico deliberado.

### Parte01 — a estrutura sem a lógica

```js
// DuckHunt-JS-parte01/machine-learning/worker.js
self.onmessage = async ({ data }) => {
    if (data.type !== 'predict') return
    if (!_model) return

    const input = preprocessImage(data.image)
    const inferenceResults = await runInference(input)

    // debugger — não implementado ainda
    postMessage({ type: 'prediction', x: 400, y: 400, score: 0 });
    //                                ↑ sempre o centro da tela
}
```

A parte01 mostra que:
- O Worker está funcionando
- O modelo carrega e roda
- A comunicação com `main.js` funciona
- A mira se move (para o centro — sempre)

Mas a IA não detecta nada de verdade — apenas retorna coordenadas fixas.

### Parte02 — a lógica real

```js
// DuckHunt-JS-parte02/machine-learning/worker.js
const CLASS_THRESHOLD = 0.4  // ← novo

function* processPrediction({ boxes, scores, classes }, width, height) {  // ← novo
    for (let index = 0; index < scores.length; index++) {
        if (scores[index] < CLASS_THRESHOLD) continue
        const label = _labels[classes[index]]
        if (label !== 'kite') continue
        // ... calcula centro ...
        yield { x: centerX, y: centerY, score: ... }
    }
}

self.onmessage = async ({ data }) => {
    // ...
    for (const prediction of processPrediction(inferenceResults, width, height)) {
        postMessage({ type: 'prediction', ...prediction })  // ← posição real
    }
}
```

A parte02 adiciona:
- `CLASS_THRESHOLD` — filtro de confiança
- `function* processPrediction` — processa a saída do YOLO
- Filtro por classe `'kite'`
- Cálculo do centro da bounding box
- Envio da posição **real** (não mais hardcoded)

### Por que essa progressão funciona pedagogicamente

| Parte | O que aprende |
|---|---|
| Parte01 | Estrutura: Worker, comunicação, fluxo |
| Parte02 | Conteúdo: inferência, bounding box, filtros |

Separar estrutura de conteúdo permite estudar cada um independentemente. A parte01 é mais fácil de entender porque remove a complexidade da detecção — você vê o "esqueleto" funcionando antes de adicionar a "carne".

> **Analogia:** Montar um carro. Parte01 = chassi com rodas que anda, mas sem motor real (motor de brinquedo). Parte02 = coloca o motor de verdade. O chassi já está validado — só falta a potência.

---

## Diagrama completo do sistema

```
JOGO (PIXI.js)
┌─────────────────────────────────────────┐
│  game.stage (Canvas WebGL)              │
│  ┌──────────────────────────────────┐   │
│  │  Kite voando...  🪁              │   │
│  │                                  │   │
│  │           🎯 ← mira da IA        │   │
│  └──────────────────────────────────┘   │
│                                         │
│  HUD (PIXI.Container zIndex=1000)       │
│  ┌──────────────────────────────────┐   │
│  │ Score: 42                        │   │
│  │ Predictions: (320, 198)          │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
         │                    ▲
         │ extract.canvas()   │ handleClick()
         ▼                    │ aim.setPosition()
┌─────────────────────────────────────────┐
│  main.js (Thread Principal)             │
│                                         │
│  setInterval(200ms) {                   │
│    canvas → bitmap → postMessage        │
│  }                                      │
│                                         │
│  worker.onmessage → updateHUD + atirar  │
└─────────────────────────────────────────┘
         │ postMessage([bitmap])
         │                    ▲ postMessage({x,y,score})
         ▼                    │
┌─────────────────────────────────────────┐
│  worker.js (Thread do Worker)           │
│                                         │
│  [init] loadModelAndLabels()            │
│    tf.loadGraphModel('model.json')      │
│    warmup()                             │
│                                         │
│  [onmessage 'predict']                  │
│    preprocessImage()                    │
│      fromPixels → resize → /255 → dim  │
│    runInference()                       │
│      executeAsync → boxes/scores/class  │
│    processPrediction*()                 │
│      filtrar score < 0.4               │
│      filtrar classe ≠ kite             │
│      calcular centro do bbox           │
│      yield { x, y, score }             │
└─────────────────────────────────────────┘
         │
         │ (modelo pré-treinado)
         ▼
┌─────────────────────────────────────────┐
│  yolov5n_web_model/                     │
│    model.json  ← arquitetura            │
│    *.bin       ← pesos (treinados)      │
│    labels.json ← 80 classes COCO        │
└─────────────────────────────────────────┘
```
