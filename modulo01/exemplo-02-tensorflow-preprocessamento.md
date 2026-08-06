# TensorFlow.js — Pré-processamento de Imagem

**Módulo:** 01 — Fundamentos de IA e LLMs para Programadores
**Projeto:** DuckHunt-JS com YOLOv5n

---

## Por que pré-processar?

O YOLOv5n foi treinado esperando imagens em um formato muito específico:
- Tamanho: **640×640 pixels**
- Valores: **0.0 a 1.0** (não 0–255)
- Formato: tensor **[1, 640, 640, 3]** (batch, altura, largura, canais RGB)

Se passarmos qualquer outra coisa, as detecções serão completamente erradas — o modelo simplesmente não entende.

O pré-processamento é a transformação da imagem do jogo para esse formato exato.

---

## O pipeline completo

```
ImageBitmap do canvas
        ↓
tf.browser.fromPixels()
   [H, W, 3]  →  valores 0–255
        ↓
tf.image.resizeBilinear()
   [640, 640, 3]  →  valores 0–255
        ↓
.div(255)
   [640, 640, 3]  →  valores 0.0–1.0
        ↓
.expandDims(0)
   [1, 640, 640, 3]  →  pronto para o YOLO
```

No código:

```js
function preprocessImage(input) {
    return tf.tidy(() => {
        const image = tf.browser.fromPixels(input)
        return tf.image
            .resizeBilinear(image, [640, 640])
            .div(255)
            .expandDims(0)
    })
}
```

---

## 1. tf.browser.fromPixels()

Converte uma imagem do browser em um tensor 3D.

### O que aceita

| Tipo | Exemplo |
|---|---|
| `HTMLImageElement` | `<img>` tag |
| `HTMLCanvasElement` | `<canvas>` tag |
| `HTMLVideoElement` | `<video>` tag |
| `ImageBitmap` | `createImageBitmap(canvas)` |
| `ImageData` | `ctx.getImageData()` |

No projeto: recebe um `ImageBitmap` do canvas do jogo.

### O que produz

Um tensor de formato `[altura, largura, 3]`:

```
Imagem 800×600 → tensor shape [600, 800, 3]
                                  ↑    ↑   ↑
                               altura  largura  RGB
```

Os valores são inteiros de **0 a 255** — um para cada canal de cor (R, G, B) de cada pixel.

```
pixel vermelho puro → [255, 0, 0]
pixel verde puro    → [0, 255, 0]
pixel branco        → [255, 255, 255]
pixel preto         → [0, 0, 0]
```

> **Analogia:** Pegar uma foto e desmontá-la em uma tabela gigante, onde cada célula tem 3 números (vermelho, verde, azul) descrevendo aquele ponto da imagem.

---

## 2. tf.image.resizeBilinear()

Redimensiona o tensor de imagem para um tamanho específico.

```js
tf.image.resizeBilinear(image, [640, 640])
// [600, 800, 3] → [640, 640, 3]
```

### Por que 640×640?

O YOLOv5n foi treinado com imagens quadradas de 640×640. Se passarmos outro tamanho, as coordenadas das bounding boxes estarão todas erradas — o modelo "pensa" que está olhando 640×640, mas as posições não batem com a imagem real.

### O que "bilinear" significa

É o método de interpolação usado ao redimensionar:

**Mais simples (nearest neighbor):** copia o pixel mais próximo — resultado blocado/pixelado
**Bilinear:** calcula a média ponderada dos 4 pixels vizinhos — resultado suavizado

```
Imagem original (3×3):    Redimensionada para 2×2:
┌───┬───┬───┐              ┌────────┬────────┐
│ 10│ 20│ 30│              │ 15     │ 25     │
├───┼───┼───┤     →        │(média) │(média) │
│ 40│ 50│ 60│              ├────────┼────────┤
├───┼───┼───┤              │ 45     │ 55     │
│ 70│ 80│ 90│              │(média) │(média) │
└───┴───┴───┘              └────────┴────────┘
```

Bilinear preserva melhor os contornos dos objetos — importante para detecção precisa.

---

## 3. .div(255) — normalização dos pixels

```js
.div(255)
// valores 0–255 → valores 0.0–1.0
```

### Por que normalizar?

Redes neurais funcionam melhor com valores pequenos próximos de zero. Com pixels 0–255:

