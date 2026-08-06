import { PromptTemplate } from "@langchain/core/prompts";
import { AIMessage } from "@langchain/core/messages";
import type { GraphState } from "./graph.ts";

const blockedMessageTemplate = PromptTemplate.fromTemplate(
  "Identificamos uma possível violação de segurança. Motivo: {reason}. Análise: {analysis}. " +
    "Seu papel é {userRole} e suas permissões são: {permissions}. " +
    "Se acredita que isso é um engano, contate o administrador.",
);

export async function blockedNode(state: GraphState): Promise<Partial<GraphState>> {
  const check = state.guardrailCheck!;
  const permissions = state.userPermissions.length > 0 ? state.userPermissions.join(", ") : "nenhuma";

  const message = await blockedMessageTemplate.format({
    reason: check.reason ?? "verificação de segurança falhou",
    analysis: check.analysis ?? "",
    userRole: state.userRole ?? "member",
    permissions,
  });

  return { messages: [...state.messages, new AIMessage(message)] };
}
