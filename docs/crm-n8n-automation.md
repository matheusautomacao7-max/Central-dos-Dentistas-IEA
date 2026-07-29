# Contrato de automação CRM / n8n

Endpoint do CRM:

`POST /api/integrations/crm/automation-event?token=SEU_TOKEN_DE_INTEGRACAO`

Corpo mínimo:

```json
{
  "event_id": "execucao-n8n-unica-123",
  "event_type": "message.ai.sent",
  "instance": "Zero Carie",
  "phone": "65999999999",
  "flow_name": "Retorno Zero Carie",
  "campaign_id": "campanha-2026-07",
  "outcome": "mensagem_enviada"
}
```

O `event_id` é obrigatório e idempotente: se o n8n reenviar o mesmo evento,
o CRM registra apenas uma vez.

## Eventos aceitos

- `campaign.started`: inicia o acompanhamento automático.
- `ai.started`: informa que a conversa está sob responsabilidade da IA.
- `message.ai.sent`: registra uma interação da IA e soma uma tentativa.
- `ai.handoff.requested`: pausa a automação e coloca o contato na fila humana.
- `human.required`: equivalente a uma solicitação de atendimento humano.
- `opportunity.detected`: envia oportunidade comercial para a fila humana.
- `appointment.confirmed`: conclui o acompanhamento automático.
- `conversation.closed`: conclui a conversa.
- `campaign.finished`: encerra a campanha.

Para os eventos de transferência, envie também `reason`, por exemplo:

```json
{
  "event_id": "execucao-n8n-unica-456",
  "event_type": "ai.handoff.requested",
  "instance": "Zero Carie",
  "phone": "65999999999",
  "flow_name": "Retorno Zero Carie",
  "reason": "Paciente pediu condição especial de pagamento"
}
```

Quando uma atendente assume ou responde pelo CRM, o estado da automação passa
para `paused`. Assim o fluxo não deve continuar respondendo até receber uma
nova autorização explícita da operação.
