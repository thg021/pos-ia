import { z } from "zod";
import type { GraphState } from "./graph.ts";
import type { AppointmentService } from "../services/appointmentService.ts";

const CancelRequiredSchema = z.object({
  professionalId: z.number(),
  dateTime: z.string(),
  patientName: z.string(),
});

export function createCancelNode(appointmentService: AppointmentService) {
  return async function cancelNode(state: GraphState): Promise<Partial<GraphState>> {
    const validation = CancelRequiredSchema.safeParse(state);

    if (!validation.success) {
      const errorMessages = validation.error.errors.map((e) => e.message).join(", ");
      return { actionSuccess: false, actionError: errorMessages };
    }

    try {
      await appointmentService.cancelAppointment({
        professionalId: validation.data.professionalId,
        dateTime: new Date(validation.data.dateTime),
        patientName: validation.data.patientName,
      });
      return { actionSuccess: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { actionSuccess: false, actionError: message };
    }
  };
}
