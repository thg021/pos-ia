# Exemplo 02 — Duck Hunt com YOLOv5 (Visão Computacional)

**Módulo:** 01 — Fundamentos de IA e LLMs para Programadores
**Projeto:** DuckHunt-JS — jogo Duck Hunt com IA jogando automaticamente

---

## O que é este projeto?

O Duck Hunt é um jogo clássico onde o jogador atira em patos que voam pela tela. Neste exemplo, uma **IA joga o jogo sozinha** usando visão computacional:

1. A cada 200ms, captura uma foto da tela do jogo
2. Passa essa foto para um modelo YOLO
3. O modelo detecta onde está o "kite" (pipa — o pato do jogo modernizado)
4. A IA move a mira para aquela posição e clica

> **Analogia:** É como contratar um jogador que usa óculos com câmera — ele vê a tela, identifica o alvo e atira, sem precisar aprender a jogar do zero.

---

## Diferença entre as partes

| Arquivo | O que faz |
|---|---|
| `DuckHunt-JS-parte01` | Estrutura base — worker carrega o modelo mas retorna posição **hardcoded** (x:400, y:400) |
| `DuckHunt-JS-parte02` | Implementação **real** — processa a saída do YOLO e retorna posição verdadeira do alvo |

Estudar a parte01 primeiro ajuda a entender a estrutura. A parte02 completa a lógica.

---

## Conceito Principal: Detecção de Objetos vs Classificação

Antes de ver o código, é preciso entender dois tipos de problema em visão computacional:

### Classificação (exemplo-01 era assim)
> "O que tem nessa imagem?" → Resposta: "gato" (uma resposta, sem posição)

### Detecção de Objetos (este exemplo)
> "O que tem nessa imagem e **onde está**?" → Resposta: "kite em (320, 180), confiança 87%"

A detecção de objetos entrega:
- **Bounding Box** (caixa delimitadora): coordenadas do retângulo em volta do objeto
- **Score** (confiança): de 0.0 a 1.0 — o quanto o modelo está certo
- **Class** (classe): qual objeto foi detectado

```
┌─────────────────────┐
│                     │
│    ┌───────┐        │
│    │  🪁   │ kite   │
│    │ 87%   │        │
│    └───────┘        │
│                     │
└─────────────────────┘
  x1,y1         x2,y2
```

---

## O Modelo: YOLOv5n

**YOLO** = "You Only Look Once" (Você Olha Apenas Uma Vez)

O nome vem de como ele funciona: em vez de analisar a imagem em partes, o YOLO olha a imagem inteira de uma vez e já retorna todos os objetos detectados. Isso o torna muito rápido.

**YOLOv5n** = versão 5, tamanho "nano" (menor e mais rápido, ideal para o browser)

### Pré-treinado no COCO Dataset

O modelo foi treinado no **COCO** (Common Objects in Context) — um conjunto de dados com 330.000 imagens e 80 categorias de objetos do mundo real.

```json
// labels.json — as 80 classes que o modelo conhece (trecho)
["person", "bicycle", "car", ..., "bird", "cat", "dog", ..., "kite", ...]
```

O índice `33` no array é `"kite"` — exatamente o que o jogo usa como alvo.

> **Análogo à diferença de treinar vs usar:** No exemplo-01, treinamos uma rede do zero. Aqui, usamos um modelo que já foi treinado por outras pessoas, com muito mais dados e poder computacional. É como contratar um especialista em vez de treinar um funcionário do zero.

---

## Arquivo: `machine-learning/worker.js` (parte02 — completo)

Este é o arquivo mais importante. Vamos linha a linha.

```js
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest');
```
**Linha 1** — Carrega o TensorFlow.js dentro do Web Worker. `importScripts` é a forma de importar scripts em Workers clássicos (diferente do `import` do ES Modules). A URL carrega a biblioteca direto da internet.

```js
const MODEL_PATH = `yolov5n_web_model/model.json`;
const LABELS_PATH = `yolov5n_web_model/labels.json`;
const INPUT_MODEL_DIMENTIONS = 640
const CLASS_THRESHOLD = 0.4
```
**Linhas 3–6** — Constantes de configuração:
- `MODEL_PATH`: onde está o arquivo do modelo pré-treinado
- `LABELS_PATH`: onde estão os nomes das 80 classes
- `INPUT_MODEL_DIMENTIONS`: o YOLO espera imagens de 640×640 pixels
- `CLASS_THRESHOLD`: nível mínimo de confiança para aceitar uma detecção (0.4 = 40%)

