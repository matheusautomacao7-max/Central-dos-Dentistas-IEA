import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../app/public/crm-media-bridge.js", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/public/crm-whatsapp.html", import.meta.url), "utf8");

assert.ok(bridge.includes("CRM_MEDIA_BRIDGE_AUDIO_DISABLED_V12"));
assert.ok(bridge.includes('type !== "audio"'), "o bridge legado não pode manipular players de áudio");
assert.ok(!bridge.includes("setInterval(refreshActiveConversation, 8000)"), "o refresh completo de mídia não pode competir com o polling principal");
assert.ok(page.includes("crm-media-bridge.js?v=20260731-audio-loop-v12"), "a URL do bridge precisa invalidar o cache do navegador");

console.log("crm-media-bridge-audio-loop-regression-ok");
