---
title: "Exemplo 13 — Embeddings + Neo4j + RAG"
---

# Exemplo 13 — Embeddings + Neo4j + RAG

**Conceito central:** RAG (Retrieval-Augmented Generation) — buscar contexto relevante de um documento antes de gerar resposta com LLM.

---

## O que o projeto faz

Lê um PDF (`tensores.pdf`), divide em pedaços, converte cada pedaço em um vetor numérico (embedding) e armazena no Neo4j. Depois, para cada pergunta, busca os trechos mais similares e pede para um LLM responder baseado nesses trechos.

---

## Mapa de Arquivos

| Arquivo | Papel |
|---------|-------|
| `src/index.ts` | Ponto de entrada — orquestra tudo |
| `src/config.ts` | Configurações centralizadas (lê `.env` e prompts) |
| `src/documentProcessor.ts` | Lê PDF e divide em chunks |
| `src/ai.ts` | Busca vetorial + geração de resposta |
| `src/util.ts` | Utilitários de display (auxiliar) |
| `prompts/answerPrompt.json` | Personalidade e regras da IA |
| `prompts/template.txt` | Template do prompt com variáveis |
| `docker-compose.yml` | Sobe Neo4j via Docker |

---

## Fluxo Alto Nível

```
1. Lê tensores.pdf
2. Divide em pedaços de ~1000 chars (com 200 de sobreposição)
3. Converte cada pedaço em vetor numérico (embedding local HuggingFace)
4. Salva vetores no Neo4j (banco vetorial)
5. Para cada pergunta:
   a. Converte pergunta em vetor
   b. Busca os 3 pedaços mais similares no Neo4j (score > 0.5)
   c. Monta um prompt com os pedaços encontrados
   d. Envia para LLM via OpenRouter
   e. Salva resposta em respostas/*.md
```

---

## Conceitos Aprendidos

### Embedding
Transformar texto em números. "JavaScript" e "programação" ficam próximos matematicamente porque têm significados relacionados. Modelo roda **localmente** (HuggingFace Transformers).

**Analogia:** Como coordenadas GPS — textos parecidos ficam em bairros próximos num mapa numérico.

### Vector Store (Banco Vetorial)
Banco de dados que busca por **proximidade matemática** (similaridade de cosseno), não por palavras exatas. Neo4j armazena os vetores e tem um índice especializado (`tensors_index`).

**Por que não SQL?** Se você buscar "como funciona ML?", o SQL não encontraria um trecho que fala de "machine learning" sem essa palavra exata. O banco vetorial entende o significado.

### RAG (Retrieval-Augmented Generation)
Padrão de 2 fases:
1. **Retrieval** (busca): encontra trechos relevantes do documento
2. **Generation** (geração): LLM responde baseado nesses trechos

**Por que isso importa?** Sem RAG, a IA "inventa" quando não sabe. Com RAG, ela só responde com base no que está no documento.

### Chunk com Overlap
Ao dividir o PDF em pedaços, usamos `chunkOverlap: 200` — os últimos 200 chars de um pedaço são repetidos no início do próximo. Assim, conceitos que ficam na "fronteira" entre dois pedaços não se perdem.

### ChainState — o "envelope" que viaja pelo pipeline
A classe `AI` usa um objeto `ChainState` que vai sendo enriquecido:
```
{ question }
  → busca vetorial →
{ question, context, topScore }
  → geração NLP →
{ question, context, topScore, answer }
```
Se der erro em qualquer etapa, o `error` é adicionado e os passos seguintes são pulados.

---

## Método por Método

### `DocumentProcessor.loadAndSplit()` — `src/documentProcessor.ts:14`
1. Abre o PDF com `PDFLoader`
2. Divide com `RecursiveCharacterTextSplitter` (chunkSize=1000, overlap=200)
3. Limpa o metadata (mantém só `source`)
4. Retorna array de chunks

### `AI.retrieveVectorSearchResults()` — `src/ai.ts:31`
1. Busca `topK=3` chunks mais similares à pergunta
2. Filtra score > 0.5
3. Junta textos dos chunks com `"\n\n---\n\n"`
4. Retorna `ChainState` com `context`

### `AI.generateNLPResponse()` — `src/ai.ts:58`
1. Monta prompt usando `ChatPromptTemplate` + `templateText`
2. Envia para o LLM via chain: `prompt → model → parser`
3. Retorna `ChainState` com `answer`

### `AI.answerQuestion()` — `src/ai.ts:87`
Método público. Cria um `RunnableSequence` (esteira) com os dois métodos acima e executa.

---

## Por que dois modelos diferentes?

| Modelo | Onde roda | Para que serve |
|--------|-----------|----------------|
| HuggingFace Transformers (`EMBEDDING_MODEL`) | **Local** (na sua máquina) | Converter texto → vetor |
| LLM via OpenRouter (`NLP_MODEL`) | **Nuvem** | Gerar resposta em linguagem natural |

Embeddings rodam local por privacidade e custo. O LLM fica na nuvem por precisar de mais poder computacional.

---

## Como Rodar

```bash
# 1. Suba o Neo4j
npm run infra:up

# 2. Configure o .env (NEO4J_URI, OPENROUTER_API_KEY, EMBEDDING_MODEL, etc.)

# 3. Execute
npm start
```

As respostas aparecem em `respostas/resposta-{i}-{timestamp}.md`.
