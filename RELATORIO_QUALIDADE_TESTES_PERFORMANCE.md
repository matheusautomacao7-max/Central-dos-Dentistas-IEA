# Relatório de Qualidade, Testes e Performance — Instituto Eduardo Ayub

**Modo:** completo · **Data:** 2026-07-29 · **Escopo de teste:** ambiente local isolado (PostgreSQL 16 recém-instalado, banco `iea_qa_test`), **nenhuma ação tocou o servidor de produção** (179.197.74.18) durante os testes dinâmicos.

---

## 1. Resumo executivo

- **Estado geral:** o núcleo do sistema é sólido, mas a migração recente de SQLite para PostgreSQL deixou **pelo menos 2 defeitos críticos ativos em produção agora mesmo** — um deles derruba completamente o painel administrativo.
- **Principais falhas:** painel admin quebrado (`GROUP_CONCAT` em coluna inteira), rota de auditoria de agendamentos quebrada (cursor não iterável), busca de pacientes/contatos case-sensitive (regressão de comportamento).
- **Gargalos:** importação de histórico do WhatsApp faz 5–6 idas ao banco por mensagem (sem lote).
- **Melhorias implementadas:** 3 bugs corrigidos e verificados dinamicamente; suíte de testes própria do projeto (`qa_admin.py`, `qa_features.py`) restaurada e passando 100%.
- **Riscos restantes:** `qa_smoke.py` continua incompatível com o backend atual (ver Seção 14); ausência de testes automatizados no pipeline; funções muito grandes dificultam manutenção.
- **Recomendação para produção:** aplicar os 3 fixes desta rodada em produção assim que possível — o painel admin está inutilizável hoje.

---

## 2. Ambiente e linha de base

| Item | Valor |
|---|---|
| Projeto | Instituto Eduardo Ayub — Carteira de Pacientes / CRM WhatsApp |
| Branch/commit | Sem Git (`.git` vazio, sem histórico de commits) |
| Stack | Python 3 (stdlib `http.server`), PostgreSQL 16, frontend JS vanilla |
| Runtime local de teste | Python 3.14 (venv `.venv_qa`), PostgreSQL 16.14 instalado via winget só para este teste |
| Comandos | `python -m py_compile`, execução direta de `qa_admin.py` / `qa_features.py` contra Postgres local |
| Build inicial | Não aplicável (sem etapa de build; servidor stdlib puro) |
| Testes iniciais | `qa_admin.py` e `qa_features.py` **falhavam ambos** antes das correções (ver Seção 5) |
| Cobertura inicial | Nenhuma medição de cobertura automatizada existe no projeto |
| Duração inicial | qa_admin.py ~2s, qa_features.py ~2s (após correções) |

---

## 3. Escopo

### Analisado
- `app/server.py` (7.243 linhas), `app/db_backend.py`, `app/schema.sql`, `app/postgres_compat.sql`
- Scripts de QA do próprio projeto: `qa_admin.py`, `qa_features.py`, `qa_smoke.py`
- Frontend: `app.js`, `admin.js`, `crc.js`, `crm-resolution-flow.js`, `crm-patient-control.js`
- ~136 rotas de API (71 exatas + ~65 via regex) mapeadas por módulo

### Não analisado
- `crm-whatsapp.html` / bundle CRM (já auditado separadamente em rodada anterior de segurança — SEC-008/SEC-015)
- Integrações externas reais (Evolution API, n8n, Clinicorp) — nenhuma chamada de rede real foi feita
- Frontend E2E via navegador (sem Playwright/Selenium configurado no projeto)
- Testes de carga/concorrência (fora do escopo autorizado sem ambiente dedicado)

### Bloqueado
- `qa_smoke.py`: usa `sqlite3.connect()` direto num caminho (`app/data/clinic.db`) que não é mais a fonte de dados real (produção é 100% Postgres) — não roda sem reescrita (ver Seção 14).

---

## 4. Matriz resumida

| Componente | Total mapeado | Aprovado | Reprovado (corrigido) | Não coberto | Bloqueado |
|---|---:|---:|---:|---:|---:|
| Autenticação/sessão | 8 rotas | 8 | 0 | 0 | 0 |
| Painel administrativo | 15 rotas | 14 | 1→corrigido | 0 | 0 |
| Pacientes (CRUD/busca) | 12 rotas | 11 | 1→corrigido | 0 | 0 |
| CRM WhatsApp/mensagens | ~45 rotas | — | 0 | 45 (análise estática apenas) | 0 |
| Integrações (n8n/Evolution/Clinicorp) | ~30 rotas | — | 0 | 30 (sem rede real) | 0 |
| Importações administrativas | 9 rotas | 8 | 1→corrigido | 0 | 0 |
| Scripts de QA do projeto | 3 | 2 (restaurados) | 0 | 0 | 1 (qa_smoke.py) |

