import { StateGraph, START, END } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";
import { createIdentifyIntentNode } from "./identifyIntentNode.ts";
import { createScheduleNode } from "./scheduleNode.ts";
import { createCancelNode } from "./cancelNode.ts";
import { createMessageGeneratorNode } from "./messageGeneratorNode.ts";
import type { OpenRouterService } from "../openrouter-service.ts";
import type { AppointmentService } from "../services/appointmentService.ts";

const GraphStateSchema = z.object({
  messages: z.custom<BaseMessage[]>().default(() => []),
  intent: z.enum(["schedule", "cancel", "unknown"]).optional(),
  professionalId: z.number().optional(),
  professionalName: z.string().optional(),
  dateTime: z.string().optional(),
  patientName: z.string().optional(),
  reason: z.string().optional(),
  actionSuccess: z.boolean().optional(),
  actionError: z.string().optional(),
});

export type GraphState = z.infer<typeof GraphStateSchema>;

function routeByIntent(state: GraphState): string {
  switch (state.intent) {
    case "schedule":
      return "scheduleNode";
    case "cancel":
      return "cancelNode";
    default:
      return "messageGeneratorNode";
  }
}

export function buildGraph(llmClient: OpenRouterService, appointmentService: AppointmentService) {
  const workflow = new StateGraph(GraphStateSchema)
    .addNode("identifyIntent", createIdentifyIntentNode(llmClient))
    .addNode("scheduleNode", createScheduleNode(appointmentService))
    .addNode("cancelNode", createCancelNode(appointmentService))
    .addNode("messageGeneratorNode", createMessageGeneratorNode(llmClient))
    .addEdge(START, "identifyIntent")
    .addConditionalEdges("identifyIntent", routeByIntent, {
      scheduleNode: "scheduleNode",
      cancelNode: "cancelNode",
      messageGeneratorNode: "messageGeneratorNode",
    })
    .addEdge("scheduleNode", "messageGeneratorNode")
    .addEdge("cancelNode", "messageGeneratorNode")
    .addEdge("messageGeneratorNode", END);

  return workflow.compile();
}
