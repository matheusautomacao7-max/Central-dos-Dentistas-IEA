import fs from 'node:fs';

const file = new URL('../app/public/crm-whatsapp.html', import.meta.url);
const source = fs.readFileSync(file, 'utf8');
const match = source.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);
if (!match) throw new Error('Template do CRM não encontrado');
let template = JSON.parse(match[2]);
if (template.includes('CRM_FEATURE_PERMISSIONS_V1')) {
  console.log('crm-feature-permissions-already-applied');
  process.exit(0);
}

function replaceOnce(search, replacement, label) {
  if (!template.includes(search)) throw new Error(`Trecho não encontrado: ${label}`);
  template = template.replace(search, replacement);
}

replaceOnce(
  "syncStatus:{running:false,phase:'Pronto para sincronizar'} }; // CRM_CHANNEL_CONTROL_V1",
  "syncStatus:{running:false,phase:'Pronto para sincronizar'}, allowedFeatures:['inbox','queue','funnel','management','contacts','campaigns','integrations','settings'] }; // CRM_FEATURE_PERMISSIONS_V1 CRM_CHANNEL_CONTROL_V1",
  'estado de permissões',
);

const permissionMethod = `  async loadCrmPermissions(){
    try{
      const response=await fetch('/api/crm/permissions');
      const data=await this.readJsonResponse(response);
      if(!response.ok)throw new Error(data.error||'Falha ao carregar permissões');
      const allowed=Array.isArray(data.allowed_features)?data.allowed_features:[];
      const screenFeature={inbox:'inbox',filas:'queue',funil:'funnel',supervisor:'management',contatos:'contacts',campanhas:'campaigns',integracoes:'integrations',config:'settings'};
      const first=[['inbox','inbox'],['filas','queue'],['funil','funnel'],['supervisor','management'],['contatos','contacts'],['campanhas','campaigns'],['integracoes','integrations'],['config','settings']].find(item=>allowed.includes(item[1]));
      this.setState(s=>({allowedFeatures:allowed,screen:allowed.includes(screenFeature[s.screen])?s.screen:(first?.[0]||'inbox')}));
    }catch(error){this.fireToast(error.message||'Não foi possível carregar as permissões');}
  }
`;
replaceOnce('  componentDidMount(){', permissionMethod + '  componentDidMount(){', 'método de permissões');
replaceOnce('    this.applyTheme();\n', '    this.applyTheme();\n    this.loadCrmPermissions();\n', 'carregamento de permissões');

function wrapNav(eventName, propName) {
  const startToken = `    <div sc-camel-on-click="{{ ${eventName} }}"`;
  const start = template.indexOf(startToken);
  if (start < 0) throw new Error(`Menu não encontrado: ${eventName}`);
  const endToken = '\n    </div>';
  const end = template.indexOf(endToken, start);
  if (end < 0) throw new Error(`Fim do menu não encontrado: ${eventName}`);
  const blockEnd = end + endToken.length;
  const block = template.slice(start, blockEnd);
  template = template.slice(0, start) + `    <sc-if value="{{ ${propName} }}">\n${block}\n    </sc-if>` + template.slice(blockEnd);
}

for (const [eventName, propName] of [
  ['goInbox','canInbox'],['goFilas','canQueue'],['goFunil','canFunnel'],['goSuper','canManagement'],
  ['goContatos','canContacts'],['goCampanhas','canCampaigns'],['goIntegra','canIntegrations'],['goConfig','canSettings'],
]) wrapNav(eventName, propName);

replaceOnce(
  "    return {\n      isInbox:S.screen==='inbox'",
  "    const featureSet=new Set(S.allowedFeatures||[]);\n    return {\n      canInbox:featureSet.has('inbox'),canQueue:featureSet.has('queue'),canFunnel:featureSet.has('funnel'),canManagement:featureSet.has('management'),canContacts:featureSet.has('contacts'),canCampaigns:featureSet.has('campaigns'),canIntegrations:featureSet.has('integrations'),canSettings:featureSet.has('settings'),\n      isInbox:S.screen==='inbox'",
  'propriedades visuais',
);

const serialized = JSON.stringify(template).replaceAll('</script>', '<\\/script>');
fs.writeFileSync(file, source.replace(match[0], match[1] + serialized + match[3]));
console.log('crm-feature-permissions-applied');
