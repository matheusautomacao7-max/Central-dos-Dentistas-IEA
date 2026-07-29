# Piloto — Instituto Eduardo Ayub

Sistema web piloto para acompanhamento da carteira de pacientes da Dra. Dulce.

## Recursos atuais

- Indicadores de contato, agendamento, tratamentos, inativos e potencial financeiro.
- Filtros por status e mês da última consulta.
- Ordenação por data, nome e valor potencial.
- Cadastro e edição de pacientes.
- Múltiplos procedimentos por paciente, com valor e etapa.
- Catálogo mestre de procedimentos com valor padrão reutilizável e ajustável por paciente.
- Marcação diária de pacientes resolvidos, com contador e histórico.
- Interface compacta para notebook, sem rolagem horizontal na carteira principal.
- Banco SQLite preparado para carteiras separadas por profissional.

## Executar

```powershell
python .\app\server.py
```

Abra `http://127.0.0.1:8000`.

O banco SQLite é criado automaticamente em `app/data/clinic.db` na primeira execução.
