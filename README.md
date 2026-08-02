# Instituto Eduardo Ayub — CRM e carteira de pacientes

Aplicação web interna para carteira de pacientes, atendimento omnichannel, fila do CRC, metas, funil, automações e gestão de acessos.

## Arquitetura atual

- aplicação Python 3.12 servida em container Docker;
- PostgreSQL 16 como banco obrigatório;
- Evolution API para os canais de WhatsApp;
- n8n para automações autorizadas;
- Traefik/TLS na publicação da VPS;
- frontend do CRM servido pela própria aplicação.

## Configuração

O `compose.yaml` espera as variáveis abaixo no ambiente de implantação:

- `POSTGRES_PASSWORD`;
- `AUTH_SETUP_TOKEN`;
- `INTEGRATION_TOKEN` — integrações internas e exportações;
- `EVOLUTION_WEBHOOK_TOKEN` — segredo exclusivo dos webhooks da Evolution;
- `APP_SECRET_KEY` — chave AES em base64 para proteger 2FA e credenciais persistidas das integrações;
- `EVOLUTION_API_KEY` e, opcionalmente, `EVOLUTION_API_URL`;
- `APP_RELEASE_ID` — identificador do commit/release publicado.
- `WEBHOOK_PAYLOAD_RETENTION_DAYS` e `SECURITY_EVENT_RETENTION_DAYS` — prazos de retenção técnica (padrões: 90 e 365 dias).
- `DB_POOL_MIN`, `DB_POOL_MAX` e `DB_POOL_TIMEOUT_SECONDS` — limites opcionais do pool PostgreSQL (padrões: 2, 12 e 8 segundos).

Nunca grave valores reais dessas variáveis no repositório.

## Execução local com Docker

```bash
docker compose up --build
```

A API fica vinculada somente a `127.0.0.1:8000`. A sonda `GET /api/health` valida também a conexão com o PostgreSQL.

## Testes

O workflow `.github/workflows/quality.yml` executa, em cada push e pull request:

- compilação de todos os arquivos Python;
- testes de permissões, atribuição, metas, mídia, bloqueio de pacientes e segurança;
- validação de sintaxe JavaScript;
- regressões do bundle e dos fluxos principais do CRM.

Para uma verificação local completa, execute os mesmos comandos descritos no workflow antes de publicar.

## Operação

- backups automatizados: `ops/backup-instituto-ayub.sh`;
- configuração de webhooks: `ops/configure_evolution_webhooks.py`;
- verificações pós-deploy: scripts `ops/verify_*_prod.py`;
- mídia persistente: volume `/opt/instituto-ayub/data/crm-media`;
- banco persistente: volume Docker `postgres_data`.

Mudanças de autenticação, permissões, esquema ou integrações devem ser publicadas somente após backup, regressão completa e validação pós-deploy.
