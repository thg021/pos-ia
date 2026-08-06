# Visão Computacional — Exemplo 02 Duck Hunt

**Módulo:** 01 — Fundamentos de IA e LLMs para Programadores
**Projeto:** DuckHunt-JS com YOLOv5n

---

## O que é Visão Computacional?

Visão Computacional é a área de IA que ensina computadores a "enxergar" e interpretar imagens e vídeos — da mesma forma que nossos olhos e cérebro fazem, mas de forma automática.

> **Analogia:** Assim como humanos aprendem a reconhecer rostos vendo muitas fotos de pessoas, um modelo de visão computacional aprende a reconhecer objetos vendo milhões de imagens com exemplos marcados.

---

## 1. Detecção de Objetos — diferente de classificação

Este é o conceito mais importante para entender o projeto.

### Classificação de Imagem
> "O que tem nessa imagem?"

- Recebe uma imagem inteira
- Retorna **uma resposta**: "gato" ou "cachorro"
- **Não diz onde** o objeto está
- Exemplo: "isso é um kite" — mas onde?

```
Imagem → [Modelo] → "kite"
```

### Detecção de Objetos
> "O que tem nessa imagem e **onde está**?"

- Recebe uma imagem inteira
- Retorna **múltiplas respostas**: cada objeto detectado com sua posição
- **Diz onde** usando um retângulo (bounding box)
- Diz **o quê** (classe)
- Diz **quão certo** está (score)

```
Imagem → [Modelo] → [
  { classe: "kite", x1: 0.3, y1: 0.2, x2: 0.5, y2: 0.4, score: 0.87 },
  { classe: "bird", x1: 0.7, y1: 0.1, x2: 0.9, y2: 0.3, score: 0.62 },
]
```

### Por que isso importa no projeto?

No Duck Hunt, precisamos **saber onde** o kite está para mover a mira. Classificação não basta — ela só diria "tem um kite", não onde atirar. Detecção de objetos resolve os dois problemas de uma vez.

---

## 2. Bounding Box — o retângulo delimitador

Bounding Box (caixa delimitadora) é o retângulo que envolve um objeto detectado.

### Representação

Quatro números definem o retângulo:

```
[x1, y1, x2, y2]
  ↑    ↑    ↑    ↑
  └─ canto    └─ canto
     superior    inferior
     esquerdo    direito
```

```
┌─────────────────────┐
│  (x1, y1)           │
│    ┌───────────┐    │
│    │           │    │
│    │   kite    │    │
│    │           │    │
│    └───────────┘    │
│            (x2, y2) │
└─────────────────────┘
```

### Coordenadas normalizadas

O YOLO não retorna pixels — retorna valores de **0.0 a 1.0** relativos ao tamanho da imagem:

```
x1 = 0.35  →  35% da largura da imagem
y1 = 0.20  →  20% da altura da imagem
x2 = 0.55  →  55% da largura da imagem
y2 = 0.45  →  45% da altura da imagem
```

**Por que normalizado?** Porque o modelo foi treinado com imagens de vários tamanhos. Normalizar garante que as coordenadas funcionem para qualquer resolução de tela.

### Convertendo para pixels reais

```js
// No worker.js — processPrediction()
let [x1, y1, x2, y2] = boxes.slice(index * 4, (index + 1) * 4)

x1 *= width    // 0.35 × 800px = 280px
x2 *= width    // 0.55 × 800px = 440px
y1 *= height   // 0.20 × 600px = 120px
y2 *= height   // 0.45 × 600px = 270px
```

### Como as caixas ficam no array

O YOLO retorna todas as caixas em um único array plano. Cada detecção ocupa 4 posições:

```
boxes = [x1₀, y1₀, x2₀, y2₀,  x1₁, y1₁, x2₁, y2₁,  x1₂, ...]
         ←── detecção 0 ──→    ←── detecção 1 ──→
```

Para pegar a detecção `index`:
```js
boxes.slice(index * 4, (index + 1) * 4)
// index=0 → slice(0, 4)  → [x1₀, y1₀, x2₀, y2₀]
// index=1 → slice(4, 8)  → [x1₁, y1₁, x2₁, y2₁]
```

