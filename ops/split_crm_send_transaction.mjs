import fs from "node:fs";

const file = new URL("../app/server.py", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const marker = "CRM_OUTBOUND_SHORT_TRANSACTIONS_V1";
if (source.includes(marker)) {
  console.log("Transações de envio já separadas.");
  process.exit(0);
}

const start = source.indexOf("    def send_crm_message(");
const end = source.indexOf("\n    def update_crm_contact(", start);
if (start < 0 || end < 0) throw new Error("Função send_crm_message não encontrada.");
let fn = source.slice(start, end);

const credentials = "            configured_url, configured_key = self.evolution_credentials()";
if (!fn.includes(credentials)) throw new Error("Fronteira de credenciais não encontrada.");
fn = fn.replace(
  credentials,
  `            row = dict(row)\n${credentials}  # ${marker}`,
);

const networkStart = fn.indexOf(credentials);
const persistenceStart = fn.indexOf("            message_id=db.execute", networkStart);
if (networkStart < 0 || persistenceStart < 0) throw new Error("Fronteira de persistência não encontrada.");
const networkBlock = fn.slice(networkStart, persistenceStart)
  .split("\n")
  .map(line => line.startsWith("    ") ? line.slice(4) : line)
  .join("\n");
fn = fn.slice(0, networkStart) + networkBlock + fn.slice(persistenceStart);

function replaceExact(before, after, label) {
  if (!fn.includes(before)) throw new Error(`Trecho não encontrado: ${label}`);
  fn = fn.replace(before, after);
}

replaceExact(
  `            db.execute("UPDATE crm_channels SET connection_status='Desconectado',updated_at=datetime('now','localtime') WHERE id=?", (row["channel_id"],))`,
  `            with connect() as status_db:\n                status_db.execute("UPDATE crm_channels SET connection_status='Desconectado',updated_at=datetime('now','localtime') WHERE id=?", (row["channel_id"],))`,
  "status desconectado",
);
replaceExact(
  `        db.execute("UPDATE crm_channels SET connection_status='Conectado',updated_at=datetime('now','localtime') WHERE id=?", (row["channel_id"],))`,
  `        with connect() as status_db:\n            status_db.execute("UPDATE crm_channels SET connection_status='Conectado',updated_at=datetime('now','localtime') WHERE id=?", (row["channel_id"],))`,
  "status conectado",
);
replaceExact(
  `                db.execute("UPDATE crm_channels SET connection_status='Desconectado',updated_at=datetime('now','localtime') WHERE id=?", (row["channel_id"],))`,
  `                with connect() as status_db:\n                    status_db.execute("UPDATE crm_channels SET connection_status='Desconectado',updated_at=datetime('now','localtime') WHERE id=?", (row["channel_id"],))`,
  "falha ConnectionClosed",
);

fn = fn.replace(
  "            message_id=db.execute",
  "        with connect() as db:\n            message_id=db.execute",
);

fs.writeFileSync(file, source.slice(0, start) + fn + source.slice(end), "utf8");
console.log("Envio CRM separado em transações curtas.");
