import { z } from "zod";

export const SummarySchema = z.object({
  summary: z.string(),
});

export function getSummarizationSystemPrompt(): string {
  return JSON.stringify({
    papel: "Assistente de resumo de conversas",
    tarefa:
      "Condensar o histórico de uma conversa entre um cliente e um recomendador musical num resumo curto, preservando fatos relevantes (nome, idade, gêneros e bandas citados, e o clima geral da conversa)",
    instrucoes: [
      "Se já existir um resumo anterior, incorpore as informações novas a ele em vez de descartá-lo",
      "Seja objetivo: poucas frases, sem repetir a conversa literalmente",
      "Não invente informação que não apareça no histórico",
    ],
  });
}

export function getSummarizationUserPrompt(input: { conversationHistory: string; previousSummary?: string }): string {
  return JSON.stringify({
    resumo_anterior: input.previousSummary ?? "nenhum resumo anterior",
    historico_para_condensar: input.conversationHistory,
    instrucoes: ["Gere um novo resumo consolidado, incorporando o resumo anterior (se houver) com o histórico novo"],
  });
}
