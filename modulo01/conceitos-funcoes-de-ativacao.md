# Funções de Ativação — Além do ReLU

**Módulo:** 01 — Fundamentos de IA e LLMs para Programadores

Funções de ativação são regras que cada neurônio aplica na sua saída. Sem elas, a rede neural seria apenas uma multiplicação de matrizes — incapaz de aprender padrões complexos.

> **Analogia geral:** Cada função é um porteiro com uma regra diferente para decidir quem entra e com que intensidade.

---

## ReLU (já conhecemos)

```
f(x) = max(0, x)
```

- Saída: 0 a ∞
- Uso: camadas intermediárias (ocultas)
- Problema: "neurônio morto" — se sempre recebe negativos, para de aprender

---

## Sigmoid

```
f(x) = 1 / (1 + e^-x)
```

- Saída: sempre entre **0 e 1**
- Uso: camada de **saída** em problemas de sim/não (binário)
- Problema: "gradiente desvanece" nas camadas do meio — a rede para de aprender

> **Analogia:** Dimmer de luz — qualquer sinal vira uma intensidade entre apagado (0) e aceso (1).

```
entrada: -2  →  0.12
entrada:  0  →  0.50
entrada:  2  →  0.88
```

---

## Tanh (Tangente Hiperbólica)

```
f(x) = (e^x - e^-x) / (e^x + e^-x)
```

- Saída: sempre entre **-1 e 1**
- Uso: camadas intermediárias quando valores negativos importam; muito usada em RNNs e NLP
- Vantagem sobre Sigmoid: centrada em zero, facilita o aprendizado

> **Analogia:** Balança de dois pratos — pode pender para negativo (-1) ou positivo (1), com zero no equilíbrio.

```
entrada: -1  →  -0.76
entrada:  0  →   0.00
entrada:  1  →   0.76
```

---

## Softmax

```
f(xᵢ) = e^xᵢ / Σ e^xⱼ
```

- Saída: vetor onde **todos os valores somam 1** (distribuição de probabilidade)
- Uso: camada de **saída** para múltiplas classes
- Diferença do Sigmoid: Sigmoid responde "qual a chance de SIM?"; Softmax responde "dentre todas as opções, qual é a mais provável?"

> **Analogia:** Dividir uma pizza inteira entre opções — a maior fatia é a classe mais provável.

```
entrada: [2.0, 1.0, 0.5]  →  saída: [0.60, 0.27, 0.13]  (soma = 1.0)
```

---

## Linear (sem ativação)

```
f(x) = x
```

- Saída: o próprio valor, sem mudança (-∞ a ∞)
- Uso: camada de **saída** em regressão (prever número contínuo: preço, temperatura)

> **Analogia:** Porta aberta — tudo passa exatamente como chegou.

---

## Leaky ReLU

```
f(x) = x          se x > 0
f(x) = 0.01 * x   se x ≤ 0
```

- Saída: -∞ a ∞
- Uso: alternativa ao ReLU quando neurônios mortos são um problema
- Diferença do ReLU: negativos passam com 1% da intensidade, em vez de virar zero

> **Analogia:** A peneira do ReLU, mas com furinhos minúsculos para os negativos.

```
entrada: -10  →  -0.1
entrada:   5  →   5.0
```

---

## ELU (Exponential Linear Unit)

```
f(x) = x              se x > 0
f(x) = α(e^x - 1)    se x ≤ 0   (α = 1 por padrão)
```

- Como Leaky ReLU, mas com curva suave no lado negativo
- Aprende mais rápido em alguns casos

---

## GELU (Gaussian Error Linear Unit)

- Usada em modelos de linguagem modernos: **GPT, BERT, Claude**
- Pondera cada valor com base em probabilidade estatística
- Versão "inteligente" do ReLU

---

## Tabela comparativa

| Função | Saída | Uso principal | Problema |
|---|---|---|---|
| **ReLU** | 0 a ∞ | Camadas intermediárias | Neurônio morto |
| **Sigmoid** | 0 a 1 | Saída binária (sim/não) | Gradiente desvanece |
| **Tanh** | -1 a 1 | Intermediárias, RNNs | Gradiente desvanece |
| **Softmax** | 0 a 1 (soma = 1) | Saída multi-classe | Só para saída |
| **Linear** | -∞ a ∞ | Saída de regressão | Sem não-linearidade |
| **Leaky ReLU** | -∞ a ∞ | Alternativa ao ReLU | Mais complexo |
| **GELU** | -∞ a ∞ | Transformers (GPT, BERT) | Mais pesado |

---

## Como escolher

```
Estou na camada de SAÍDA?
  ├── Problema de sim/não (binário)?     → Sigmoid
  ├── Problema de múltiplas classes?     → Softmax
  └── Prever um número contínuo?         → Linear

Estou numa camada INTERMEDIÁRIA (oculta)?
  ├── Uso geral (redes densas)?          → ReLU  ← mais comum
  ├── Neurônios mortos são um problema?  → Leaky ReLU
  ├── Trabalhando com sequências/texto?  → Tanh ou GELU
  └── Usando Transformer (GPT/BERT)?     → GELU
```

**Regra de ouro:** comece com ReLU nas camadas do meio e Sigmoid ou Softmax na saída. Só troque se tiver um problema específico.