---

## 3. Confidence Score — nível de certeza

Cada detecção vem com um score de 0.0 a 1.0:

```
0.95  →  95% de certeza — "com certeza é um kite"
0.62  →  62% de certeza — "provavelmente é um kite"
0.30  →  30% de certeza — "talvez seja um kite"
0.08  →  8%  de certeza — "quase não vejo nada"
```

> **Analogia:** Como um médico fazendo diagnóstico — ele pode dizer "95% de certeza que é gripe" ou "só 30%, preciso de mais exames". O score é esse número de certeza.

### Por que nem toda detecção é verdadeira?

O modelo não é perfeito. Ele pode:
- Ver uma nuvem e achar que é um kite (falso positivo)
- Não ver um kite que está na imagem (falso negativo)

O score ajuda a filtrar os erros.

---

## 4. CLASS_THRESHOLD — o filtro mínimo

`CLASS_THRESHOLD = 0.4` define o limite mínimo de confiança para aceitar uma detecção.

```js
// worker.js — linha 83
if (scores[index] < CLASS_THRESHOLD) continue
// Se score < 0.4 → ignora essa detecção
```

### O dilema do threshold

| Threshold alto (0.9) | Threshold baixo (0.1) |
|---|---|
| Só aceita detecções muito certas | Aceita quase tudo |
| Perde detecções reais (kite distante) | Muitos falsos positivos |
| IA atira pouco | IA atira em tudo, inclusive fundo do céu |

**0.4** é um valor equilibrado para este projeto — aceita detecções com pelo menos 40% de certeza.

### Ajustando para o problema

```
Preciso de mais precisão? → Aumentar threshold (0.6, 0.7)
Estou perdendo muitas detecções? → Diminuir threshold (0.3, 0.2)
```

---

## 5. Coordenadas normalizadas → pixels reais

Já vimos isso na seção de Bounding Box, mas vale aprofundar a lógica do cálculo do centro:

```js
// worker.js — processPrediction()

// Passo 1: canto superior esquerdo e inferior direito em pixels
let [x1, y1, x2, y2] = boxes.slice(index * 4, (index + 1) * 4)
x1 *= width;  x2 *= width
y1 *= height; y2 *= height

// Passo 2: dimensões da caixa
const boxWidth  = x2 - x1  // largura do kite em pixels
const boxHeight = y2 - y1  // altura do kite em pixels

// Passo 3: centro geométrico
const centerX = x1 + boxWidth  / 2
const centerY = y1 + boxHeight / 2
```

**Por que o centro?** A mira precisa apontar para o meio do objeto, não para o canto. Se o kite ocupa de x=200 a x=400, atirar em x=300 (centro) é mais eficaz do que atirar em x=200 (borda esquerda).

```
caixa: x1=200, x2=400
largura: 400 - 200 = 200px
centro: 200 + 200/2 = 300px  ← onde atirar
```

---

## Resumo Visual

```
IMAGEM DO JOGO
┌─────────────────────────────┐
│                             │
│     ┌─────┐                 │
│     │  🪁 │ score: 0.87     │
│     │ kite│                 │
│     └─────┘                 │
│           ↑                 │
│     centro calculado        │
│     → IA move mira aqui     │
│     → IA clica              │
└─────────────────────────────┘

Saída do modelo:
  boxes:   [0.18, 0.21, 0.38, 0.45]  ← normalizado
  scores:  [0.87]                     ← confiança
  classes: [33]                       ← índice do "kite"

Após processPrediction():
  x: 320px  (centro horizontal)
  y: 198px  (centro vertical)
  score: "87.00"
```

---

## Comparação: o que cada conceito resolve

| Problema | Conceito que resolve |
|---|---|
| "Onde está o kite?" | Bounding Box |
| "O que está na imagem?" | Classe (labels.json índice 33) |
| "Pode ser qualquer coisa?" | Confidence Score |
| "Como evitar falsos positivos?" | CLASS_THRESHOLD |
| "Como mover a mira para o alvo?" | Coordenadas normalizadas → pixels |
