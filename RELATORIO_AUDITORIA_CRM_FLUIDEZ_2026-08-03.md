# Auditoria de qualidade, fluidez e regressões do CRM

Data: 03/08/2026
Escopo: CRM web, APIs, integração Evolution, funil, controle, campanhas, mídia e barreira de qualidade.
Ambiente: workspace local. Produção e banco remoto não foram alterados nem usados para testes destrutivos.

## Resultado executivo

A causa principal da lentidão era uma combinação de polling agressivo, payloads grandes, consultas duplicadas, observers globais e módulos iniciados antes de o DOM definitivo existir. Havia ainda concorrências capazes de trocar a conversa selecionada, duplicar uma persistência de envio e registrar mais de uma resolução.

As correções prioritárias foram implementadas localmente e cobertas por regressões. O código ainda não foi publicado nem implantado em produção.

## Linha de base observada

- A captura de Network fornecida mostrou respostas de conversas entre aproximadamente 353 KB e 595 KB.
- A lista, as métricas e as mensagens eram atualizadas a cada 3 segundos. Com uma conversa aberta, isso representava aproximadamente 60 requisições programadas por minuto antes dos bridges auxiliares.
- A lista de aproximadamente 595 KB, isoladamente, podia consumir cerca de 11,9 MB por minuto quando chamada 20 vezes.
- O frontend carregava 13 bridges, 14 `MutationObserver` (11 globais) e cinco camadas sobre `window.fetch`.
- O envio podia manter uma conexão do pool presa durante chamadas externas de até 60 segundos.

Esses valores são evidências da versão anterior e estimativas derivadas do código. Não são um benchmark autenticado da versão corrigida em produção.

## Correções implementadas

### Fluidez e navegação

- Polling pesado de conversas/métricas passou de 3 para 10 segundos, com trava de requisição em andamento.
- Polling é suspenso quando a aba está oculta e retomado quando volta a ficar visível.
- Mensagens continuam com atualização próxima do tempo real, mas sem empilhar requisições.
- Removido o abortador global que fazia Inbox, Funil e campanhas cancelarem as requisições uns dos outros.
- Removido o `location.reload()` do fluxo de iniciar conversa.
- Bridges agora são carregados em ordem somente depois do unpack e do DOM definitivo.
- Corrigido loop do item **Controle**, que produzia dezenas de `NotFoundError` por segundo.
- Corrigida a corrida em que uma resposta atrasada podia reabrir o paciente anterior.
- O bridge de acessibilidade deixou de observar mutações de atributos que ele próprio provocava.

### Rede e payload

- Criados contratos compactos para workspace, funil e origem de campanha.
- O workspace deixou de solicitar fotos de todos os pacientes no payload principal; iniciais continuam disponíveis.
- A busca de campanhas passou a ser filtrada no banco e possui cache/single-flight mesmo quando o resultado é vazio.
- Removido o GET duplicado que o bridge de mídia fazia após qualquer envio.
- Pela cadência programada, as chamadas periódicas caem de aproximadamente 60 para 32 por minuto com conversa aberta, antes de considerar a redução adicional do payload compacto. Em aba oculta, os pollers principais param.

### Backend, banco e concorrência

- Envio pela Evolution ocorre fora da transação do banco; conexões são usadas apenas em blocos curtos.
- Credenciais globais são consultadas somente quando o canal não possui configuração própria.
- Persistência usa upsert pelo `external_message_id`: webhook antecipado não causa mais violação UNIQUE nem duplica a linha.
- A finalização de um envio não sobrescreve mais uma transferência de atendente ocorrida durante a chamada externa.
- O GET de mensagens não executa mais `ffprobe`, leitura de arquivo e nova conexão para cada áudio legado sem duração.
- Métricas de estoque atual foram separadas do período histórico e limitadas a abertos mais resolvidos do período.
- Reabertura de retornos vencidos passou de `2N+1` para update atômico com `RETURNING` e inserção em lote; duas execuções não geram dois eventos.
- Resolução agora bloqueia e relê o paciente antes de gravar; tentativa duplicada retorna conflito.
- Funil de resolvidos usa data local, corrigindo o desaparecimento que podia ocorrer no período noturno.
- Resoluções novas registram explicitamente o horário local usado pelas metas e pelo controle.
- Relatórios calculam totais e grupos sobre todo o filtro, mesmo quando a grade visual permanece limitada a 500 linhas.

### Qualidade e CI

- Corrigidos testes desatualizados de cache-buster.
- O teste legado e instável de sidebar foi removido; o script realmente carregado passou a ser testado.
- Testes antes omitidos de fotos, abas do Inbox, navegação, funil e Controle foram incluídos no workflow.
- Foram adicionadas regressões para fluidez, payload compacto, métricas antigas, relatórios acima de 500, resolução duplicada, retorno vencido, webhook antecipado, transação durante rede, loop do Controle e troca tardia de conversa.

## Validação local

| Verificação | Resultado |
|---|---:|
| Regressões Python do workflow | 19/19 |
| Regressões/validadores Node do workflow | 15/15 |
| Parse de sintaxe Python | 41/41 |
| Sintaxe JavaScript/MJS | 73/73 |
| Validador do bundle | aprovado |
| Validador do template | aprovado |
| `git diff --check` | aprovado |

O inventário final possui 28 testes `test_crm*`, todos declarados no workflow. Dez fluxos críticos foram repetidos três vezes (30/30 aprovações), sem flakiness no estado congelado.

## Limitações da auditoria

- Não houve trace autenticado de Performance/INP/heap da versão corrigida em produção.
- Não houve carga real contra PostgreSQL, Evolution ou dados produtivos.
- Os testes de concorrência locais usam SQLite/fakes; o comportamento funcional foi coberto, mas não substitui um teste concorrente real em PostgreSQL.
- O limite de 500 conversas e o histórico inicial de 200/300 mensagens continuam sem paginação retroativa completa.

## Backlog recomendado

Prioridade alta:

1. Criar paginação por cursor para conversas, mensagens antigas e timeline.
2. Tirar definitivamente a ativação de retornos do GET e executá-la em job, com índice em `scheduled_return_at` (exige aprovação de migração de schema).
3. Adotar idempotência/outbox para garantir exatamente uma entrega mesmo se a Evolution aceitar e o banco falhar em seguida.
4. Fazer teste de concorrência real em PostgreSQL para claim, transferência e resolução.
5. Fazer rollout gradual, medir p95/p99, volume de requests, payload, erros JS e conexões do pool.

Prioridade média:

1. Virtualizar listas longas, construir somente a tela ativa e limitar caches com LRU.
2. Consolidar os bridges em componentes nativos e reduzir observers globais.
3. Adicionar timeout/abort controlado aos pollers e retry individual no loader de bridges.
4. Consolidar as agregações do relatório, hoje corretas mas ainda com várias leituras.
5. Revisar o adaptador PostgreSQL para remover savepoints por statement e `LASTVAL()` desnecessário.

## Critério de publicação

Antes do deploy: commit/push, CI verde e backup. Após o deploy: smoke autenticado de Inbox, troca de abas, abertura de paciente, texto, áudio, anexo, transferência, resolver, Funil, Controle, campanhas e Metas; depois observar logs e Network por pelo menos 15 minutos. Um rollback deve apontar para o commit anterior conhecido como estável.
