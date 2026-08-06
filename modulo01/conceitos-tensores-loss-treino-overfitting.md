# Tensores, Loss, Treino vs Inferência e Overfitting

**Módulo:** 01 — Fundamentos de IA e LLMs para Programadores

---

## 1. O que é um Tensor

Tensor = estrutura de dados multidimensional usada pelo TensorFlow.

```
número     = 42              → 0D (escalar)
lista      = [1, 2, 3]       → 1D (vetor)     tf.tensor1d
tabela     = [[1,2],[3,4]]   → 2D (matriz)    tf.tensor2d
cubo       = [[[...]]]       → 3D+            tensor 3D
```

> **Analogia:** Caixa organizadora. 1D = fileira. 2D = gavetas. 3D = armário com andares.

### Funções do projeto

| Função | O que faz | Exemplo |
|---|---|---|
| `tf.tensor1d([...])` | Cria vetor 1D | vetor de um produto |
| `tf.tensor2d([[...]])` | Cria tabela 2D | todos os pares de treino |
| `tf.stack([v1, v2])` | Empilha 1D → 2D | compras do usuário |
| `tf.concat1d([a, b])` | Junta vetores em um só | preço + idade + categoria + cor |
| `.dataSync()` | Converte tensor → array JS | para usar com .push(), .map() |

### Por que não usar arrays JS direto?

Tensores são otimizados para cálculo matemático em GPU — operações de multiplicação de matrizes são dezenas de vezes mais rápidas do que arrays comuns.

---

## 2. Overfitting vs Underfitting

### Underfitting — "aluno que não estudou"

Modelo não aprendeu o suficiente. Loss permanece alta.

```
Epoch 10:  loss = 0.68
Epoch 100: loss = 0.63  ← quase não melhorou
```

Causas: modelo simples demais, poucas epochs, taxa de aprendizado muito alta.

### Overfitting — "aluno que decorou a prova"

Modelo memorizou os dados de treino. Vai bem no que já viu, erra no que é novo.

```
Epoch 50:  loss treino = 0.12   loss validação = 0.38  ← divergindo
Epoch 100: loss treino = 0.02   loss validação = 0.71  ← overfitting grave
```

Causas: dataset pequeno, modelo complexo demais, epochs demais.

> Este projeto usa apenas 50 pares de treino (5 usuários × 10 produtos) — está sujeito a overfitting. Em produção, precisaria de centenas ou milhares de usuários.

### O equilíbrio ideal

```
underfitting → ideal → overfitting
loss treino:  alta  → baixa  → muito baixa
loss validação: alta → baixa → sobe de novo
```

---

## 3. Treino vs Inferência

### Treino — model.fit()

```js
await model.fit(trainData.xs, trainData.ys, { epochs: 100 })
```

- **Lento** — calcula gradientes e ajusta pesos
- Os pesos **mudam** a cada batch
- Precisa dos labels (respostas corretas)
- Acontece **uma vez** (ao carregar a página)

Fluxo: `[dados] → [rede] → [previsão] → [compara com label] → [ajusta pesos] → repete`

> Como estudar para uma prova: faz questões, erra, corrige, repete.

### Inferência — model.predict()

```js
const score = model.predict(input).dataSync()[0]
```

- **Rápido** — só multiplica matrizes
- Os pesos **não mudam**
- Não precisa de labels
- Acontece **toda vez** que o usuário pede uma recomendação

Fluxo: `[dados] → [rede com pesos fixos] → [resposta]`

> Como fazer a prova depois de estudar: aplica o que aprendeu, não aprende mais nada.

### No projeto

```js
// TREINO — uma vez ao carregar
_model = await configureNeuralNetAndTrain(trainData)

// INFERÊNCIA — cada vez que clica "Recomendar"
const score = _model.predict(input).dataSync()[0]
```

---

## 4. O que a Loss realmente mede

Loss = número que mede o quanto o modelo está errando. Quanto menor, melhor.

### Como binaryCrossentropy funciona

Para label real = 1 (usuário comprou):

```
Modelo disse 0.90  →  loss = 0.10  (quase acertou)
Modelo disse 0.50  →  loss = 0.69  (incerto)
Modelo disse 0.10  →  loss = 2.30  (errou com alta confiança → punição alta)
```

Errar com alta confiança é punido muito mais do que errar com incerteza.

### Lendo a evolução

```
Epoch 1:   0.693  → chute aleatório (50/50)
Epoch 10:  0.450  → aprendendo
Epoch 50:  0.150  → bom
Epoch 100: 0.080  → muito bom
```

Sinais de alerta:
- Loss para de cair → chegou no mínimo ou overfitting
- Loss sobe depois de cair → overfitting confirmado

### Qual loss usar

| Loss | Quando usar |
|---|---|
| `binaryCrossentropy` | Saída sim/não (Sigmoid) |
| `categoricalCrossentropy` | Múltiplas classes (Softmax) |
| `meanSquaredError` | Prever número contínuo (Linear) |
