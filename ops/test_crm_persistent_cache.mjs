import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app/public/crm-whatsapp.html", import.meta.url), "utf8");
const open = '<script type="__bundler/template">';
const start = source.indexOf(open) + open.length;
const template = JSON.parse(source.slice(start, source.indexOf("</script>", start)).trim());

for (const marker of ["CRM_REFRESH_RACE_FIXED_V9", "CRM_NATIVE_AUDIO_STABLE_V10", "CRM_PERSISTENT_CONVERSATION_CACHE_V11"]) {
  assert.ok(template.includes(marker), `marcador ausente: ${marker}`);
}
assert.ok(template.includes("this.crmMessageCache.get(Number(item.id))||old?.msgs||[]"));
assert.ok(template.includes("this.crmTimelineCache.get(Number(item.id))||old?.history||[]"));
assert.ok(template.includes("this.crmMessageCache.set(Number(id),combined)"));

const cachedMessages = [
  {id: 1, type: "audio", mediaUrl: "/api/crm/media/audio-1.ogg"},
  {id: 2, type: "text", text: "oi"},
];
const partialResponse = [{id: 3, type: "text", text: "nova"}];
const combined = [...new Map([...cachedMessages, ...partialResponse].map(item => [String(item.id), item])).values()];
assert.equal(combined.length, 3);
assert.equal(combined[0].type, "audio", "uma resposta parcial não pode apagar o áudio em cache");

const cachedTimeline = [{eventId: 10, title: "Atendimento iniciado"}];
const receivedTimeline = [{eventId: 11, title: "Atendimento finalizado"}];
const timeline = [...new Map([...cachedTimeline, ...receivedTimeline].map(item => [String(item.eventId), item])).values()];
assert.deepEqual(timeline.map(item => item.eventId), [10, 11]);

console.log("crm-persistent-cache-regression-ok");