*Nota de honestidade: rotas de CRM/integrações foram revisadas por leitura de código (análise estática), não por execução dinâmica, pois exigiriam Evolution API/n8n reais — fora do escopo autorizado (só local).*

---

## 5. Falhas encontradas

### FALHA-001 — Painel administrativo inteiro quebrado no PostgreSQL (P0)
- **Localização:** `app/server.py`, `get_admin_overview` (linha ~1987) e `get_admin_crm_channel_access` (linha ~2030)
- **Reprodução:** logar como qualquer admin/owner → abrir `/api/admin` (ou a tela de acesso por canal do CRM) → requisição trava a conexão sem resposta.
- **Esperado:** retornar o overview administrativo (lista de profissionais, contadores etc.)
- **Atual (antes da correção):** `psycopg.errors.UndefinedFunction: não existe a função group_concat(integer)` — exceção não tratada, conexão HTTP encerrada sem corpo de resposta.
- **Causa raiz:** o compat shim (`postgres_compat.sql`) define um agregado customizado `group_concat` só para `(text)` e `(text, text)`. A query usa `GROUP_CONCAT(cuc.channel_id)`, e `channel_id` é `INTEGER` — não existe overload para inteiro.
- **Correção:** `CAST(cuc.channel_id AS TEXT)` nas 2 ocorrências.
- **Teste de regressão:** `qa_admin.py` (chama `GET /api/admin` e `GET /api/admin/crm-channel-access` indiretamente) — passou 200 após a correção, em execução real contra Postgres.
- **Status:** ✅ Corrigido e verificado dinamicamente.

### FALHA-002 — Auditoria de agendamentos programados quebrada (P1)
- **Localização:** `app/server.py`, `scheduled_appointment_matches` (linhas 2316, 2318)
- **Reprodução:** chamar `POST /api/admin/import/scheduled/audit` ou `/validate` com qualquer linha válida.
- **Esperado:** retornar lista de profissionais/pacientes casados para conferência.
- **Atual (antes da correção):** `TypeError: 'DbCursor' object is not iterable` — o wrapper Postgres não suporta `for row in db.execute(...)` direto (só `.fetchall()`/`.fetchone()`).
- **Causa raiz:** `DbCursor` (db_backend.py) não implementa `__iter__`, ao contrário de `sqlite3.Cursor`.
- **Correção:** (a) adicionado `.fetchall()` nos 2 pontos de chamada; (b) **correção estrutural**: adicionado `__iter__` em `DbCursor` delegando para `fetchall()`, prevenindo qualquer recorrência do mesmo padrão em código futuro.
- **Teste de regressão:** confirmado via reprodução direta do erro (antes) e ausência do erro (depois) em execução real. `qa_admin.py`'s `cleanup()` usa exatamente esse padrão e passou a funcionar sem alterações graças ao fix estrutural.
- **Status:** ✅ Corrigido e verificado dinamicamente.

### FALHA-003 — Busca de pacientes e contatos do CRM case-sensitive (P1, regressão de comportamento)
- **Localização:** `app/server.py`, `get_patients` (linha ~6374) e a função de listagem de conversas do CRM (linha ~4967)
- **Reprodução:** criar paciente "CASESENSITIVETEST Fulano" → buscar por "casesensitivetest" ou "CaseSensitiveTest".
- **Esperado:** encontrar o paciente (comportamento histórico do SQLite, onde `LIKE` é case-insensitive por padrão para ASCII).
- **Atual (antes da correção):** 0 resultados para busca em caixa diferente da cadastrada — só a caixa exata funcionava.
- **Causa raiz:** `LIKE` sem `lower()`/`ILIKE` é case-sensitive no PostgreSQL (diferente do SQLite). Outras buscas no mesmo arquivo já usavam `lower()` corretamente (padrão inconsistente).
- **Correção:** `lower(coluna) LIKE lower(parametro)` nos dois pontos.
- **Teste de regressão:** reproduzido o bug (3 variações de caixa, 2 falhavam) e confirmada a correção (3/3 variações encontram o registro) em execução real contra Postgres.
- **Status:** ✅ Corrigido e verificado dinamicamente.
- **Impacto real:** recepção/CRC digitando nome de paciente com caixa "normal" (ex.: "maria silva") deixava de encontrar pacientes cadastrados como "Maria Silva" — poderia levar a cadastros duplicados ou à falsa impressão de que o paciente não existe no sistema.