```js
let _labels = []
let _model = null
```
**Linhas 8–9** — Variáveis globais do worker. O `_` (underscore) no início é convenção para indicar variáveis "privadas" do módulo.

---

### Função: `loadModelAndLabels()`

```js
async function loadModelAndLabels() {
    await tf.ready()
```
**`tf.ready()`** — Aguarda o TensorFlow inicializar completamente, incluindo verificar se a GPU está disponível. Sem isso, operações podem falhar.

```js
    _labels = await (await fetch(LABELS_PATH)).json()
```
Faz duas coisas em sequência:
1. `fetch(LABELS_PATH)` → baixa o arquivo `labels.json`
2. `.json()` → converte o texto JSON em array JavaScript

O resultado é: `["person", "bicycle", "car", ..., "kite", ...]`

```js
    _model = await tf.loadGraphModel(MODEL_PATH)
```
**`tf.loadGraphModel`** — Carrega um modelo pré-treinado exportado no formato TensorFlow.js. 

Diferença importante:
| `tf.sequential()` | `tf.loadGraphModel()` |
|---|---|
| Cria modelo do zero | Carrega modelo já treinado |
| Você define as camadas | As camadas já estão no arquivo |
| Precisa de `model.fit()` | Pronto para usar imediatamente |
| Usado no exemplo-01 | Usado neste exemplo |

```js
    // warmup
    const dummyInput = tf.ones(_model.inputs[0].shape)
    await _model.executeAsync(dummyInput)
    tf.dispose(dummyInput)
```
**Warmup (aquecimento)** — Roda uma inferência falsa antes de usar de verdade.

Por que? Quando o modelo roda pela primeira vez, a GPU precisa compilar os shaders (programas internos da GPU) e alocar memória. Isso pode levar 1-2 segundos. Se o warmup não acontecer, a **primeira inferência real será lenta** — o que poderia travar o jogo no início.

- `tf.ones(_model.inputs[0].shape)` → cria um tensor cheio de `1`s com o formato que o modelo espera (1×640×640×3)
- `_model.executeAsync(dummyInput)` → roda inferência "de teste"
- `tf.dispose(dummyInput)` → libera a memória do tensor descartável

```js
    postMessage({ type: 'model-loaded' })
}
```
Avisa o `main.js` que o modelo está pronto. `postMessage` é como o Worker se comunica de volta com a página.

---

### Função: `preprocessImage(input)`

```js
function preprocessImage(input) {
    return tf.tidy(() => {
```
**`tf.tidy()`** — Gerenciador automático de memória. Tudo que for criado dentro do `tf.tidy()` é automaticamente descartado ao final, exceto o valor retornado. Isso evita vazamentos de memória na GPU.

> **Analogia:** `tf.tidy()` é como uma bancada de laboratório que se limpa sozinha. Você trabalha com vários reagentes (tensores intermediários), e ao sair do lab, tudo é descartado — só você leva o resultado final.

```js
        const image = tf.browser.fromPixels(input)
```
**`tf.browser.fromPixels()`** — Converte uma imagem do browser (ImageBitmap, canvas, img, video) em um tensor 3D.

Saída: tensor de formato `[altura, largura, 3]` onde `3` são os canais de cor (R, G, B).

Exemplo: imagem 800×600 → tensor `[600, 800, 3]`

```js
        return tf.image
            .resizeBilinear(image, [INPUT_MODEL_DIMENTIONS, INPUT_MODEL_DIMENTIONS])
```
**`tf.image.resizeBilinear()`** — Redimensiona a imagem para 640×640 pixels.

Por que 640? O YOLOv5 foi treinado com imagens 640×640. Se passar uma imagem de outro tamanho, as detecções serão imprecisas.

**Bilinear** = método de redimensionamento que interpola pixels vizinhos, produzindo resultado mais suave do que simplesmente cortar pixels.

```js
            .div(255)
```
**Normalização de pixels** — Pixels têm valores de 0 a 255. Dividir por 255 transforma em 0.0 a 1.0.

Por que? O modelo foi treinado com pixels normalizados. Se passarmos valores 0–255, as multiplicações explodem — os neurônios recebem números imensos e as previsões ficam sem sentido.

