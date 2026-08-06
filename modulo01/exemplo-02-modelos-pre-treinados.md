# Modelos Pré-treinados — Exemplo 02 Duck Hunt

**Módulo:** 01 — Fundamentos de IA e LLMs para Programadores
**Projeto:** DuckHunt-JS com YOLOv5n

---

## Por que usar um modelo pré-treinado?

Treinar um modelo de visão computacional do zero exige:
- Milhares de imagens rotuladas manualmente
- Dias ou semanas de processamento em GPUs caras
- Conhecimento profundo de arquiteturas de redes neurais

Usando um modelo pré-treinado:
- Baixamos um arquivo `.json` de poucos MB
- Usamos imediatamente no browser
- O modelo já sabe detectar 80 tipos de objetos

> **Analogia:** Em vez de ensinar seu funcionário a dirigir do zero (meses), você contrata alguém que já tem carteira e experiência. O conhecimento já está lá.

---

## 1. Pre-trained Model (Modelo Pré-treinado)

Um modelo pré-treinado é uma rede neural cujos **pesos já foram ajustados** por um processo de treinamento anterior, geralmente com datasets enormes e infraestrutura cara.

### Comparação com exemplo-01

| Exemplo 01 | Exemplo 02 |
|---|---|
| Treinamos do zero | Usamos modelo já treinado |
| 50 pares de treino | Treinado em 330.000 imagens |
| `tf.sequential()` + `model.fit()` | `tf.loadGraphModel()` |
| Treino demora (100 epochs) | Só carregamento (download) |
| Pesos aleatórios → ajustados | Pesos já otimizados |
| Funciona para recomendação de produtos | Funciona para detecção de objetos |

### Como o arquivo do modelo é estruturado

```
yolov5n_web_model/
  model.json       ← arquitetura + metadados + shards
  group1-shard1of4.bin  ┐
  group1-shard2of4.bin  ├── pesos da rede neural (binários)
  group1-shard3of4.bin  │   cada shard ≈ alguns MB
  group1-shard4of4.bin  ┘
```

O `model.json` descreve a arquitetura da rede e aponta para os arquivos `.bin` que contêm os pesos numéricos.

---

## 2. Transfer Learning (Aprendizado por Transferência)

Transfer Learning é a prática de usar o conhecimento de um modelo treinado em uma tarefa para resolver outra tarefa.

### Como funciona aqui

O YOLOv5n foi treinado para detectar **80 objetos diferentes**. Nós precisamos de apenas **1** (o kite). Então:

- Usamos o modelo inteiro, sem modificações
- Filtramos a saída para só aceitar a classe "kite"
- O modelo continua detectando pessoas, carros, etc. — mas ignoramos tudo exceto kite

```js
// worker.js — processPrediction()
const label = _labels[classes[index]]
if (label !== 'kite') continue  // ← ignora tudo que não for kite
```

### Formas de Transfer Learning

| Forma | O que faz | Quando usar |
|---|---|---|
| **Feature Extraction** (este projeto) | Usa o modelo como está, filtra a saída | Quando o modelo já conhece o objeto |
| **Fine-tuning** | Re-treina as últimas camadas com seus dados | Quando o objeto é parecido mas diferente |
| **Full retraining** | Re-treina tudo com novos dados | Quando o problema é muito diferente |

> **Analogia:** Feature Extraction é contratar um chef que já sabe cozinhar tudo e pedir só pratos específicos. Fine-tuning é ensinar esse chef a fazer uma versão local de um prato. Full retraining é ensinar a cozinhar do zero.

---

## 3. YOLO — You Only Look Once

YOLO é uma arquitetura de rede neural criada em 2016 para **detecção de objetos em tempo real**.

### O que "You Only Look Once" significa

Abordagens antigas de detecção (como R-CNN) faziam dois passos:
1. Gerava centenas de "regiões candidatas" na imagem
2. Classificava cada região separadamente

Isso era **lento** — centenas de passagens pelo modelo por imagem.

O YOLO resolve isso passando a imagem **uma única vez** pela rede, que já retorna todas as detecções de uma vez:

```
Método antigo:
  imagem → [dividir em 2000 regiões] → [classificar cada uma] → resultado
  Tempo: ~2 segundos por imagem

YOLO:
  imagem → [rede neural única] → resultado com todas as detecções
  Tempo: ~30ms por imagem (tempo real)
```

### Como o YOLO "pensa"

O YOLO divide a imagem em uma grade (ex: 20×20 células). Cada célula é responsável por detectar objetos cujo **centro** cai nela:

