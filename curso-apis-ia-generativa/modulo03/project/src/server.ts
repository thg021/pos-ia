import Fastify from "fastify";
import { HumanMessage } from "@langchain/core/messages";
import type { CompiledStateGraph } from "@langchain/langgraph";
import type { GraphState } from "./graph/graph.ts";

export function createServer(graph: CompiledStateGraph<GraphState, Partial<GraphState>, any>) {
  const app = Fastify();

  app.post("/chat", {
    schema: {
      body: {
        type: "object",
        required: ["question"],
        properties: {
          question: { type: "string", minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { question } = request.body as { question: string };

    const result = await graph.invoke({
      messages: [new HumanMessage(question)],
    });

    reply.send({
      intent: result.intent,
      actionSuccess: result.actionSuccess,
      actionError: result.actionError,
      message: result.messages.at(-1)?.text ?? "",
    });
  });

  return app;
}