```js
            .expandDims(0)
```
**`expandDims(0)`** — Adiciona uma dimensão extra no começo.

O YOLO espera um lote (batch) de imagens, mesmo que seja apenas uma:

```
Antes: [640, 640, 3]      → uma imagem
Depois: [1, 640, 640, 3]  → lote com 1 imagem
```

O `0` indica onde inserir a nova dimensão (no início).

---

### Função: `runInference(tensor)`

```js
async function runInference(tensor) {
    const output = await _model.executeAsync(tensor)
    tf.dispose(tensor)
```
**`model.executeAsync()`** — Executa a inferência no modelo graph. Diferente de `model.predict()` (usado em modelos sequential), `executeAsync` é necessário para modelos que têm operações assíncronas internas.

Após a inferência, descartamos o tensor de entrada — não precisamos mais dele.

```js
    const [boxes, scores, classes] = output.slice(0, 3)
```
O YOLO retorna múltiplos tensores de saída. Os três primeiros são:
- `boxes` → coordenadas das caixas delimitadoras
- `scores` → níveis de confiança de cada detecção
- `classes` → índice da classe de cada detecção

```js
    const [boxesData, scoresData, classesData] = await Promise.all(
        [
            boxes.data(),
            scores.data(),
            classes.data(),
        ]
    )
```
**`.data()`** — Converte tensor em array JavaScript (similar ao `.dataSync()` do exemplo-01, mas assíncrono).

**`Promise.all()`** — Executa as três conversões em paralelo. Em vez de esperar uma acabar para começar a outra, as três rodam simultaneamente. Mais rápido.

```js
    output.forEach(t => t.dispose())
    return { boxes: boxesData, scores: scoresData, classes: classesData }
}
```
Descarta todos os tensores de saída e retorna os dados como arrays JavaScript comuns.

---

### Função geradora: `processPrediction()`

Esta é a parte mais importante da parte02 — onde a "mágica" acontece.

```js
function* processPrediction({ boxes, scores, classes }, width, height) {
```
**`function*`** — Declara uma **função geradora** (generator). Em vez de retornar um valor e acabar, ela pode retornar (`yield`) múltiplos valores, um por vez, conforme o chamador pede.

> **Analogia:** Uma fila de supermercado. Em vez do caixa pegar todos os produtos de uma vez e empacotar tudo antes de te dar alguma coisa, ele vai processando um produto por vez e te entregando conforme termina.

```js
    for (let index = 0; index < scores.length; index++) {
        if (scores[index] < CLASS_THRESHOLD) continue
```
Percorre cada detecção. `CLASS_THRESHOLD = 0.4` — se a confiança for menor que 40%, ignora. Isso filtra detecções fracas que provavelmente são falsos positivos.

```js
        const label = _labels[classes[index]]
        if (label !== 'kite') continue
```
Pega o nome da classe detectada e filtra só `'kite'`. O array `_labels` tem 80 itens — `_labels[33]` é `"kite"`.

Mesmo que o YOLO detecte pessoas, carros, cachorros na tela, só o `kite` nos interessa.

```js
        let [x1, y1, x2, y2] = boxes.slice(index * 4, (index + 1) * 4)
```
As coordenadas das caixas são armazenadas sequencialmente no array `boxes`: cada detecção ocupa 4 posições consecutivas `[x1, y1, x2, y2]`.

Para a detecção `index = 2`, as coordenadas estão nas posições 8, 9, 10, 11 do array.

As coordenadas vêm **normalizadas** (0.0 a 1.0), relativas ao tamanho da imagem.

```js
        x1 *= width
        x2 *= width
        y1 *= height
        y2 *= height
```
Converte coordenadas normalizadas para pixels reais da tela. Se `x1 = 0.35` e a tela tem 800px de largura: `0.35 × 800 = 280px`.

```js
        const boxWidth = x2 - x1
        const boxHeight = y2 - y1
        const centerX = x1 + boxWidth / 2
        const centerY = y1 + boxHeight / 2
```
Calcula o **centro** da caixa delimitadora — é onde a IA vai apontar a mira.

```
┌──────────────┐
│ x1,y1        │
│              │
│   cx, cy ←──┼── onde atirar
│              │
│        x2,y2 │
└──────────────┘
```

