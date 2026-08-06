export type Professional = {
  id: number;
  name: string;
  specialty: string;
};

export type Appointment = {
  professionalId: number;
  dateTime: string;
  patientName: string;
  reason: string;
};

export const professionals: Professional[] = [
  { id: 1, name: "Dr. Alison Reis", specialty: "Cardiologia" },
  { id: 2, name: "Dra. Carol Nogueira", specialty: "Dermatologia" },
  { id: 3, name: "Dra. Beatriz Franco", specialty: "Neurologia" },
];

const appointments: Appointment[] = [];

export class AppointmentService {
  private findAppointment(professionalId: number, dateTime: Date, patientName?: string) {
    return appointments.find(
      (appointment) =>
        appointment.professionalId === professionalId &&
        new Date(appointment.dateTime).getTime() === dateTime.getTime() &&
        (!patientName || appointment.patientName === patientName),
    );
  }

  private isAvailable(professionalId: number, dateTime: Date): boolean {
    return !this.findAppointment(professionalId, dateTime);
  }

  async bookAppointment(input: {
    professionalId: number;
    dateTime: Date;
    patientName: string;
    reason: string;
  }): Promise<Appointment> {
    if (!this.isAvailable(input.professionalId, input.dateTime)) {
      throw new Error("Horário indisponível para este profissional");
    }

    const appointment: Appointment = {
      professionalId: input.professionalId,
      dateTime: input.dateTime.toISOString(),
      patientName: input.patientName,
      reason: input.reason,
    };
    appointments.push(appointment);

    const professional = professionals.find((p) => p.id === input.professionalId);
    return { ...appointment, professionalName: professional?.name } as Appointment & {
      professionalName?: string;
    };
  }

  async cancelAppointment(input: {
    professionalId: number;
    dateTime: Date;
    patientName: string;
  }): Promise<void> {
    const appointment = this.findAppointment(input.professionalId, input.dateTime, input.patientName);
    if (!appointment) {
      throw new Error("Agendamento não encontrado para cancelamento");
    }

    appointments.splice(appointments.indexOf(appointment), 1);
  }
}
