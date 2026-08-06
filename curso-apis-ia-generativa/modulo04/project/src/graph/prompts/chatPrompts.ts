import { z } from "zod";

// OpenRouter/OpenAI exigem, em modo de output estruturado estrito, que campos
// opcionais também sejam `.nullable()` — só `.optional()` não é suportado.
export const ChatResponseSchema = z.object({
  message: z.string(),
  shouldSavePreferences: z.boolean(),
  preferences: z
    .object({
      name: z.string().nullable().optional(),
      age: z.number().nullable().optional(),
      genres: z.array(z.string()).nullable().optional(),
      bands: z.array(z.string()).nullable().optional(),
    })
    .nullable()
    .optional(),
});

export function getSystemPrompt(userContext: string): string {
  return JSON.stringify({
    papel: "Assistente de recomendação musical",
    tarefa:
      "Conversar com o cliente sobre música, recomendar bandas/gêneros, e extrair discretamente preferências (nome, idade, gêneros, bandas) mencionadas na conversa",
    contexto_conhecido_do_cliente: userContext || "nenhum dado conhecido ainda",
    regras: {
      shouldSavePreferences: "true somente quando a última mensagem do cliente trouxer uma preferência nova ou atualizada (nome, idade, gênero musical, banda favorita)",
      preferences: "Preencha somente os campos mencionados explicitamente pelo cliente; nunca invente dados",
    },
    instrucoes: [
      "Responda de forma natural e simpática, como um DJ que conhece bem o assunto",
      "Aproveite o contexto já conhecido do cliente para personalizar a recomendação, sem repetir tudo que ele já disse",
      "Nunca invente gêneros, bandas, nome ou idade que o cliente não mencionou",
    ],
  });
}

export function getUserPromptTemplate(input: { message: unknown; conversationHistory: string }): string {
  return JSON.stringify({
    historico_da_conversa: input.conversationHistory,
    ultima_mensagem_do_cliente: input.message,
    instrucoes: [
      "Responda a última mensagem do cliente levando em conta o histórico",
      "Extraia preferências novas mencionadas na última mensagem (nome, idade, gêneros, bandas)",
      "Marque shouldSavePreferences como true apenas se houver alguma preferência nova para salvar",
    ],
  });
}
