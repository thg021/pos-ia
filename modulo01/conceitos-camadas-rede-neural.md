# Camadas de uma Rede Neural — Entrada, Meio e Saída

**Módulo:** 01 — Fundamentos de IA e LLMs para Programadores

> **Analogia geral:** Uma rede neural é uma fábrica com esteiras em sequência. Cada esteira (camada) processa o produto e passa para a próxima, até chegar na embalagem final (resposta).

---

## As 3 tipos de camada

```
ENTRADA       MEIO (ocultas)              SAÍDA
  │                                         │
[dados]  →  [camada1] → [camada2] → ...  →  [resposta]
```

---

## 1. Camada de Entrada — "A recepção"

Não faz processamento. Só recebe os dados e repassa para a próxima camada.

```js
// modelTrainingWorker.js — parte04, linha 227
model.add(tf.layers.dense({
    inputShape: [trainData.inputDimention],  // quantos números entram (~28)
    units: 128,
    activation: 'relu'
}))
```

O `inputShape` define o tamanho dos dados que chegam. No projeto: vetor do usuário + vetor do produto = ~28 números.

> **Analogia:** Recepção de hospital — os pacientes (dados) chegam, são registrados e encaminhados. Nenhum médico trabalha aqui.

---

## 2. Camadas Ocultas (do meio) — "O laboratório"

Onde o aprendizado acontece. Cada camada extrai padrões progressivamente mais abstratos.

```js
model.add(tf.layers.dense({ units: 128, activation: 'relu' }))  // camada 1
model.add(tf.layers.dense({ units: 64,  activation: 'relu' }))  // camada 2
model.add(tf.layers.dense({ units: 32,  activation: 'relu' }))  // camada 3
```

### O que cada neurônio faz

Recebe todos os valores da camada anterior, multiplica cada um por um **peso**, soma tudo e aplica ReLU:

```
valor_1 × peso_1 = 0.112 × 0.45 = 0.050
valor_2 × peso_2 = 0.037 × 0.82 = 0.030
valor_3 × peso_3 = 0.400 × 0.11 = 0.044
...
soma = 1.23  →  ReLU: max(0, 1.23) = 1.23  ✓ passa

outro neurônio:
soma = -0.54  →  ReLU: max(0, -0.54) = 0.00  ✗ bloqueado
```

> **Os pesos são o que o modelo aprende.** Adam os ajusta a cada epoch.

### Por que vai afunilando? (128 → 64 → 32)

Cada camada comprime a informação, guardando só o que é mais relevante.

> **Analogia da fábrica de suco:**
> - Camada 128: espreme a laranja inteira
> - Camada 64: filtra os caroços e polpa grossa
> - Camada 32: refina — fica só o suco puro

### O que cada camada "vê"

```
Camada 1 (128): padrões simples
  → "este produto é eletrônico"
  → "usuário tem 20-30 anos"

Camada 2 (64): combinações
  → "jovem + eletrônico"
  → "preço médio + acessório"

Camada 3 (32): padrões abstratos
  → "perfil de comprador de tecnologia"
  → "quem comprou fones também compra caixinha"
```

> **Analogia do detetive:** 1º dia = olha pistas individuais. 2º dia = conecta pistas. 3º dia = teoria completa.

---

## 3. Camada de Saída — "O veredicto"

Pega todo o processamento e dá a resposta final.

```js
model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }))
```

- `units: 1` → um único número de resposta
- `sigmoid` → comprime para 0–1 (probabilidade)

```
0.89  →  89% de chance de compra → recomenda!
0.23  →  23% de chance → não recomenda
```

> **Analogia:** O juiz no tribunal — ouviu todos os advogados (camadas ocultas) e dá o veredito final.

### Se a resposta fosse múltipla escolha

```js
model.add(tf.layers.dense({ units: 4, activation: 'softmax' }))
// resultado: [0.60, 0.25, 0.10, 0.05]
//             eletr  vest  calç  aces
```

---

## Fluxo completo no projeto

```
ENTRADA (~28 números)
[0.112, 0.037, 0, 0.4, 0, 0.3, ...]
  ↓
CAMADA OCULTA 1 — 128 neurônios + ReLU
  → detecta padrões simples
  ↓
CAMADA OCULTA 2 — 64 neurônios + ReLU
  → combina padrões
  ↓
CAMADA OCULTA 3 — 32 neurônios + ReLU
  → refina e destila
  ↓
CAMADA DE SAÍDA — 1 neurônio + Sigmoid
  ↓
0.87  →  "87% de chance de compra"
```

---

## Escolha do número de camadas e neurônios

| Situação | Recomendação |
|---|---|
| Problema simples | 1–2 camadas ocultas |
| Problema médio (como este projeto) | 2–3 camadas ocultas |
| Imagens, linguagem, complexidade alta | Muitas camadas (Deep Learning) |
| Muitos neurônios | Aprende mais, mas pode "decorar" os dados (overfitting) |
| Poucos neurônios | Mais rápido, mas pode não aprender o suficiente (underfitting) |

---

## Resumo visual

```
[entrada] → neurônios detectam → neurônios combinam → neurônios refinam → [resposta]
  dados         padrões              padrões               padrões           final
  brutos        simples              médios                abstratos
```

Os **pesos** de cada conexão são o que o modelo "sabe". Começam aleatórios e são ajustados pelo **Adam** a cada epoch até aprenderem os padrões certos.