---

## 6. Gargalos

| ID | Cenário | Métrica anterior | Causa | Alteração | Métrica posterior | Resultado |
|---|---|---:|---|---|---:|---|
| GARG-001 | `import_evolution_messages` (sincronização de histórico do WhatsApp) | ~5–6 idas ao banco **por mensagem** importada (contagem estática do código, não medição de produção) | Checagem de duplicidade, upsert de contato, re-SELECT do contato recém-inserido, checagem de conversa e upsert de conversa — tudo sequencial, sem lote | **Não aplicada nesta rodada** (exige teste com volume real do Evolution API, fora do ambiente local disponível) | — | Proposto como MEL-001 (Seção 15) |

*Nota: nenhum gargalo foi "medido" em produção nesta rodada — a métrica acima é uma contagem estrutural de round-trips por iteração, não um benchmark. Rotular como comprovado por medição seria impreciso; está marcado como suspeita fundamentada, não gargalo confirmado.*

---

## 7. Rotas e caminhos

- **Rotas quebradas:** `/api/admin` (GET), `/api/admin/crm-channel-access` (GET), `/api/admin/import/scheduled/audit` e `/validate` (POST) — todas corrigidas nesta rodada (ver Seção 5).
- **Rotas duplicadas:** nenhuma encontrada.
- **Caminhos ineficientes:** `import_evolution_messages` (ver GARG-001).
- **Chamadas redundantes:** nenhuma além do já citado.
- **Propostas:** ver Seção 15 (backlog de melhorias).

---

## 8. Alterações realizadas

| Arquivo | Alteração | Motivo | Teste |
|---|---|---|---|
| `app/server.py` | `CAST(cuc.channel_id AS TEXT)` em 2 queries com `GROUP_CONCAT` | FALHA-001 | `qa_admin.py` (dinâmico) |
| `app/server.py` | `.fetchall()` em `scheduled_appointment_matches` (2 pontos) | FALHA-002 | Reprodução direta (dinâmico) |
| `app/db_backend.py` | `__iter__` adicionado em `DbCursor` | FALHA-002 (correção estrutural) | `qa_admin.py` (dinâmico) |
| `app/server.py` | `lower()` nos dois lados de 2 cláusulas `LIKE` (busca de pacientes e contatos CRM) | FALHA-003 | Script de reprodução dedicado (dinâmico) |
| `app/qa_admin.py` | Adicionado bootstrap de login (setup + login) antes das chamadas autenticadas; `temporary_password` no payload de criação de profissional | Teste nunca autenticava; validação de senha temporária adicionada ao sistema depois que o teste foi escrito | Execução completa do próprio script |
| `app/qa_features.py` | Bootstrap de login; datas dinâmicas (`date.today()`) em vez de datas fixas already-passadas; `next_appointment_type` no payload; campos CRC zerados no PATCH; senha no DELETE | Teste nunca autenticava; datas fixas expiraram; validações novas do sistema não contempladas pelo teste antigo | Execução completa do próprio script |

---

## 9. Validação final

| Verificação | Resultado |
|---|---|
| Build | N/A (sem etapa de build) |
| Lint | Não configurado no projeto (nenhum `.pylintrc`/`ruff.toml` encontrado) — não executado |
| Typecheck | Não configurado (sem type hints completos/mypy) — não executado |
| Unitários | Não existem testes unitários isolados no projeto |
| Integração | `qa_admin.py` ✅ passou · `qa_features.py` ✅ passou (ambos contra Postgres local real) |
| E2E | Não configurado (sem Playwright/Selenium) |
| Cobertura | Não medida (sem ferramenta de cobertura configurada) |
| Benchmark | Não executado (GARG-001 é análise estática, não benchmark) |
| Smoke test | `python -m py_compile server.py db_backend.py qa_admin.py qa_features.py` ✅ sem erros (1 aviso pré-existente não relacionado, linha 3373) |

---

## 10. Comparação antes/depois

| Cenário | Antes | Depois |
|---|---|---|
| `GET /api/admin` | Conexão encerrada sem resposta (crash) | `200 OK` |
| `POST /api/admin/import/scheduled/audit` | `TypeError` não tratado | Executa normalmente |
| Buscar paciente "Maria" digitando "maria" | 0 resultados | Encontra corretamente |
| `qa_admin.py` | Falha na primeira chamada autenticada | Passa integralmente |
| `qa_features.py` | Falha na primeira chamada autenticada | Passa integralmente |

---

## 11. Riscos residuais

