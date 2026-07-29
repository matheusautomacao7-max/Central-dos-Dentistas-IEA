import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const match = source.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);
if (!match) throw new Error("Template do CRM não encontrado");

let template = JSON.parse(match[2]);
if (template.includes("CRM_GATEWAY_ERROR_GUARD_V1")) {
  console.log("crm-gateway-error-guard-already-applied");
  process.exit(0);
}

const anchor = "  async sendMsg(){";
if (!template.includes(anchor)) throw new Error("Ponto de inserção do leitor JSON não encontrado");

const helper = `  // CRM_GATEWAY_ERROR_GUARD_V1
  async readJsonResponse(response){
    const text=await response.text();
    if(!text)return {};
    try{return JSON.parse(text);}catch(error){
      if(response.status===502||/bad gateway/i.test(text))return{error:'O servidor ficou temporariamente indisponível. Aguarde alguns segundos e tente novamente.'};
      if(response.status===503||response.status===504)return{error:'O serviço está reiniciando ou demorou para responder. Tente novamente em instantes.'};
      return{error:response.ok?'O servidor retornou uma resposta inválida. Atualize a página e tente novamente.':\`Não foi possível concluir a operação (erro \${response.status||'de conexão'}).\`};
    }
  }
`;

template = template.replace(anchor, helper + anchor);
const before = (template.match(/await response\.json\(\)/g) || []).length;
if (!before) throw new Error("Nenhuma leitura JSON encontrada para proteger");
template = template.replaceAll("await response.json()", "await this.readJsonResponse(response)");

const serialized = JSON.stringify(template).replaceAll("</script>", "<\\/script>");
const output = source.slice(0, match.index) + match[1] + serialized + match[3] + source.slice(match.index + match[0].length);
fs.writeFileSync(file, output, "utf8");
console.log(`crm-gateway-error-guard-applied:${before}`);
