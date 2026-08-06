import { z } from "zod";
import type { GraphState } from "./graph.ts";
import type { AppointmentService } from "../services/appointmentService.ts";

const ScheduleRequiredSchema = z.object({
  professionalId: z.number(),
  dateTime: z.string(),
  patientName: z.string(),
});

export function createScheduleNode(appointmentService: AppointmentService) {
  return async function scheduleNode(state: GraphState): Promise<Partial<GraphState>> {
    const validation = ScheduleRequiredSchema.safeParse(state);

    if (!validation.success) {
      const errorMessages = validation.error.errors.map((e) => e.message).join(", ");
      return { actionSuccess: false, actionError: errorMessages };
    }

    try {
      const appointment = await appointmentService.bookAppointment({
        professionalId: validation.data.professionalId,
        dateTime: new Date(validation.data.dateTime),
        patientName: validation.data.patientName,
        reason: state.reason ?? "consulta geral",
      });

      return { actionSuccess: true, ...appointment };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { actionSuccess: false, actionError: message };
    }
  };
}
