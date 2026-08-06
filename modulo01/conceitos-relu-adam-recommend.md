# Conceitos Aprofundados — ReLU, Adam e Recommend

**Módulo:** 01 — Fundamentos de IA e LLMs para Programadores  
**Referência:** exemplo-01-ecommerce-recommendations (parte04)

---

## 1. ReLU — A "peneira" dos neurônios

**ReLU** = *Rectified Linear Unit*

### Fórmula

```
f(x) = max(0, x)
```

Se o número for positivo → passa. Se for negativo → vira zero.

```
entrada: -5.2  →  saída: 0
entrada:  3.7  →  saída: 3.7
```

### Por que usar ReLU?

Sem funções de ativação, uma rede neural seria apenas multiplicação de matrizes — só consegue aprender relações lineares (retas). O mundo real é cheio de relações complexas (curvas, combinações, exceções). ReLU introduz **não-linearidade** e permite que a rede aprenda essas combinações.

> **Analogia:** Uma peneira que deixa passar apenas sinais positivos (relevantes) e bloqueia os negativos (irrelevantes). Cada neurônio tem sua própria peneira.

### ReLU vs Sigmoid

| | ReLU | Sigmoid |
|---|---|---|
| **Fórmula** | `max(0, x)` | `1 / (1 + e^-x)` |
| **Saída** | 0 a infinito | 0 a 1 |
| **Uso** | Camadas intermediárias | Camada de saída (probabilidade) |
| **Vantagem** | Rápida, evita gradiente desvanecendo | Ideal para probabilidades |

### No código

```js
// modelTrainingWorker.js — parte04, linha 228
model.add(tf.layers.dense({ units: 128, activation: 'relu' }))
// cada um dos 128 neurônios aplica ReLU na saída
```

---

## 2. Adam Optimizer — Como a rede aprende com os próprios erros

**Adam** = *Adaptive Moment Estimation*

### O conceito base: Gradiente Descendente

A rede começa com pesos aleatórios e erra muito. A cada epoch, o algoritmo calcula:
1. **O erro atual** (loss)
2. **Qual direção reduz o erro** (gradiente)
3. **Quanto ajustar cada peso** (taxa de aprendizado)

> **Analogia da montanha:** Você está numa montanha com neblina e quer chegar ao vale (erro mínimo). Você sente a inclinação do chão e sempre dá um passo para o lado mais íngreme para baixo.

### O problema com passos fixos

- Passo muito grande → pula o vale, oscila para sempre
- Passo muito pequeno → chega lá, mas demora muito

### Como Adam resolve

Adam é **adaptativo** — ajusta o tamanho do passo automaticamente para cada peso:

- Guarda **momento 1 (m):** média dos gradientes recentes ("para onde tenho ido")
- Guarda **momento 2 (v):** média dos quadrados ("quão incerto estou")

Com isso, dá passos maiores quando está confiante e passos menores em terreno irregular.

> **Analogia do motorista:** Adam é um motorista experiente. Nas retas, acelera. Nas curvas, freia. E ainda se lembra das curvas anteriores para antecipar.

### Evolução do loss durante o treino

```
Epoch 1:   loss = 0.68  (chutes aleatórios)
Epoch 10:  loss = 0.42  (começa a aprender)
Epoch 50:  loss = 0.19  (convergindo)
Epoch 100: loss = 0.08  (próximo do mínimo)
```

### No código

```js
// modelTrainingWorker.js — parte04, linha 261
model.compile({
    optimizer: tf.train.adam(0.01),  // taxa de aprendizado inicial = 0.01
    loss: 'binaryCrossentropy',      // mede o erro em problemas sim/não
    metrics: ['accuracy']
})
```

**`binaryCrossentropy`** = função de perda para problemas binários (comprou/não comprou). Penaliza muito quando o modelo está muito errado com alta confiança.

---

## 3. Como a função recommend() funcionaria

A função estava vazia no código do curso — aqui está a implementação completa com explicação.

### Lógica

```
1. Pegar o usuário atual
2. Transformar em vetor (encodeUser)
3. Para cada produto:
   a. Transformar em vetor (encodeProduct)
   b. Juntar [vetor usuário] + [vetor produto]
   c. Perguntar ao modelo: "qual a chance de compra?"
4. Ordenar por pontuação (maior = mais recomendado)
5. Remover o que já foi comprado
6. Retornar os top 5
```

### Implementação

```js
function recommend({ user }) {
    const context = _globalCtx
    const model = _model

    // 1. Codifica o usuário
    const userVector = encodeUser(user, context).dataSync()

    // 2. Pontua cada produto
    const scores = context.products.map(product => {
        const productVector = encodeProduct(product, context).dataSync()

        // junta os vetores (igual ao que foi feito no treino)
        const input = tf.tensor2d([[...userVector, ...productVector]])

        // modelo retorna número entre 0 e 1
        const score = model.predict(input).dataSync()[0]

        return { product, score }
    })

    // 3. Ordena do maior para o menor
    const sorted = scores.sort((a, b) => b.score - a.score)

    // 4. Remove produtos já comprados
    const alreadyBought = new Set(user.purchases.map(p => p.name))
    const recommendations = sorted
        .filter(item => !alreadyBought.has(item.product.name))
        .slice(0, 5)

    // 5. Envia para a página
    postMessage({
        type: workerEvents.recommend,
        user,
        recommendations: recommendations.map(r => r.product)
    })
}
```

### Exemplo com Ana Lima (25 anos, comprou Fones + Relógio)

```
Produto                  | Score  | Por quê?
-------------------------|--------|--------------------------------
Caixa de Som Bluetooth   | 0.87   | eletrônico, mesma faixa etária
Mochila Executiva        | 0.61   | outros jovens compraram junto
Óculos de Sol            | 0.43   | preço médio, neutro
Camiseta Estampada       | 0.21   | categoria diferente do perfil
Boné Estiloso            | 0.18   | categoria diferente
```

### O que acontece dentro de model.predict()

```
[vetor Ana] + [vetor Caixa de Som]
        ↓
   [128 neurônios + ReLU]  — detecta padrões brutos
        ↓
   [64 neurônios + ReLU]   — combina padrões
        ↓
   [32 neurônios + ReLU]   — refina
        ↓
   [1 neurônio + Sigmoid]  — comprime para 0-1
        ↓
      0.87  ←  "87% de chance de compra"
```

---

## Conexão entre os três conceitos

```
Adam optimizer
   → ajusta os pesos da rede a cada epoch

Pesos ajustados mudam como cada neurônio reage
   → ReLU decide quais sinais passam em cada camada

Depois de 100 epochs treinando com os pares (usuário + produto → 0 ou 1)
   → model.predict() aplica o que aprendeu
   → recommend() usa as previsões para ordenar os produtos
```

> O treinamento (Adam + ReLU + 100 epochs) é o professor.  
> A previsão (predict) é o aluno respondendo a prova.  
> A recomendação (recommend) é o resultado final que o usuário vê.
