# Contrato de automaÃ§Ã£o CRM / n8n

Endpoint do CRM:

`POST /api/integrations/crm/automation-event?token=SEU_TOKEN_DE_INTEGRACAO`

Corpo mÃ­nimo:

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

O `event_id` Ã© obrigatÃ³rio e idempotente: se o n8n reenviar o mesmo evento,
o CRM registra apenas uma vez.

## Eventos aceitos

- `campaign.started`: inicia o acompanhamento automÃ¡tico.
- `ai.started`: informa que a conversa estÃ¡ sob responsabilidade da IA.
- `message.ai.sent`: registra uma interaÃ§Ã£o da IA e soma uma tentativa.
- `ai.handoff.requested`: pausa a automaÃ§Ã£o e coloca o contato na fila humana.
- `human.required`: equivalente a uma solicitaÃ§Ã£o de atendimento humano.
- `opportunity.detected`: envia oportunidade comercial para a fila humana.
- `appointment.confirmed`: conclui o acompanhamento automÃ¡tico.
- `conversation.closed`: conclui a conversa.
- `campaign.finished`: encerra a campanha.
- `campaign.completed`: alias de campanha concluÃƒÂ­da (para integraÃƒÂ§ÃƒÂµes que enviam esse nome).
- `workflow.finished`: alias de fluxo concluÃƒÂ­do.
- `workflow.completed`: alias de fluxo concluÃƒÂ­do.
- `run.completed` ou `run.complete`: alias de execuÃƒÂ§ÃƒÂ£o concluÃƒÂ­da.
- `run.failed` / `campaign.failed` / `workflow.failed`: indica falha de execuÃƒÂ§ÃƒÂ£o.
- `run.error` / `workflow.error` / `campaign.error`: indica falha em cenÃƒÂ¡rio de erro.

- Filtros adicionais em consultas internas (uso nos painéis):
  - `channel`: `whatsapp` (Evolution + Meta), `evolution`, `meta`.
  - `mine`: `1` para restringir à usuário logado.


Para os eventos de transferÃªncia, envie tambÃ©m `reason`, por exemplo:

```json
{
  "event_id": "execucao-n8n-unica-456",
  "event_type": "ai.handoff.requested",
  "instance": "Zero Carie",
  "phone": "65999999999",
  "flow_name": "Retorno Zero Carie",
  "reason": "Paciente pediu condiÃ§Ã£o especial de pagamento"
}
```

Quando uma atendente assume ou responde pelo CRM, o estado da automaÃ§Ã£o passa
para `paused`. Assim o fluxo nÃ£o deve continuar respondendo atÃ© receber uma
nova autorizaÃ§Ã£o explÃ­cita da operaÃ§Ã£o.
