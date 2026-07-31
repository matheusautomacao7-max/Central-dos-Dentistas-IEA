# Metas individuais do CRC

## Regras de negócio

- As metas são individuais por atendente e por mês.
- Tipos de paciente registrados na finalização:
  - `Primeira consulta`;
  - `Retorno s/ Tratamento` (cliente recorrente).
- Primeiras consultas realizadas: tipo `Primeira consulta` com resultado `Agendou`.
- Recuperações realizadas: tipo `Retorno s/ Tratamento`, marcado como recuperação e com resultado `Agendou`.
- Atendimentos realizados: finalizações válidas da atendente.
- Contatos internos não participam das metas nem das conversões.
- Conversão de primeira consulta: agendamentos de primeira consulta / oportunidades de primeira consulta.
- Conversão de recorrentes: agendamentos de retorno sem tratamento / oportunidades de retorno sem tratamento.

## Expediente e ritmo necessário

- Segunda a sexta: 08h às 18h.
- Sábado: 08h às 12h.
- Domingo não entra no cálculo.
- Ritmo necessário: `ceil(gap mensal / dias de expediente restantes)`.

## Comemorações

- Cada meta diária ou mensal dispara no máximo uma comemoração por valor configurado e período.
- Quando as três metas são atingidas, existe uma conquista adicional de todas as metas.
- O resultado alcançado e o valor da meta sempre aparecem na mensagem.
- `prefers-reduced-motion` remove os confetes, preservando a mensagem textual.

## Interface

- O item `Metas` aparece na barra lateral do CRM.
- Acompanhamento mostra meta, realizado, percentual, gap, ritmo necessário, meta do dia e conversões.
- Configuração permite escolher atendente, mês, metas mensal/diária, comemoração e mensagem.
- A configuração exige acesso à tela `settings`; demais usuários consultam somente os próprios indicadores.
- A tela atualiza a cada 15 segundos enquanto estiver aberta e imediatamente após uma finalização.

## API e persistência

- `GET /api/crm/goals?month=YYYY-MM&user_id=ID`: painel e histórico.
- `POST /api/crm/goals`: configura as três metas do mês.
- `crm_goals`: configuração individual.
- `crm_goal_achievements`: idempotência e histórico das conquistas.
- `crm_service_resolutions.patient_type`: tipo utilizado nas conversões.
- `crm_service_resolutions.is_recovery`: marcação utilizada na meta de recuperação.

## Matriz de testes

| Fluxo | Tipo | Status |
|---|---|---|
| Cálculo mensal, gap e dias de expediente | Unitário | Aprovado |
| Contagem individual e exclusão de contatos internos | Integração SQLite | Aprovado |
| Conquista única por meta/período | Integração SQLite | Aprovado |
| Painel, configuração e comemoração | E2E Playwright | Aprovado |
| Responsividade em 390 px | E2E Playwright | Aprovado |
| Redução de movimento | E2E Playwright | Aprovado |
| Propriedade do paciente | Regressão | Aprovado |
| Mídia, composer e estabilidade de áudio | Regressão | Aprovado |

## Evoluções posteriores

- Calendário configurável de feriados e folgas individuais.
- Importação opcional de metas em lote.
- Tendência semanal e previsão de fechamento do mês após existir volume histórico suficiente.