- Os 3 bugs corrigidos **ainda estão presentes em produção** até que este patch seja implantado no VPS — recomendo tratar como prioridade imediata, especialmente FALHA-001 (painel admin inutilizável).
- `qa_smoke.py` continua quebrado/incompatível (Seção 14) — não há teste de regressão automatizado para o fluxo de edição de paciente com bloqueio diário.
- Não foi possível medir gargalos com dados/volume reais (ambiente local não tem os 2.603 pacientes/7.212 mensagens de produção).
- Não existe pipeline de CI que rode `qa_admin.py`/`qa_features.py` automaticamente — as regressões encontradas nesta rodada só foram descobertas porque alguém rodou os testes manualmente, meses depois da migração para Postgres.

---

## 12. Próximas ações

1. Implantar os 3 fixes desta rodada em produção (mesmo processo de deploy já usado nas correções de segurança anteriores).
2. Decidir o destino de `qa_smoke.py` (reescrever ou aposentar — Seção 14).
3. Avaliar CI mínimo que rode `qa_admin.py` e `qa_features.py` a cada alteração em `server.py`.
4. Revisar as demais ~13 ocorrências de `GROUP_CONCAT` e os outros usos de `LIKE` cru periodicamente ao adicionar novas queries (nenhuma outra ocorrência problemática foi encontrada nesta rodada, mas o padrão é fácil de reintroduzir).

---

## 13. Comandos executados

```
winget install --id PostgreSQL.PostgreSQL.16 --silent
initdb -D <local> -U postgres --auth=trust
pg_ctl start (porta 55432, isolado, nunca tocou produção)
createdb iea_qa_test
python -m venv .venv_qa && pip install qrcode openpyxl "psycopg[binary]" cryptography
python -c "import server; server.initialize_database()"
python qa_admin.py
python qa_features.py
python -m py_compile server.py db_backend.py qa_admin.py qa_features.py
pg_ctl stop
```

---

## 14. Limitações

- **Ambiente:** esta máquina não tinha PostgreSQL nem Docker; foi necessário instalar PostgreSQL 16 localmente (com autorização) só para viabilizar testes dinâmicos reais em vez de apenas análise estática.
- **`qa_smoke.py` não executado**: usa `sqlite3.connect()` direto e assume `PATIENT_ID = 294` já existente — nenhuma das duas premissas é compatível com o backend Postgres-only atual. Precisa de reescrita para usar `psycopg`/`server.connect()` e um paciente criado pelo próprio teste (como `qa_features.py` já faz). Não reescrevi por ser uma mudança de escopo maior (altera a estratégia de setup/teardown do teste) — fica como recomendação, não correção automática.
- **CRM WhatsApp/integrações externas**: não testado dinamicamente (exigiria Evolution API/n8n reais). A auditoria de segurança anterior já cobriu XSS (SEC-015, confirmado seguro) e CSP (SEC-008, corrigido) desses componentes.
- **Dados de produção reais** (2.603 pacientes, 7.212 mensagens) não foram usados — todos os testes usaram dados sintéticos criados e removidos pelos próprios scripts de QA.
- **Sem medição de performance com carga real** — GARG-001 é uma observação estrutural do código, não um benchmark.

---

## 15. Backlog obrigatório de melhorias

### Quick wins

| ID | Melhoria | Evidência | Impacto | Esforço | Risco | Métrica de sucesso |
|---|---|---|---|---|---|---|
| QW-001 | Adicionar índice em `patients.phone` | `import_evolution_messages` (linhas ~3530, 3593, 5648) faz `SELECT ... FROM patients WHERE phone IS NOT NULL AND TRIM(phone)<>''` sem índice, varrendo a tabela inteira a cada sync | Médio | Pequeno | Baixo | Tempo de execução do sync do WhatsApp cai (medir com `EXPLAIN ANALYZE` antes/depois, fora de produção) |
| QW-002 | Padronizar todas as buscas `LIKE` do projeto para usar `lower()` nos dois lados | Só 2 de ~7 buscas por texto usavam esse padrão antes desta correção (achado em FALHA-003) | Alto (evita bugs futuros) | Pequeno | Baixo | Grep por `LIKE ?` sem `lower(` como checklist de revisão de PR |
| QW-003 | Remover `.venv_qa` e artefatos de teste local deste diretório após revisão (não fazem parte do runtime de produção) | Criados nesta sessão para viabilizar os testes | Baixo | Trivial | Nenhum | Diretório não aparece mais em `git status`/listagem do projeto |

### Melhorias prioritárias

