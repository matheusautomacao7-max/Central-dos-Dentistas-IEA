import assert from "node:assert/strict";
import http from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";


const bridge = await readFile(new URL("../app/public/crm-media-bridge.js", import.meta.url), "utf8");

function wavTone(durationSeconds = 1, sampleRate = 8000) {
  const sampleCount = Math.floor(durationSeconds * sampleRate);
  const dataSize = sampleCount * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 6000);
    wav.writeInt16LE(sample, 44 + index * 2);
  }
  return wav;
}

const audio = wavTone();
let rangeRequests = 0;
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  if (url.pathname === "/crm-media-bridge.js") {
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    return response.end(bridge);
  }
  if (url.pathname === "/api/crm/conversations/1/messages") {
    response.writeHead(200, { "Content-Type": "application/json" });
    return response.end(JSON.stringify({ items: [{
      id: 91,
      message_type: "audio",
      media_url: "/api/crm/media/test.wav",
      direction: "outbound",
      sender_name: "Atendente Teste",
      message_at: "2026-08-03T12:00:00",
    }] }));
  }
  if (url.pathname === "/api/crm/media/test.wav") {
    const range = request.headers.range;
    const headers = {
      "Content-Type": "audio/wav",
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    };
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      const start = Number(match?.[1] || 0);
      const end = Math.min(Number(match?.[2] || audio.length - 1), audio.length - 1);
      rangeRequests += 1;
      response.writeHead(206, {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${audio.length}`,
        "Content-Length": end - start + 1,
      });
      return response.end(audio.subarray(start, end + 1));
    }
    response.writeHead(200, { ...headers, "Content-Length": audio.length });
    return response.end(audio);
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html><body style="margin:0">
    <main style="width:900px;height:650px;display:flex;flex-direction:column">
      <section id="timeline" style="height:560px;width:900px;overflow:auto">
        <div style="display:flex;justify-content:flex-end;width:100%">
          <div class="existing-bubble" style="width:280px;height:80px;margin-left:auto">
            <div style="width:30px;height:10px;margin-left:auto"><span>12:00</span></div>
          </div>
        </div>
      </section>
      <div style="height:90px"><input placeholder="Digite uma mensagem" style="width:700px;height:40px"></div>
    </main>
    <script src="/crm-media-bridge.js"></script>
    <script>fetch('/api/crm/conversations/1/messages');</script>
  </body></html>`);
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const installedBrowsers = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = installedBrowsers.find(path => existsSync(path));
const browser = await chromium.launch({
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
  ...(executablePath ? { executablePath } : {}),
});

try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/`);
  const player = page.locator(".existing-bubble audio");
  await player.waitFor();
  await page.waitForFunction(() => {
    const audioElement = document.querySelector(".existing-bubble audio");
    return audioElement && Number.isFinite(audioElement.duration) && audioElement.duration > 0;
  });
  const playback = await player.evaluate(async element => {
    let playing = false;
    element.addEventListener("playing", () => { playing = true; }, { once: true });
    await element.play();
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      playing,
      paused: element.paused,
      currentTime: element.currentTime,
      duration: element.duration,
      readyState: element.readyState,
      error: element.error?.message || "",
    };
  });
  assert.equal(
    playback.playing && !playback.paused && playback.readyState >= 3,
    true,
    `o navegador precisa decodificar e entrar em reprodução: ${JSON.stringify(playback)}`
  );
  assert.ok(rangeRequests > 0, "o navegador precisa conseguir solicitar trechos do áudio");
  assert.deepEqual(pageErrors, [], "a hidratação do player não pode lançar erro de insertBefore");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log("crm-audio-real-playback-regression-ok");
