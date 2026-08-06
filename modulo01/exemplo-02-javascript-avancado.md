# JavaScript Avançado — Exemplo 02 Duck Hunt

**Módulo:** 01 — Fundamentos de IA e LLMs para Programadores
**Projeto:** DuckHunt-JS com YOLOv5n

---

## Visão geral

Este projeto usa 7 recursos avançados de JavaScript que trabalham juntos para manter a IA rodando sem travar o jogo:

```
setInterval (200ms)
    ↓ captura canvas
createImageBitmap()
    ↓ prepara imagem
postMessage([bitmap])  ← Transferable Objects
    ↓ envia para o Worker
importScripts()  ← dentro do Worker
    ↓ carrega TF.js
Worker processa
    ↓ generator function* com yield
postMessage({ prediction })
    ↓ retorna para a página
Promise.all()
    ↓ extrai dados em paralelo
```

---

## 1. Web Worker — thread separada

O browser normalmente é **single-threaded** — só faz uma coisa de cada vez. Se rodarmos inferência de ML na thread principal, o jogo congela enquanto o modelo processa.

### Problema sem Worker

```
Thread principal:
  renderiza jogo → processa ML (2 segundos) → renderiza jogo → processa ML → ...
                       ↑
                    jogo congela aqui por 2 segundos
```

### Solução com Worker

```
Thread principal:        Thread do Worker:
  renderiza jogo       │  carrega modelo
  renderiza jogo       │  processa imagem 1
  renderiza jogo       │  processa imagem 2
  recebe resultado ←───┘  envia resultado
  move mira, atira
```

### Como criar um Worker

```js
// main.js
const worker = new Worker(
    new URL('./worker.js', import.meta.url),  // ← caminho do arquivo
    { type: 'module' }                        // ← suporte a ES modules
)
```

`new URL('./worker.js', import.meta.url)` é necessário porque o `import.meta.url` é o caminho do arquivo `main.js`. Isso garante que o Worker seja encontrado mesmo que a página seja carregada de diferentes URLs.

### Comunicação: postMessage / onmessage

A comunicação entre Worker e página principal é feita por **mensagens** — não por variáveis compartilhadas:

```js
// Página principal → Worker (envia imagem para processar)
worker.postMessage({ type: 'predict', image: bitmap }, [bitmap])

// Worker → Página principal (envia resultado)
self.postMessage({ type: 'prediction', x: 320, y: 198, score: '87.00' })

// Receber na página principal
worker.onmessage = ({ data }) => {
    if (data.type === 'prediction') { ... }
}

// Receber no Worker
self.onmessage = ({ data }) => {
    if (data.type === 'predict') { ... }
}
```

---

## 2. Generator Function (function* / yield)

Uma função geradora é um tipo especial de função que pode **pausar** e **retomar** sua execução.

### Função normal vs Generator

```js
// Função normal — executa tudo e retorna uma vez
function getDetections(data) {
    const results = []
    for (...) {
        results.push({ x, y, score })
    }
    return results  // ← retorna tudo de uma vez
}

// Generator — retorna um por vez, conforme solicitado
function* getDetections(data) {
    for (...) {
        yield { x, y, score }  // ← pausa aqui, entrega um resultado
    }
    // ← retoma quando o chamador pede o próximo
}
```

### Como usar um generator

```js
// worker.js — onmessage
for (const prediction of processPrediction(inferenceResults, width, height)) {
    postMessage({ type: 'prediction', ...prediction })
}
```

O `for...of` pede um valor por vez ao generator. A cada iteração:
1. `processPrediction` retoma de onde parou
2. Encontra o próximo kite válido
3. Faz `yield` — entrega e pausa
4. O loop envia a mensagem
5. Repete

### Por que usar generator aqui?

Vantagens no contexto do projeto:

1. **Não cria lista intermediária** — sem `const results = []` na memória
2. **Processa conforme usa** — se quiser só a primeira detecção, não processa as outras
3. **Mais legível** — código parece um loop simples mas faz lazy evaluation

### A sintaxe completa

```js
function* processPrediction({ boxes, scores, classes }, width, height) {
//        ↑ asterisco indica generator
    for (let index = 0; index < scores.length; index++) {
        if (scores[index] < CLASS_THRESHOLD) continue

        const label = _labels[classes[index]]
        if (label !== 'kite') continue

        // ... calcula centro ...

        yield { x: centerX, y: centerY, score: ... }
        //  ↑ pausa aqui e entrega o objeto
        // execução retoma aqui quando o próximo for pedido
    }
    // quando o loop acaba, o generator encerra (StopIteration automático)
}
```

---

## 3. ImageBitmap

`ImageBitmap` é um formato de imagem otimizado do browser, criado com `createImageBitmap()`.

### Por que usar ImageBitmap em vez do canvas diretamente?

```js
// Opção 1: enviar canvas (ineficiente)
const canvas = game.app.renderer.extract.canvas(game.stage)
worker.postMessage({ image: canvas })
// canvas não é transferível → é copiado (duplicado na memória)

// Opção 2: enviar ImageBitmap (eficiente)
const canvas = game.app.renderer.extract.canvas(game.stage)
const bitmap = await createImageBitmap(canvas)  // ← converte para bitmap
worker.postMessage({ image: bitmap }, [bitmap])   // ← transfere (sem cópia)
```

### Propriedades do ImageBitmap

- Imutável — não pode ser modificado depois de criado
- Decodificado — pixels já prontos para uso
- Transferível — pode ser enviado ao Worker sem cópia
- Aceito por `tf.browser.fromPixels()` diretamente

---

## 4. Transferable Objects (Objetos Transferíveis)

Normalmente, quando você usa `postMessage`, os dados são **clonados** (copiados):

