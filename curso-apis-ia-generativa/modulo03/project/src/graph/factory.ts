import { buildGraph } from "./graph.ts";
import { OpenRouterService } from "../openrouter-service.ts";
import { AppointmentService } from "../services/appointmentService.ts";

export const graph = buildGraph(new OpenRouterService(), new AppointmentService());