- As multiplicações ficam enormes → os gradientes explodem
- O treinamento fica instável
- O modelo não converge

Com 0.0–1.0:
- Multiplicações controladas
- Gradientes estáveis
- Compatível com como o modelo foi treinado

```
Pixel (255, 128, 0)  →  tensor [1.0, 0.502, 0.0]
Pixel (0, 0, 0)      →  tensor [0.0, 0.0, 0.0]
Pixel (255, 255, 255)→  tensor [1.0, 1.0, 1.0]
```

> **Isso é idêntico à normalização do exemplo-01**, onde fazíamos `(valor - min) / (max - min)`. Aqui min=0 e max=255, então simplifica para `valor / 255`.

---

## 4. .expandDims(0)

Adiciona uma nova dimensão no índice especificado.

```js
.expandDims(0)
// shape [640, 640, 3] → shape [1, 640, 640, 3]
//                              ↑
//                        dimensão de batch
```

### Por que o modelo espera um batch?

Modelos de ML foram projetados para processar **lotes de imagens** de uma vez. Isso é mais eficiente na GPU (processa 32 imagens em paralelo em vez de uma por vez).

Mesmo que estejamos passando apenas 1 imagem, o modelo ainda espera o formato de lote:

```
[N, H, W, C]
 ↑  ↑  ↑  ↑
 │  │  │  └─ Canais (3 = RGB)
 │  │  └──── Largura (640)
 │  └─────── Altura (640)
 └────────── Número de imagens no lote (1 = apenas uma)
```

O `0` em `expandDims(0)` indica que a nova dimensão é inserida **na posição 0** (no início):

```
expandDims(0):  [640, 640, 3] → [1, 640, 640, 3]  ← batch na frente
expandDims(3):  [640, 640, 3] → [640, 640, 3, 1]  ← batch no final (errado aqui)
```

---

## 5. tf.tidy() — gerenciamento de memória

```js
function preprocessImage(input) {
    return tf.tidy(() => {
        // tudo dentro aqui é "lixo temporário"
        const image = tf.browser.fromPixels(input)   // tensor A
        const resized = tf.image.resizeBilinear(...)  // tensor B
        const divided = resized.div(255)              // tensor C
        return divided.expandDims(0)                  // tensor D ← único retornado
        // ao sair do tidy: A, B, C são descartados automaticamente
        // D sobrevive porque foi retornado
    })
}
```

### Por que isso é necessário?

TensorFlow.js armazena tensores na memória da **GPU**, não na memória normal do JavaScript. O garbage collector do JavaScript **não gerencia** a memória da GPU.

Sem `tf.tidy()`, cada chamada a `preprocessImage` vaza tensores na GPU:

```
Chamada 1: cria tensores A1, B1, C1, D1 → D1 usado, A1 B1 C1 ficam na GPU
Chamada 2: cria tensores A2, B2, C2, D2 → D2 usado, A2 B2 C2 ficam na GPU
...
Chamada N: GPU lotada → crash ou lentidão extrema
```

Com `tf.tidy()`:
```
Chamada 1: A1 B1 C1 descartados automaticamente ao sair do tidy → só D1 sobrevive
Chamada 2: A2 B2 C2 descartados → só D2 sobrevive
```

> **Analogia:** Uma bancada de laboratório que se limpa sozinha. Você trabalha com vários reagentes temporários, e ao terminar o experimento, tudo é descartado — você só leva o resultado final.

### Regra de ouro

```
Dentro do tf.tidy():
  ✓ Operações intermediárias que criam tensores temporários
  ✓ Transformações encadeadas (.div, .expandDims, etc.)

Fora do tf.tidy():
  ✓ O tensor final que será usado depois
  ✓ tf.dispose() manual quando necessário
```

---

## 6. tf.dispose() — descarte manual

```js
// worker.js — loadModelAndLabels()
const dummyInput = tf.ones(_model.inputs[0].shape)
await _model.executeAsync(dummyInput)
tf.dispose(dummyInput)  // ← descarte manual

// worker.js — runInference()
const output = await _model.executeAsync(tensor)
tf.dispose(tensor)  // ← tensor de entrada descartado após uso
output.forEach(t => t.dispose())  // ← saídas descartadas após extrair dados
```

`tf.dispose()` é para quando **não** estamos dentro de um `tf.tidy()`. Descarta um tensor específico da memória da GPU.

