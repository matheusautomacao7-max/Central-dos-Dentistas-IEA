import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const adminScript = await readFile(new URL("../app/public/admin.js", import.meta.url), "utf8");
const adminHtml = await readFile(new URL("../app/public/admin.html", import.meta.url), "utf8");

assert.match(
  adminScript,
  /\$\("#validateAppointments"\)\.disabled = !data\.consolidated/,
  "valid consolidated patients must remain eligible for validation when other spreadsheet rows are ignored",
);
assert.doesNotMatch(
  adminScript,
  /\$\("#validateAppointments"\)\.disabled = data\.errors\.length > 0 \|\| !data\.consolidated/,
  "ignored or review-only rows must not block the valid import batch",
);
assert.match(
  adminScript,
  /Itens ignorados \(não serão importados\)/,
  "the audit result must explain that rejected operational rows stay outside the import",
);
assert.match(
  adminHtml,
  /admin\.js\?v=20260805-future-appointments-v3/,
  "the admin page must load the fixed script through a fresh cache key",
);
assert.match(adminScript, /3\. Importar somente cadastrados/);
assert.match(adminScript, /allow_partial: allowPartial/);
assert.match(adminScript, /data\.can_confirm_partial === true/);

const serverScript = await readFile(new URL("../app/server.py", import.meta.url), "utf8");
assert.match(serverScript, /"can_confirm_partial": bool\(missing\) and valid > 0/);
assert.match(serverScript, /allow_partial = payload\.get\("allow_partial"\) is True/);
assert.match(serverScript, /importable_items = \[item for item in items/);
assert.match(serverScript, /is_future_appointment = item\["date"\] > today/);
assert.match(serverScript, /next_appointment_type='Programado'/);
assert.match(serverScript, /Próxima consulta programada pela planilha/);
assert.match(adminScript, /próximas consultas programadas/);

console.log("admin-appointment-import-regression-ok");