```
Thread A               Thread B
[bitmap: 1.2MB] ──────→ [bitmap: 1.2MB]  ← cópia
               copiar
Total na memória: 2.4MB
```

Com **Transferable Objects**, a propriedade é **transferida** — não copiada:

```
Thread A               Thread B
[bitmap: 1.2MB] ──────→ [bitmap: 1.2MB]  ← transferido
               mover
Thread A fica sem o bitmap
Total na memória: 1.2MB
```

### Como usar

```js
worker.postMessage(
    { type: 'predict', image: bitmap },  // ← os dados
    [bitmap]                              // ← lista de transferíveis
)
```

O segundo argumento é um array com os objetos a serem transferidos. Após o `postMessage`, a variável `bitmap` na thread principal **fica vazia** (neutered) — a propriedade foi cedida ao Worker.

### Quais objetos são transferíveis

| Tipo | Uso comum |
|---|---|
| `ArrayBuffer` | Dados binários |
| `ImageBitmap` | Imagens |
| `MessagePort` | Canais de comunicação |
| `OffscreenCanvas` | Canvas fora da tela |

> **Analogia:** Transferir o documento original em vez de tirar xerox. Quem enviou fica sem o documento — quem recebeu tem o original.

---

## 5. Promise.all() — paralelismo assíncrono

```js
const [boxesData, scoresData, classesData] = await Promise.all([
    boxes.data(),
    scores.data(),
    classes.data(),
])
```

### Problema que resolve

Extrair dados de 3 tensores sequencialmente:

```js
// Sequencial — lento
const boxesData  = await boxes.data()   // espera 10ms
const scoresData = await scores.data()  // espera mais 10ms
const classesData = await classes.data() // espera mais 10ms
// Total: ~30ms
```

Com `Promise.all`:

```js
// Paralelo — rápido
const [boxesData, scoresData, classesData] = await Promise.all([
    boxes.data(),   // ─┐ todas iniciam ao mesmo tempo
    scores.data(),  //  ├─ rodam em paralelo
    classes.data(), // ─┘
])
// Total: ~10ms (o tempo do mais lento)
```

### Comportamento do Promise.all

- Inicia todas as Promises ao mesmo tempo
- Espera **todas** terminarem
- Retorna um array com os resultados em ordem
- Se **qualquer** Promise falhar → o `Promise.all` também falha

```js
// resultado[0] = boxesData   (mesmo index que boxes.data())
// resultado[1] = scoresData
// resultado[2] = classesData
```

---

## 6. setInterval — loop de captura

```js
setInterval(async () => {
    const canvas = game.app.renderer.extract.canvas(game.stage)
    const bitmap = await createImageBitmap(canvas)
    worker.postMessage({ type: 'predict', image: bitmap }, [bitmap])
}, 200)
```

### O que faz

Executa a função a cada **200ms** (5 vezes por segundo) indefinidamente.

### Por que 200ms?

| Intervalo | FPS equivalente | Tradeoff |
|---|---|---|
| 33ms | 30 fps | CPU/GPU sobrecarregada |
| 100ms | 10 fps | IA um pouco lenta |
| 200ms | 5 fps | Bom equilíbrio neste projeto |
| 500ms | 2 fps | IA lenta demais |

200ms é suficiente para o jogo — o kite não se move rápido o suficiente para escapar entre duas detecções.

### Por que `async`?

A função dentro do `setInterval` é `async` porque usa `await createImageBitmap(canvas)`. `createImageBitmap` é assíncrono — retorna uma Promise. Sem `async/await`, precisaríamos usar `.then()`.

---

## 7. importScripts() — carregar bibliotecas no Worker

```js
// worker.js — linha 1
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest')
```

### Por que não usar `import`?

O `import` (ES Modules) é a forma moderna de importar em JavaScript. Mas este Worker usa o modo **"classic"** (não module), então `import` não funciona — é necessário `importScripts`.

### Diferença entre os modos de Worker

```js
// Worker classic (usa importScripts)
const worker = new Worker('./worker.js')
// No worker.js: importScripts('biblioteca.js')

// Worker module (usa import)
const worker = new Worker('./worker.js', { type: 'module' })
// No worker.js: import { algo } from './biblioteca.js'
```

No projeto:
- O `worker.js` da parte01 usa **classic** (importScripts)
- O `main.js` cria o Worker com `{ type: 'module' }` — mas isso afeta só o main, não o worker em si

### Por que CDN?

```
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest')
```

Carregar da CDN em vez de instalar localmente (npm) facilita o setup — sem build, sem bundler. O browser baixa e cacheia automaticamente.

---

## Resumo: todos os 7 conceitos trabalhando juntos

```
[setInterval 200ms]
    ↓
[canvas → createImageBitmap]  ← ImageBitmap (otimizado)
    ↓
[worker.postMessage([bitmap])]  ← Transferable (sem cópia)
    ↓
[Worker recebe via onmessage]  ← Web Worker (thread separada)
    ↓
[importScripts carregou TF.js] ← importScripts (bibliotecas no Worker)
    ↓
[inferência e extração]
    ↓
[Promise.all([boxes, scores, classes])]  ← paralelismo
    ↓
[function* processPrediction - yield]  ← Generator (lazy)
    ↓
[postMessage({ prediction })]
    ↓
[main.js recebe → move mira → atira]
```

Cada um dos 7 resolve um problema específico:

| Conceito | Problema que resolve |
|---|---|
| Web Worker | Não travar a UI durante ML |
| Generator function* | Retornar múltiplas detecções eficientemente |
| ImageBitmap | Formato otimizado para transferência |
| Transferable Objects | Enviar imagem sem duplicar na memória |
| Promise.all | Extrair 3 arrays em paralelo |
| setInterval | Capturar frames continuamente |
| importScripts | Carregar TF.js dentro do Worker |