### Quando usar cada um

| Situação | Usar |
|---|---|
| Operações intermediárias em uma função | `tf.tidy()` |
| Tensor específico que não será mais usado | `tf.dispose()` |
| Array de tensores | `output.forEach(t => t.dispose())` |

---

## 7. model.executeAsync() — inferência assíncrona

```js
async function runInference(tensor) {
    const output = await _model.executeAsync(tensor)
    // output = array de tensores com os resultados
}
```

### Por que `executeAsync` e não `predict`?

| `model.predict()` | `model.executeAsync()` |
|---|---|
| Síncrono | Assíncrono |
| Modelos simples (sequential) | Modelos complexos (graph) |
| Retorna um tensor | Retorna array de tensores |
| Sem operações paralelas internas | Suporta operações complexas |

O YOLOv5 tem internamente operações que precisam ser assíncronas. Usar `predict()` causaria erros.

### A saída do YOLO

```js
const output = await _model.executeAsync(tensor)
// output = [tensor_boxes, tensor_scores, tensor_classes, ...outros]

const [boxes, scores, classes] = output.slice(0, 3)
// Pegamos apenas os 3 primeiros — os que nos interessam
```

---

## 8. Warmup — aquecimento da GPU

```js
// worker.js — loadModelAndLabels()
const dummyInput = tf.ones(_model.inputs[0].shape)
await _model.executeAsync(dummyInput)
tf.dispose(dummyInput)
```

### O problema que o warmup resolve

Quando a GPU roda um modelo pela **primeira vez**:
1. Compila os shaders (programas da GPU)
2. Aloca buffers de memória
3. Otimiza o grafo computacional

Isso toma 1–3 segundos. Se acontecer durante o jogo, a IA "congela" no início.

### A solução: inferência "dummy"

- `tf.ones(shape)` → tensor preenchido com `1`s (dados falsos mas com o formato certo)
- `_model.inputs[0].shape` → `[1, 640, 640, 3]` — o formato que o modelo espera
- Rodamos a inferência completa com dados falsos
- A GPU aquece, compila, aloca tudo
- Descartamos o resultado (não importa)
- Agora a **primeira inferência real é rápida**

> **Analogia:** Aquecer o carro no frio antes de sair. O motor já está na temperatura ideal quando você realmente precisa ir.

---

## 9. Extraindo dados dos tensores (.data())

```js
const [boxesData, scoresData, classesData] = await Promise.all([
    boxes.data(),
    scores.data(),
    classes.data(),
])
```

### .data() vs .dataSync()

| `.dataSync()` | `.data()` |
|---|---|
| Síncrono — bloqueia a thread | Assíncrono — não bloqueia |
| `const arr = tensor.dataSync()` | `const arr = await tensor.data()` |
| Simples, mas pode congelar a UI | Recomendado em workers/async |

No exemplo-01 usamos `.dataSync()` porque estava em um Worker (não importava bloquear). Aqui usamos `.data()` com `Promise.all()` para extrair os 3 arrays em paralelo.

### O que retornam

```
boxes.data()   → Float32Array [x1, y1, x2, y2, x1, y1, ...]  (4 números por detecção)
scores.data()  → Float32Array [0.87, 0.62, 0.31, ...]         (1 número por detecção)
classes.data() → Float32Array [33, 14, 0, ...]                 (1 índice por detecção)
```

`Float32Array` é como um array JavaScript mas especializado em floats de 32 bits — mais eficiente para operações matemáticas.

---

## Resumo do fluxo completo com tipos

```
ImageBitmap  →  tf.browser.fromPixels()  →  Tensor [H, W, 3]    valores: 0–255
                tf.image.resizeBilinear() →  Tensor [640, 640, 3] valores: 0–255
                .div(255)                →  Tensor [640, 640, 3] valores: 0.0–1.0
                .expandDims(0)           →  Tensor [1, 640, 640, 3] ← input do YOLO

model.executeAsync(tensor) →  [boxes_tensor, scores_tensor, classes_tensor, ...]

boxes_tensor.data()   →  Float32Array (coordenadas normalizadas)
scores_tensor.data()  →  Float32Array (confiança 0.0–1.0)
classes_tensor.data() →  Float32Array (índices das classes)

processPrediction()   →  filtra e converte para pixels reais  →  {x, y, score}
```
