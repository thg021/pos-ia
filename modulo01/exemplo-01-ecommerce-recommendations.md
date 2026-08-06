# Exemplo 01 — E-commerce Recommendations com TensorFlow.js

**Módulo:** 01 — Fundamentos de IA e LLMs para Programadores  
**Objetivo:** Sistema de recomendação de produtos que aprende com o histórico de compras dos usuários usando Machine Learning no browser.

---

## O que o projeto faz?

Exibe produtos e usuários em uma tela de e-commerce. Ao clicar em "comprar", o sistema registra a compra. Um modelo de IA (TensorFlow.js) aprende com esses dados e passa a sugerir produtos relevantes para cada usuário.

A pasta `exemplo-01` está dividida em 4 partes (`parte01` a `parte04`) que constroem o sistema progressivamente.

---

## Conceitos Fundamentais

### Dataset (os dados de treino)

Os arquivos em `data/` são o **dataset** — a matéria-prima do modelo:

- `users.json` — 5 usuários com idade e histórico de compras
- `products.json` — 10 produtos com categoria, preço e cor

> **Analogia:** É como a planilha de clientes de uma loja física. O modelo "estuda" essa planilha para aprender padrões.

---

### Normalização

```js
// Arquivo: src/workers/modelTrainingWorker.js — linha 9
const normalize = (value, min, max) => (value - min) / ((max - min) || 1)
```

**O problema:** Preço varia de R$ 39 a R$ 199. Idade varia de 22 a 30. São escalas completamente diferentes.  
**A solução:** Normalização converte tudo para uma escala de **0 a 1**, deixando as variáveis equilibradas.

| Valor original | Mínimo | Máximo | Normalizado |
|---|---|---|---|
| R$ 129,99 | R$ 39,99 | R$ 199,99 | 0,56 |
| 25 anos | 22 | 30 | 0,37 |

> Sem normalização, o preço dominaria o aprendizado e o modelo ignoraria a idade.

---

### Feature Engineering (Engenharia de Features)

```js
// Arquivo: src/workers/modelTrainingWorker.js — linha 69
dimentions: 2 + categories.length + colors.length
```

**Feature** = uma característica usada pelo modelo para aprender.  
Neste projeto:
- **2 features numéricas:** preço normalizado + idade normalizada
- **Features categóricas:** uma coluna para cada categoria (eletrônicos, vestuário, calçados, acessórios)
- **Features de cor:** uma coluna para cada cor

> Cada feature é uma "pista" que o modelo usa para fazer uma recomendação.

---

### One-Hot Encoding (índice de categorias/cores)

```js
// Arquivo: src/workers/modelTrainingWorker.js — linhas 21–30
const colorsIndex = Object.fromEntries(
    colors.map((color, index) => [color, index])
)
// Resultado: { "preto": 0, "prata": 1, "azul": 2, ... }
```

**O problema:** O modelo só entende números, não texto como "preto" ou "eletrônicos".  
**A solução:** Cada categoria/cor vira um número (índice).

> **Analogia:** É como traduzir idiomas — "preto" vira 0, "prata" vira 1, etc.

---

### Média de Idade por Produto

```js
// Arquivo: src/workers/modelTrainingWorker.js — linhas 38–54
users.forEach(user => {
    user.purchases.forEach(p => {
        ageSums[p.name] = (ageSums[p.name] || 0) + user.age
        ageCounts[p.name] = (ageCounts[p.name] || 0) + 1
    })
})
```

Calcula a **faixa etária média** de quem comprou cada produto. Isso ajuda o modelo a entender:  
> "Fones de Ouvido são comprados por pessoas em média com 26 anos → recomendar para usuários nessa faixa."

---

### Web Worker (treino em background)

```js
// Arquivo: src/index.js — linha 23
const mlWorker = new Worker('/src/workers/modelTrainingWorker.js', { type: 'module' })
```

Treinar um modelo de ML é computacionalmente pesado. Um **Web Worker** roda em uma thread separada do browser, evitando que a tela trave durante o treino.