```js
        yield {
            x: centerX,
            y: centerY,
            score: (scores[index] * 100).toFixed(2)
        }
    }
}
```
**`yield`** — Entrega uma detecção para quem está consumindo a função. A execução da função **pausa** aqui até o chamador pedir o próximo valor. Isso é eficiente: se houver 10 detecções mas só precisarmos da primeira, não processamos as outras 9.

---

### Inicialização e Handler de mensagens

```js
loadModelAndLabels()
```
Executa assim que o Worker é criado — começa a carregar o modelo imediatamente em segundo plano.

```js
self.onmessage = async ({ data }) => {
    if (data.type !== 'predict') return
    if (!_model) return
```
`self` = o próprio Worker. Escuta mensagens vindas do `main.js`. Se o modelo ainda não carregou (`_model = null`), ignora a mensagem.

```js
    const input = preprocessImage(data.image)
    const { width, height } = data.image
    const inferenceResults = await runInference(input)
```
Pré-processa a imagem recebida, guarda as dimensões originais (necessárias para converter coordenadas), roda a inferência.

```js
    for (const prediction of processPrediction(inferenceResults, width, height)) {
        postMessage({
            type: 'prediction',
            ...prediction
        });
    }
};
```
Itera sobre as detecções válidas (kite com score ≥ 40%) e envia cada uma de volta para o `main.js` via `postMessage`. O `...prediction` espalha os campos `{x, y, score}` na mensagem.

---

## Arquivo: `machine-learning/main.js` (parte02)

```js
import { buildLayout } from "./layout";

export default async function main(game) {
    const container = buildLayout(game.app);
```
Cria o HUD (Heads-Up Display) — o painel de informações na tela com o score e as coordenadas.

```js
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
```
Cria o Web Worker. `new URL('./worker.js', import.meta.url)` garante que o caminho funciona corretamente independente de onde a página foi carregada.

```js
    game.stage.aim.visible = false;
```
Esconde a mira no início — ela só aparece quando a IA encontrar um alvo.

```js
    worker.onmessage = ({ data }) => {
        const { type, x, y } = data;

        if (type === 'prediction') {
            console.log(`🎯 AI predicted at: (${x}, ${y})`);
            container.updateHUD(data);
            game.stage.aim.visible = true;

            game.stage.aim.setPosition(data.x, data.y);
            const position = game.stage.aim.getGlobalPosition();

            game.handleClick({ global: position });
        }
    };
```
Quando o Worker envia uma detecção:
1. Loga no console a posição detectada
2. Atualiza o HUD com as coordenadas
3. Torna a mira visível
4. Move a mira para a posição detectada
5. Simula um clique nessa posição — **atira!**

```js
    setInterval(async () => {
        const canvas = game.app.renderer.extract.canvas(game.stage);
        const bitmap = await createImageBitmap(canvas);

        worker.postMessage({
            type: 'predict',
            image: bitmap,
        }, [bitmap]);

    }, 200);
```
A cada 200ms (5 vezes por segundo):
1. **Captura** um screenshot do canvas do jogo
2. Converte para `ImageBitmap` (formato otimizado para transferência)
3. Envia para o Worker com o tipo `'predict'`

O segundo argumento `[bitmap]` de `postMessage` é a lista de **transferíveis** — objetos que são transferidos diretamente para o Worker sem cópia, muito mais eficiente para imagens grandes.

---

## Arquivo: `machine-learning/layout.js`

```js
import * as PIXI from 'pixi.js';

export function buildLayout(app) {
    const hud = new PIXI.Container();
    hud.y = 50;
    hud.zIndex = 1000;
```
Cria um container PIXI.js para o HUD. `zIndex: 1000` garante que fica sempre acima de todos os outros elementos do jogo.

```js
    const scoreText = new PIXI.Text({
        text: 'Score: 0',
        style: { fontFamily: 'monospace', fontSize: 24, fill: 0xffffff, stroke: 0x000000 }
    });
    hud.addChild(scoreText);
```
Texto do placar. `fill: 0xffffff` = branco. `stroke: 0x000000` = contorno preto (para legibilidade sobre qualquer fundo).

```js
    const predictionsText = new PIXI.Text({
        text: 'Predictions:',
        style: { fontFamily: 'monospace', fontSize: 16, fill: 0xfff666, ... }
    });
```
Texto que mostra as coordenadas das predições (útil para debug visual).

