import Fastify from "fastify";
import { HumanMessage } from "@langchain/core/messages";
import { buildGraph } from "./graph/graph.ts";

export function createServer() {
  const app = Fastify();
  const graph = buildGraph();

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

    const response = await graph.invoke({
      messages: [new HumanMessage(question)],
    });

    reply.send(response.output);
  });

  return app;
}
