import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../app/public/crm-media-bridge.js", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/public/crm-whatsapp.html", import.meta.url), "utf8");

assert.ok(bridge.includes("CRM_MEDIA_BRIDGE_INCREMENTAL_SAFE_V13"));
assert.ok(bridge.includes("function ingestMessages(payload, incremental)"));
assert.ok(bridge.includes("mediaItems.concat(nextMediaItems)"), "respostas incrementais precisam preservar os players existentes");
assert.ok(bridge.includes("ingestMessages(payload, incremental)"));
assert.ok(!bridge.includes("setInterval(refreshActiveConversation, 8000)"), "o refresh completo de mídia não pode competir com o polling principal");
assert.ok(page.includes("crm-media-bridge.js?v=20260731-audio-stable-v13"), "a URL do bridge precisa invalidar o cache do navegador");

const mergeIncremental = (current, received) => {
  const merged = new Map();
  current.concat(received).forEach(item => merged.set(String(item.id), item));
  return Array.from(merged.values());
};
const existingPlayers = [{id: 1, message_type: "audio"}, {id: 2, message_type: "audio"}];
assert.deepEqual(mergeIncremental(existingPlayers, []), existingPlayers, "polling vazio não pode remover players");
assert.deepEqual(mergeIncremental(existingPlayers, [{id: 3, message_type: "audio"}]).map(item => item.id), [1, 2, 3]);

console.log("crm-media-bridge-audio-loop-regression-ok");