```
┌───┬───┬───┬───┐
│   │   │   │   │
├───┼───┼───┼───┤
│   │ 🪁│   │   │  ← célula central detecta o kite
├───┼───┼───┼───┤
│   │   │   │   │
└───┴───┴───┴───┘
```

Cada célula prevê: tem objeto aqui? qual classe? qual o tamanho da caixa?

---

## 4. YOLOv5n — a versão nano

YOLOv5 é a versão 5 do YOLO, lançada em 2020. O sufixo "n" significa **nano** — a menor e mais rápida variante.

### Família YOLOv5

| Modelo | Tamanho | Velocidade | Precisão |
|---|---|---|---|
| YOLOv5n | 1.9 MB | Muito rápida | Menor |
| YOLOv5s | 7.2 MB | Rápida | Boa |
| YOLOv5m | 21 MB | Média | Melhor |
| YOLOv5l | 47 MB | Lenta | Alta |
| YOLOv5x | 87 MB | Muito lenta | Máxima |

Para um jogo no browser, o "nano" é a escolha certa — precisamos de resposta rápida e o arquivo precisa ser baixado pelo usuário.

### O que "convertido para TF.js" significa

O YOLOv5 foi originalmente escrito em Python (PyTorch). Para rodar no browser, foi convertido para o formato TensorFlow.js usando o `TFLite Converter`:

```
YOLOv5n (PyTorch) → [TF.js Converter v4.5.0] → yolov5n_web_model/model.json
```

Por isso usamos `tf.loadGraphModel()` e não `tf.sequential()` — o modelo chegou "de fora", não foi construído aqui.

---

## 5. COCO Dataset

**COCO** = Common Objects in Context

Dataset público criado pelo Microsoft com:
- 330.000 imagens do mundo real
- 80 categorias de objetos
- 1.5 milhão de instâncias rotuladas manualmente

### As 80 classes

O `labels.json` do projeto lista as 80 classes em ordem de índice:

```json
["person", "bicycle", "car", "motorcycle", "airplane", "bus", "train",
 "truck", "boat", "traffic light", "fire hydrant", "stop sign",
 ...
 "kite",   ← índice 33
 ...
 "toothbrush"]
```

O índice importa porque o modelo retorna um número (33), não o nome. O `labels.json` faz a tradução:

```js
_labels = await fetch(LABELS_PATH).json()
// _labels[33] === "kite"

const label = _labels[classes[index]]
// classes[index] = 33 → label = "kite"
```

---

## 6. Graph Model vs Sequential

Dois tipos de modelos no TensorFlow.js com comportamentos diferentes:

### Sequential (tf.sequential)
```js
// Exemplo-01: construído do zero, camada por camada
const model = tf.sequential()
model.add(tf.layers.dense({ units: 128, activation: 'relu' }))
model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }))
model.compile({ optimizer: 'adam', loss: 'binaryCrossentropy' })
await model.fit(xs, ys, { epochs: 100 })
```

- Você define a arquitetura
- Precisa compilar e treinar
- Use `model.predict()`

### Graph Model (tf.loadGraphModel)
```js
// Exemplo-02: carregado de arquivo pré-existente
_model = await tf.loadGraphModel('yolov5n_web_model/model.json')
// Pronto para usar imediatamente
const output = await _model.executeAsync(tensor)
```

- A arquitetura vem do arquivo
- Pesos já definidos — não precisa treinar
- Use `model.executeAsync()` (suporta operações complexas)

### Por que `executeAsync` em vez de `predict`?

O YOLO internamente tem operações que precisam ser assíncronas (como certas operações de reshape e concatenação no grafo computacional). `executeAsync` suporta isso. `predict` é mais simples e só funciona em modelos sequential sem essas complexidades.

---

## Resumo: do treinamento original ao uso no browser

```
1. Pesquisadores do Ultralytics treinam YOLOv5n
   └─ Dataset: 330k imagens COCO
   └─ Hardware: GPUs por dias
   └─ Resultado: modelo PyTorch (.pt)

2. Conversão para TensorFlow.js
   └─ TF.js Converter v4.5.0
   └─ Resultado: model.json + shards .bin

3. Nós no browser
   └─ tf.loadGraphModel('model.json')
   └─ Carrega pesos dos .bin
   └─ Pronto para detectar em milissegundos

4. Transfer Learning na prática
   └─ Modelo sabe 80 classes
   └─ Nós filtramos: só "kite"
   └─ Custo zero de treino
```
