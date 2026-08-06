import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { HumanMessage } from "@langchain/core/messages";
import { graph } from "./graph/factory.ts";

function getUserIdFromArgv(): string {
  const arg = process.argv.find((value) => value.startsWith("--user="));
  return arg ? arg.slice("--user=".length) : "anonimo";
}

async function main() {
  const userId = getUserIdFromArgv();
  // O thread_id agrupa o histórico de checkpoints no Postgres; usar o próprio
  // userId como thread_id faz a conversa continuar de onde parou da próxima
  // vez que o mesmo usuário rodar `npm run chat -- --user=<id>`.
  const config = { configurable: { thread_id: userId } };

  console.log(`recomendador de música — conversando como "${userId}" (Ctrl+C para sair)\n`);

  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    for (;;) {
      const question = await rl.question("você: ");
      if (!question.trim()) continue;

      const result = await graph.invoke(
        {
          messages: [new HumanMessage(question)],
          userId,
        },
        config,
      );

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
