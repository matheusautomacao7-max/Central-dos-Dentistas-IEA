import fs from 'node:fs';

const file = new URL('../app/public/crm-whatsapp.html', import.meta.url);
const source = fs.readFileSync(file, 'utf8');
const match = source.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);
if (!match) throw new Error('Template do CRM não encontrado');
let template = JSON.parse(match[2]);

const oldCatch = "}catch(error){this.cleanupAudioRecorder();this.fireToast(error?.name==='NotAllowedError'?'Permita o uso do microfone para gravar':'Não foi possível acessar o microfone');}";
const oldCatchBroken = "}catch(error){this.cleanupAudioRecorder();this.fireToast(error?.name==='NotAllowedError'?'Permita o uso do microfone para gravar':'NÃ£o foi possÃ­vel acessar o microfone');}";
const newCatch = `}catch(error){
      this.cleanupAudioRecorder();
      const messages={NotAllowedError:'Microfone bloqueado. Clique no cadeado da barra de endereço, permita o microfone e recarregue a página.',NotFoundError:'Nenhum microfone foi encontrado neste computador.',NotReadableError:'O microfone está ocupado por outro aplicativo. Feche-o e tente novamente.',SecurityError:'A gravação exige uma conexão HTTPS segura.'};
      this.fireToast(messages[error?.name]||('Não foi possível acessar o microfone'+(error?.message?': '+error.message:'')));
    }`;
if (template.includes(oldCatch)) template = template.replace(oldCatch, newCatch);
else if (template.includes(oldCatchBroken)) template = template.replace(oldCatchBroken, newCatch);
else if (!template.includes('Microfone bloqueado. Clique no cadeado')) throw new Error('Trecho do microfone não encontrado');

const serialized = JSON.stringify(template).replaceAll('</script>', '<\\/script>');
fs.writeFileSync(file, source.replace(match[0], match[1] + serialized + match[3]));
console.log('crm-audio-feedback-updated');
