# Integração Meta — ambiente de teste

## Objetivo

Adicionar WhatsApp Cloud API e Instagram Direct ao CRM em modo paralelo, sem alterar a Evolution nem os canais que atendem pacientes hoje.

## Regras inegociáveis

- A produção atual continua usando somente a Evolution.
- Nenhum webhook da Meta cria conversa, envia mensagem ou altera atendimento nesta etapa.
- Credenciais ficam apenas na VPS de teste, nunca no GitHub, banco de dados ou navegador.
- Todo evento recebido é marcado como `test_mode` e armazenado com dados sensíveis minimizados.
- A ativação produtiva exige testes aprovados e autorização explícita.

## Fases

### 1. Fundação de laboratório

- Branch `codex/meta-integration-sandbox`.
- Configurações isoladas por variáveis `META_TEST_*`.
- Tabelas de conexão, eventos e auditoria com separação por provedor.
- Página administrativa indicando claramente `Ambiente de teste`.

### 2. Recebimento seguro

- Endpoint de verificação de webhook da Meta.
- Assinatura validada com `X-Hub-Signature-256`.
- Registro idempotente de eventos para impedir duplicidade.
- Nenhuma alteração de conversa: apenas painel de eventos de teste.

### 3. Leitura controlada

- Normalização dos eventos de WhatsApp e Instagram Direct.
- Associação somente com contatos de teste autorizados.
- Visualização em uma caixa de entrada de laboratório, separada do Inbox oficial.

### 4. Envio de teste

- Envio permitido somente para números de teste e contatos previamente liberados.
- Confirmação manual obrigatória antes de cada envio.
- Log completo de requisição, resposta e identificador da Meta, sem gravar segredos.

### 5. Homologação

- Testes de assinatura inválida, duplicidade, falha de token, limite de API, mídia, mensagem recebida e envio.
- Teste de regressão da Evolution e do Inbox oficial.
- Checklist de reversão: desligar `META_TEST_ENABLED` interrompe o fluxo sem apagar dados.

### 6. Produção, somente após aprovação

- Novo conjunto de credenciais produtivas.
- Migração de um único canal piloto.
- Monitoramento, métricas e plano de retorno para Evolution.

## Itens necessários da Meta, apenas na fase 2

- Aplicativo Meta Developers em modo **Development**.
- Produto WhatsApp Cloud API com número de teste.
- Token de acesso de teste e `App Secret`.
- Para Instagram: conta profissional vinculada a uma Página do Facebook e permissões de mensagens no aplicativo de teste.
- URL HTTPS de teste para o webhook.

## Critério para seguir de fase

Cada fase deve ter testes automatizados passando, validação manual registrada e revisão do impacto no CRM oficial antes de avançar.