**Comunicação Worker ↔ Página principal:**
```js
// Worker envia progresso para a página
postMessage({ type: 'progress:update', progress: { progress: 50 } })

// Página escuta as mensagens do Worker
self.onmessage = e => {
    const { action, ...data } = e.data
    if (handlers[action]) handlers[action](data)
}
```

> **Analogia:** É como um assistente separado que faz o trabalho pesado enquanto você continua atendendo clientes.

---

### Arquitetura MVC

```
UserService / ProductService  ←→  Controller  ←→  View
      (dados)                      (lógica)        (tela)
```

| Camada | Arquivo exemplo | Responsabilidade |
|---|---|---|
| **Service** | `UserService.js` | Busca e salva dados (no sessionStorage) |
| **Controller** | `ModelTrainingController.js` | Decide o que fazer com os dados |
| **View** | `ModelTrainingView.js` | Renderiza na tela |

---

### sessionStorage

```js
// Arquivo: src/service/UserService.js — linha 38
const data = sessionStorage.getItem(this.#storageKey)
```

**sessionStorage** = memória temporária do browser. Persiste enquanto a aba está aberta e some ao fechar. Aqui guarda os usuários com as compras feitas durante a navegação.

---

### Sistema de Eventos (pub/sub)

```js
// Arquivo: src/events/constants.js
export const events = {
    userSelected: 'user:selected',
    trainingComplete: 'training:complete',
    recommend: 'recommend',
}
```

Em vez de componentes se chamarem diretamente, usam eventos:
- O Worker **publica:** `"training:complete"`
- O Controller **escuta:** reage habilitando o botão de recomendação

> **Analogia:** Como um grupo de WhatsApp — quem quiser ouvir um assunto entra no grupo. Ninguém precisa conhecer todos os outros diretamente.

---

## Fluxo completo do sistema

```
1. Página carrega → src/index.js inicializa todos os componentes
2. UserService.getDefaultUsers() → busca users.json
3. Worker recebe os usuários → trainModel() é chamado
4. makeContext() prepara e normaliza os dados
5. Worker envia postMessage(trainingComplete) → Controller habilita botão
6. Usuário seleciona perfil → clica "Recomendar" → modelo sugere produtos
```

---

---

## Parte 02 — Encoding: produto vira vetor numérico

### WEIGHTS — pesos de importância

```js
const WEIGHTS = { category: 0.4, color: 0.3, price: 0.2, age: 0.1 }
```

Cada feature tem um peso que reflete sua importância. Categoria (40%) influencia mais que cor (30%) que influencia mais que preço (20%) que influencia mais que faixa etária (10%).

### One-Hot Encoding

Transforma texto em vetor de 0s e 1s. Com 4 categorias `[eletrônicos, vestuário, calçados, acessórios]`, um produto "vestuário" vira `[0, 1, 0, 0]`. Com peso 0.4: `[0, 0.4, 0, 0]`.

> Isso evita que o modelo trate categorias como magnitudes (como se "acessórios=4" fosse maior que "eletrônicos=1").

### encodeProduct — produto completo vira vetor

```js
// Arquivo: src/workers/modelTrainingWorker.js (parte02) — linha 85
function encodeProduct(product, context) {
    const price    = tf.tensor1d([normalize(product.price, ...) * WEIGHTS.price])
    const age      = tf.tensor1d([productAvgAge * WEIGHTS.age])
    const category = oneHotWeighted(categoriesIndex[product.category], ...)
    const color    = oneHotWeighted(colorsIndex[product.color], ...)
    return tf.concat1d([price, age, category, color])
}
// Resultado: [0.112, 0.037, 0, 0.4, 0, 0, 0, 0.3, 0, ...]
```

**`tf.tensor1d`** = cria um tensor (array otimizado do TensorFlow) de 1 dimensão.  
**`tf.concat1d`** = junta todos os pedaços em um único vetor.

---

