import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { graph } from "./graph/factory.ts";
import { getUser } from "./services/usersService.ts";
import { guardrailsEnabledDefault } from "./config.ts";

function getUserIdFromArgv(): string {
  const arg = process.argv.find((value) => value.startsWith("--user="));
  return arg ? arg.slice("--user=".length) : "ana";
}

async function main() {
  const userId = getUserIdFromArgv();
  const user = await getUser(userId);

  if (!user) {
    console.error(`usuário "${userId}" não encontrado em data/users.json (use --user=eric ou --user=ana)`);
    process.exit(1);
  }

  console.log(
    `guardrails contra prompt injection — conversando como "${user.name}" ` +
      `(papel: ${user.role}, permissões: ${user.permissions.join(", ") || "nenhuma"}, ` +
      `guardrails: ${guardrailsEnabledDefault ? "ativos" : "desativados"})\n`,
  );

  const rl = readline.createInterface({ input: stdin, output: stdout });
  // O histórico de mensagens vive aqui, na memória do processo — não há
  // checkpointer/persistência neste módulo (ver graph.ts): encerrar o
  // processo (Ctrl+C) descarta a conversa.
  let messages: BaseMessage[] = [];

  try {
    for (;;) {
      const question = await rl.question("você: ");
      if (!question.trim()) continue;

      messages = [...messages, new HumanMessage(question)];

      const result = await graph.invoke({
        messages,
        userId,
        userDisplayName: user.name,
        userRole: user.role,
        userPermissions: user.permissions,
        guardrailsEnabled: guardrailsEnabledDefault,
      });

      messages = result.messages;
      const lastMessage = result.messages.at(-1);
      console.log(`assistente: ${lastMessage?.text ?? "(sem resposta)"}\n`);
    }
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error("erro fatal no cli:", error);
  process.exit(1);
});
