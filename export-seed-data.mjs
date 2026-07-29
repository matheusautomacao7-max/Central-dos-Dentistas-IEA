import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const source = "outputs/pacientes-ultima-consulta/Listagem Dulce - Ultima Consulta por Paciente.xlsx";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const sheet = workbook.worksheets.getItem("Pacientes - Última Data");
const rows = sheet.getUsedRange().values.slice(1);

function isoDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return new Date(Date.UTC(1899, 11, 30 + value)).toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10);
}

const patients = rows.map(([lastVisit, name, professional], index) => ({
  external_id: index + 1,
  name: String(name ?? "").trim(),
  last_visit: isoDate(lastVisit),
  professional: String(professional ?? "").trim() || "Dra. Dulce",
  status: /\(inativo\)/i.test(String(name ?? "")) ? "Inativo" : "Consulta",
  next_appointment: null,
  procedure: null,
  reference: null,
  phone: null,
  last_contact: null,
  next_action: null,
  notes: null,
}));

await fs.mkdir("app/data", { recursive: true });
await fs.writeFile("app/data/patients.seed.json", JSON.stringify(patients, null, 2), "utf8");
console.log(JSON.stringify({ exported: patients.length }));