## Parte 03 — Criando os dados de treino

### encodeUser — usuário também vira vetor

```js
// Arquivo: src/workers/modelTrainingWorker.js (parte03) — linha 119
function encodeUser(user, context) {
    if (user.purchases.length) {
        return tf.stack(
            user.purchases.map(product => encodeProduct(product, context))
        ).mean(0)   // média de todos os produtos comprados
    }
    // sem compras: vetor quase zero (só com idade)
}
```

O perfil do usuário = **média** dos vetores dos produtos que ele comprou.  
> Ana comprou Fones (eletrônico) + Relógio (eletrônico) → seu perfil "pende para eletrônicos".

### createTrainingData — pares de treino com rótulos

```js
// Arquivo: src/workers/modelTrainingWorker.js (parte03) — linha 134
// Para cada usuário × cada produto:
inputs.push([...userVector, ...productVector])  // pergunta: esse usuário gostaria desse produto?
labels.push(label)                               // resposta: 1 = comprou, 0 = não comprou
```

Com 5 usuários × 10 produtos = **50 pares de treino**.

| Entrada (`xs`) | Rótulo (`ys`) |
|---|---|
| [vetor Ana] + [vetor Fones] | 1 (ela comprou) |
| [vetor Ana] + [vetor Boné] | 0 (ela não comprou) |
| [vetor Bruno] + [vetor Fones] | 1 (ele comprou) |

---

## Parte 04 — A Rede Neural

### Arquitetura da rede (camadas dense)

```js
// Arquivo: src/workers/modelTrainingWorker.js (parte04) — linha 218
const model = tf.sequential()

model.add(tf.layers.dense({ inputShape: [~28], units: 128, activation: 'relu' }))
model.add(tf.layers.dense({ units: 64,  activation: 'relu' }))
model.add(tf.layers.dense({ units: 32,  activation: 'relu' }))
model.add(tf.layers.dense({ units: 1,   activation: 'sigmoid' }))
```

```
Entrada (28 números) → [128 neurônios] → [64] → [32] → [1 saída: 0 a 1]
```

| Conceito | O que faz |
|---|---|
| **Dense** | Cada neurônio conecta a todos os anteriores |
| **ReLU** | Mantém positivos, zera negativos — aprende padrões complexos |
| **Sigmoid** | Comprime saída para 0–1 (probabilidade de recomendação) |
| **Funil (128→64→32)** | Filtra e combina padrões progressivamente |

### Compilar e treinar

```js
model.compile({
    optimizer: tf.train.adam(0.01),  // aprende ajustando pesos gradualmente
    loss: 'binaryCrossentropy',      // mede o erro para problemas sim/não
    metrics: ['accuracy']
})

await model.fit(trainData.xs, trainData.ys, {
    epochs: 100,     // estuda os dados 100 vezes
    batchSize: 32,   // processa 32 exemplos por vez
    shuffle: true,   // embaralha a cada rodada
    callbacks: {
        onEpochEnd: (epoch, logs) => postMessage({ loss: logs.loss })
    }
})
```

| Conceito | Analogia |
|---|---|
| **Epoch** | Uma "leitura completa" do livro de estudos |
| **Batch** | Estudar 32 flashcards por vez |
| **Adam optimizer** | Professor que ajusta o ritmo de aprendizado automaticamente |
| **Loss** | Nota da prova — quanto menor, melhor |
| **Callback** | Mensagem de progresso enviada ao final de cada epoch |

---

## Partes do exemplo — resumo da evolução

| Parte | O que adiciona |
|---|---|
| `parte01` | Estrutura base, dados, normalização, `makeContext()` |
| `parte02` | Tensors, WEIGHTS, One-Hot Encoding, `encodeProduct()`, vetores de produtos |
| `parte03` | `encodeUser()` (perfil do usuário), `createTrainingData()` (pares xs/ys) |
| `parte04` | Rede neural completa: camadas dense, ReLU, Sigmoid, Adam, 100 epochs |