```js
    function updateHUD(data) {
        scoreText.text = `Score: ${data.score}`;
        predictionsText.text = `Predictions: (${Math.round(data.x)}, ${Math.round(data.y)})`;
        positionHUD();
    }

    return { updateHUD };
}
```
Expõe `updateHUD` para que o `main.js` possa atualizar o display a cada predição.

---

## Fluxo Completo — Como a IA joga

```
INÍCIO
  └─ Worker criado → loadModelAndLabels() começa em segundo plano

LOOP (a cada 200ms)
  1. main.js captura screenshot do canvas
  2. Converte para ImageBitmap
  3. Transfere para o Worker

WORKER PROCESSA
  4. preprocessImage()
      └─ fromPixels → tensor [H, W, 3]
      └─ resizeBilinear → tensor [640, 640, 3]
      └─ div(255) → tensor [640, 640, 3] (valores 0–1)
      └─ expandDims(0) → tensor [1, 640, 640, 3]
  5. runInference()
      └─ model.executeAsync(tensor) → [boxes, scores, classes]
      └─ Converte tensores para arrays JS
  6. processPrediction()
      └─ Para cada detecção:
          ├─ score < 0.4? → ignora
          ├─ label ≠ 'kite'? → ignora
          └─ Calcula centro do bounding box

RESULTADO
  7. Worker envia { type: 'prediction', x, y, score }
  8. main.js move a mira para (x, y)
  9. main.js simula clique → ATIRA!
```

---

## Diferença entre parte01 e parte02

A parte01 tem o worker, mas sem a lógica real de processamento:

```js
// parte01/worker.js — linha final do onmessage
// debugger — não implementado ainda
postMessage({ type: 'prediction', x: 400, y: 400, score: 0 });
// ↑ sempre retorna o centro da tela, independente de onde está o kite
```

A parte02 adiciona a função `processPrediction` e a constante `CLASS_THRESHOLD` — tornando o sistema funcional.

Essa é a progressão pedagógica: primeiro entender a estrutura (parte01), depois implementar a lógica (parte02).

---

## Conceitos Importantes do Exemplo 02

### 1. Transfer Learning (Aprendizado por Transferência)
Usar um modelo treinado por outra pessoa em outro problema e aplicar no seu problema. O YOLOv5n foi treinado para detectar 80 objetos — nós "emprestamos" esse conhecimento para detectar apenas o `kite`.

### 2. Pre-trained Model vs Training from Scratch
- **Do zero** (exemplo-01): você coleta dados, define a arquitetura, treina, espera horas/dias
- **Pré-treinado** (este exemplo): você baixa um arquivo `.json` e usa imediatamente

### 3. Confidence Score (Pontuação de Confiança)
Todo modelo de detecção diz "encontrei um kite com 87% de confiança". O `CLASS_THRESHOLD = 0.4` define o mínimo aceitável. Muito alto (0.9) → perde detecções reais. Muito baixo (0.1) → aceita falsos positivos.

### 4. Bounding Box
Retângulo que envolve o objeto detectado. Representado por 4 números: `[x1, y1, x2, y2]` (canto superior esquerdo e canto inferior direito). Vêm normalizados (0.0–1.0) e precisam ser multiplicados pelo tamanho da tela para virar pixels.

### 5. Graph Model vs Sequential Model
| Sequential | Graph |
|---|---|
| Camadas em sequência simples | Arquitetura complexa com múltiplas saídas |
| `model.predict()` | `model.executeAsync()` |
| Para treinar do zero | Para modelos pré-treinados exportados |
| Exemplo-01 | Exemplo-02 |

### 6. Função Geradora (Generator)
`function*` com `yield` — retorna valores um por vez. Eficiente quando temos uma coleção de resultados e queremos processar conforme chegam, sem criar uma lista intermediária.

---

## Resumo Visual

```
📸 Screenshot do jogo (a cada 200ms)
       ↓
🔧 Pré-processamento
   [H,W,3] → [640,640,3] → /255 → [1,640,640,3]
       ↓
🧠 YOLOv5n (modelo pré-treinado)
       ↓
📊 Saída: boxes + scores + classes
       ↓
🔍 Filtro: score ≥ 0.4 AND classe = "kite"
       ↓
📍 Centro do bounding box → (x, y)
       ↓
🎯 Move mira + atira!
```
