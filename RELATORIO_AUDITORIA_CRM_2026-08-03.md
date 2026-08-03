# Auditoria funcional, qualidade e performance do CRM

**Data:** 03/08/2026
**Modo:** completo
**Escopo:** CRM local, com dados sintéticos e navegador automatizado
**Produção:** não alterada nesta auditoria

## Resumo executivo

Os problemas informados foram reproduzidos por contrato de código ou teste de interface e corrigidos localmente. A causa não era única: havia uma exclusão indevida no Funil, um contrato divergente entre API e Controle, componentes sem eventos reais na Gestão e uma disputa de atualizações na barra lateral. A etiqueta de campanha também estava sendo inserida numa posição diferente da solicitada. Na reprodução de áudio, o servidor não atendia requisições HTTP Range e podia gravar MP3/M4A com extensão ou MIME incompatível.

Após as correções, toda a suíte disponível passou: 18 testes Python, 9 testes JavaScript/navegador, validação do bundle e template do CRM, compilação Python e validação de sintaxe dos arquivos JavaScript alterados.

## Matriz de validação

| Fluxo | Evidência anterior | Correção | Validação | Estado |
|---|---|---|---|---|
| Resolver → Funil | A visão `operational` excluía `status='Resolvida'` | Funil inclui resolvidos do dia; histórico completo permanece no Controle | Integração com banco sintético | Aprovado |
| Resolver → Controle | API devolvia `rows`; tela procurava `items` e nomes de campos inexistentes | Contrato e colunas alinhados | Integração backend + asserções frontend | Aprovado |
| Pacientes → iniciar conversa | Botões legados podiam executar ação padrão de formulário durante remontagem | Ação padrão cancelada sem bloquear o handler SPA | Navegador confirma uma única navegação de documento | Aprovado |
| Gestão | Filtros/Exportar eram estáticos; gráfico lia `hour`, API envia `bucket` | Dashboard funcional com período, canal, atualização, gráfico, equipe e CSV | Playwright com API simulada | Aprovado |
| Barra lateral | Escritas repetidas de estilo alimentavam o observador; divisor ADMIN tinha disputa `hidden`/`display` | Escritas idempotentes, alinhamento estável e ocultação determinística | E2E repetido 5 vezes + limite de mutações | Aprovado |
| Etiqueta de campanha | Badge ficava depois do título e ignorava a etiqueta normalizada | Usa `tag_names` e posiciona imediatamente antes da prioridade | Playwright verifica texto e ordem no DOM | Aprovado |
| Reprodução de áudio | Endpoint sempre devolvia 200 completo e podia usar extensão/MIME incorretos | HTTP Range 206/416, MIME preservado/normalizado e fallback autenticado no player | Teste de Range + áudio real decodificado e reproduzido no Chromium | Aprovado |

## Causas raiz confirmadas

1. **Funil:** o backend removia todas as conversas resolvidas, embora a interface possua a coluna “Resolvidos”.
2. **Controle:** `/api/crm/patient-control` retorna `rows`, `contact_name` e `resolved_by_name`; a interface esperava `items`, `patient_name` e `agent_name`.
3. **Gestão:** seletores e exportação não possuíam eventos. O gráfico também usava uma chave incompatível com a resposta real.
4. **Travamentos da barra:** o observador acompanhava alterações de estilo e a própria normalização regravava os mesmos estilos, criando trabalho recorrente desnecessário.
5. **Campanhas:** a origem era inserida após o nome e usava apenas o identificador da automação, em vez da etiqueta de campanha já vinculada à conversa.
6. **Áudios:** o player nativo solicitava trechos do arquivo, mas o servidor não implementava `Range`. Além disso, `audio/mpeg` era salvo como `.mp4` e `audio/x-m4a` podia cair em `.bin`, confundindo o navegador.

## Alterações implementadas

- Resolvidos do dia aparecem na coluna correta do Funil.
- Todos os atendimentos finalizados continuam disponíveis no Controle, com paciente, atendente, resultado, agendamento, canal e profissional.
- Gestão agora consulta dados reais, aceita período e canal, atualiza sem recarregar e exporta CSV.
- Navegação mantém o comportamento SPA e evita submissão acidental ao iniciar conversa.
- Ícones e textos da barra receberam largura, centralização e quebra de texto consistentes.
- Observadores da barra estabilizam após a primeira normalização.
- Etiqueta da campanha aparece no cabeçalho da conversa, antes da prioridade.
- Áudios são entregues com `Accept-Ranges`, respostas `206 Partial Content` e MIME compatível com MP3, M4A, OGG e WebM.
- O player tenta um carregamento autenticado alternativo e mostra uma mensagem útil quando a mídia não pode ser carregada.
- O pipeline de qualidade passou a executar os novos testes e instalar o navegador necessário no GitHub Actions.

## Testes executados

- 18 arquivos de regressão Python: CRM, permissões, atribuição, bloqueio de paciente, metas, entrega de mídia com Range, banco, segredos, observabilidade e endurecimento.
- 9 arquivos JavaScript/E2E: perfil, compositor, metas, contatos internos, Gestão/campanha, reprodução real de áudio, estabilidade dos players, navegação e cache persistente.
- Teste de navegação repetido cinco vezes para verificar intermitência.
- `compileall`/`py_compile`, `node --check`, `git diff --check`.
- Validadores do bundle e template do CRM.

## Limitações e riscos remanescentes

- Evolution API, n8n e WhatsApp reais não foram acionados; esta rodada validou os contratos locais e respostas simuladas. O teste final dessas integrações deve ser feito após publicação controlada.
- Não foi executado teste de carga com volume real de produção. A correção de mutações elimina o loop confirmado, mas métricas de Long Tasks e memória ainda podem ser adicionadas a uma etapa futura de observabilidade frontend.
- `app/server.py` e o bundle legado continuam extensos. Novas mudanças devem manter testes de contrato antes de qualquer refatoração estrutural.

## Critério para publicação

1. Revisar o diff e criar commit.
2. Publicar com backup e identificador de release.
3. Confirmar saúde da API.
4. Validar manualmente com uma conversa de teste: iniciar em Pacientes, resolver, conferir Funil/Controle e abrir Gestão.
5. Confirmar uma resposta real de campanha e a etiqueta antes da prioridade.