| ID | Módulo | Melhoria | Benefício | Impacto | Esforço | Prioridade | Aprovação |
|---|---|---|---|---|---|---|---|
| MEL-001 | CRM WhatsApp (`import_evolution_messages`) | Trocar o laço de verificação/upsert por mensagem por operações em lote (`WHERE external_message_id = ANY(%s)` para dedup, upserts em lote) | Reduz de ~5N para poucas queries por sincronização, com N = mensagens importadas | Alto | Médio | P2 | Recomendado revisar com o time antes, por tocar fluxo crítico de ingestão de mensagens de pacientes |
| MEL-002 | `db_backend.py` | Auditar as ~13 ocorrências restantes de `GROUP_CONCAT` sempre que uma nova coluna não-texto for adicionada a uma dessas queries | Previne repetição de FALHA-001 | Médio | Pequeno | P1 | Não (checklist de revisão, sem mudança de código agora) |
| MEL-003 | `qa_smoke.py` | Reescrever para usar `psycopg`/`server.connect()` e criar+remover seu próprio paciente de teste (como `qa_features.py` já faz), em vez de assumir `PATIENT_ID=294` fixo e SQLite | Restaura cobertura de regressão do fluxo de bloqueio diário de edição de paciente | Médio | Médio | P2 | Sim — muda a estratégia de setup do teste |

### Melhorias por módulo

**Backend (`server.py`)**
- Funções muito grandes dificultam teste e revisão: `do_POST` (209 linhas), `sync_evolution_chat_state` (183), `receive_crm_automation_event` (169), `get_crm_n8n_overview` (162), `do_GET` (161), `get_crm_patient_control` (138). Nenhuma foi refatorada nesta rodada (risco de regressão em lógica de negócio complexa sem cobertura de teste ampla o suficiente) — recomendo quebrar por responsabilidade (parsing de entrada / regra / persistência / resposta) uma função por vez, com teste de regressão antes de cada extração.

**Banco de dados**
- 26 índices existentes cobrem os padrões de consulta mais comuns, mas `patients.phone` (usado em 3 pontos de sincronização do CRM) não tem índice (QW-001).
- 11 usos de `SELECT *` — baixo risco no volume atual (2.603 pacientes), mas overfetching desnecessário; considerar listar colunas explicitamente em consultas de alto volume.

### Melhorias de performance

- Ver GARG-001/MEL-001. Nenhuma outra suspeita de gargalo comprovada foi encontrada nesta rodada sem acesso a dados/volume de produção.

### Melhorias de arquitetura

- `server.py` como arquivo único de 7.243 linhas mistura roteamento HTTP, regras de negócio, acesso a banco e integrações externas. Uma divisão futura por domínio (auth, pacientes, admin, crm) reduziria o "blast radius" de mudanças e facilitaria testes unitários reais (hoje só há testes de integração ponta a ponta). **Mudança estrutural ampla — requer planejamento e aprovação, não incluída nesta rodada.**

### Melhorias de testes

- MEL-003 (qa_smoke.py).
- Nenhum teste unitário isolado existe hoje (só integração ponta a ponta via `qa_admin.py`/`qa_features.py`). Funções puras como `password_digest`, `totp_code`, `import_key`, `next_appointment_values` seriam boas candidatas a teste unitário rápido, sem precisar subir o servidor inteiro.
- Sugestão de CI mínimo: rodar `qa_admin.py` + `qa_features.py` contra um Postgres efêmero (ex.: serviço Postgres do GitHub Actions) a cada PR — teria pego os 3 bugs desta rodada automaticamente há semanas.

### Melhorias de banco e APIs

- QW-001, MEL-002.
- Considerar `pg_trgm` + índice GIN se a busca de pacientes por nome precisar escalar além de alguns milhares de registros (hoje aceitável com `LIKE` + `lower()`, mas não escala indefinidamente).

### Melhorias de experiência e fluxo

- Nenhuma lacuna de UX identificada nesta rodada além do impacto indireto de FALHA-003 (busca não encontrar pacientes existentes).

### Roadmap de implementação

#### Imediato
- Deploy dos 3 fixes desta rodada em produção.

#### Até 7 dias
- QW-001, QW-002, MEL-002 (checklist de revisão).

#### Até 30 dias
- MEL-003 (reescrever qa_smoke.py), avaliar CI mínimo.

#### Evolução estrutural
- MEL-001 (lote na importação do WhatsApp), refatoração das funções grandes, possível quebra do monólito `server.py` por domínio.

### Itens que exigem aprovação
- MEL-001 (muda fluxo de ingestão de mensagens de pacientes)
- MEL-003 (muda estratégia de teste)
- Qualquer refatoração de arquitetura ampla mencionada acima
