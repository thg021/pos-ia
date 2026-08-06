import { professionals } from "../../services/appointmentService.ts";

export function getSystemPrompt(): string {
  return JSON.stringify({
    papel: "Classificador de intenção para uma clínica médica",
    tarefa: "Identificar se o cliente quer agendar, cancelar, ou nenhuma das duas coisas, e extrair os dados relevantes",
    profissionais: professionals,
    data_atual: new Date().toISOString(),
    regras: {
      schedule: {
        descricao: "Cliente quer marcar uma nova consulta",
        campos_obrigatorios: ["professionalId", "dateTime", "patientName"],
        campos_opcionais: ["reason"],
      },
      cancel: {
        descricao: "Cliente quer cancelar uma consulta já marcada",
        campos_obrigatorios: ["professionalId", "dateTime", "patientName"],
      },
      unknown: {
        descricao: "Qualquer coisa não relacionada a agendar ou cancelar consultas",
      },
    },
    instrucoes_de_extracao: {
      professionalId: "Combine o nome do profissional citado com o id da lista de profissionais (aceite variações e apelidos)",
      dateTime: "Converta datas relativas (hoje, amanhã) e horários para ISO 8601, usando data_atual como referência",
      patientName: "Extraia o nome do paciente do texto",
      reason: "Extraia o motivo da consulta, quando houver (só para agendamento)",
    },
    exemplos: [
      {
        entrada: "Meu nome é João da Silva, quero agendar uma consulta com o doutor Alison hoje às 14h",
        saida: { intent: "schedule", professionalId: 1, professionalName: "Dr. Alison Reis", patientName: "João da Silva" },
      },
      {
        entrada: "Quero cancelar minha consulta com a doutora Carol amanhã às 10h",
        saida: { intent: "cancel", professionalId: 2, professionalName: "Dra. Carol Nogueira" },
      },
      {
        entrada: "Qual a previsão do tempo pra amanhã?",
        saida: { intent: "unknown" },
      },
    ],
  });
}

export function getUserPrompt(question: string): string {
  return JSON.stringify({
    pergunta: question,
    instrucoes: [
      "Analise a pergunta e determine a intenção do cliente",
      "Extraia todos os dados relevantes de agendamento presentes no texto",
      "Converta datas e horários para ISO 8601",
      "Combine nomes de profissionais aos ids da lista",
      "Devolva somente os campos presentes na pergunta",
    ],
  });
}
