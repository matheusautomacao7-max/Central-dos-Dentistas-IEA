# Carteira de Pacientes — Instituto Eduardo Ayub

Piloto web local da carteira da Dra. Dulce, com dados armazenados em SQLite.

## Como abrir

Dê dois cliques em `INICIAR SISTEMA.bat`. O sistema inicia e abre automaticamente no navegador.

## Recursos do piloto

- carteira com busca, filtros, ordenação e ficha editável;
- múltiplos procedimentos por paciente, com valor, desconto, etapa e potencial líquido;
- próximas ações reutilizáveis entre fichas: ao salvar uma nova descrição, ela passa a aparecer como sugestão nos demais pacientes;
- catálogo reutilizável de procedimentos, com criação, edição e exclusão protegida por confirmação;
- marcação de pacientes resolvidos no dia, com bloqueio da ficha e reabertura explícita para voltar a editar;
- Registro Diário com totais de hoje, ontem, últimos sete dias e histórico de 30 dias;
- contador diário reiniciado automaticamente à meia-noite, preservando o histórico anterior.

O banco fica em `app/data/clinic.db`.

Para validar as regras críticas com restauração automática dos dados, execute `app/qa_smoke.py` enquanto o sistema estiver aberto.
