import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const source = "Listagem 2026 Dulce.xlsx";
const outputDir = path.join("outputs", "pacientes-ultima-consulta");
const outputPath = path.join(outputDir, "Listagem Dulce - Ultima Consulta por Paciente.xlsx");

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
  if (typeof value === "number") return new Date(Date.UTC(1899, 11, 30 + value));
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
}

function cleanPatient(value) {
  return String(value ?? "")
    .replace(/\s*\(Compromisso\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function patientKey(value) {
  return cleanPatient(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const original = workbook.worksheets.getItemAt(0);
original.name = "Dados Originais";
const values = original.getUsedRange().values;
const rows = values.slice(1);
const latest = new Map();
let blankPatients = 0;
let invalidDates = 0;

for (let i = 0; i < rows.length; i++) {
  const [rawDate, rawPatient, professional] = rows[i];
  const patient = cleanPatient(rawPatient);
  if (!patient) { blankPatients++; continue; }
  const date = parseDate(rawDate);
  if (!date) { invalidDates++; continue; }
  const key = patientKey(patient);
  if (!key) { blankPatients++; continue; }
  const current = latest.get(key);
  if (!current || date.valueOf() > current.date.valueOf()) {
    latest.set(key, { date, patient, professional: String(professional ?? "").trim(), sourceRow: i + 2 });
  }
}

const consolidatedRows = [...latest.values()].sort((a, b) =>
  a.patient.localeCompare(b.patient, "pt-BR", { sensitivity: "base" }) || b.date - a.date
);

const sheet = workbook.worksheets.add("Pacientes - Última Data");
sheet.showGridLines = false;
sheet.getRange("A1:C1").values = [["Última consulta", "Paciente", "Profissional"]];
if (consolidatedRows.length) {
  sheet.getRangeByIndexes(1, 0, consolidatedRows.length, 3).values = consolidatedRows.map(r => [r.date, r.patient, r.professional]);
}

const lastRow = consolidatedRows.length + 1;
const fullRange = sheet.getRange(`A1:C${lastRow}`);
fullRange.format.font = { name: "Aptos", size: 11, color: "#243047" };
sheet.getRange("A1:C1").format = {
  fill: "#1F4E78",
  font: { name: "Aptos", size: 11, bold: true, color: "#FFFFFF" },
  rowHeight: 26,
  verticalAlignment: "center",
};
sheet.getRange(`A2:A${lastRow}`).format.numberFormat = "dd/mm/yyyy";
sheet.getRange(`A2:A${lastRow}`).format.horizontalAlignment = "center";
sheet.getRange(`A2:C${lastRow}`).format.borders = {
  insideHorizontal: { style: "thin", color: "#D9E2F3" },
  bottom: { style: "thin", color: "#D9E2F3" },
};
sheet.getRange(`A2:C${lastRow}`).format.rowHeight = 20;
sheet.getRange(`A1:A${lastRow}`).format.columnWidth = 18;
sheet.getRange(`B1:B${lastRow}`).format.columnWidth = 64;
sheet.getRange(`C1:C${lastRow}`).format.columnWidth = 24;
sheet.getRange(`B2:C${lastRow}`).format.wrapText = false;
sheet.freezePanes.freezeRows(1);
const table = sheet.tables.add(`A1:C${lastRow}`, true, "PacientesUltimaData");
table.style = "TableStyleMedium2";
table.showFilterButton = true;

await fs.mkdir(outputDir, { recursive: true });
const preview = await workbook.render({ sheetName: sheet.name, range: `A1:C${Math.min(lastRow, 45)}`, scale: 1.5, format: "png" });
await fs.writeFile(path.join(outputDir, "preview.png"), new Uint8Array(await preview.arrayBuffer()));

const inspected = await workbook.inspect({
  kind: "table",
  sheetId: sheet.name,
  range: `A1:C${Math.min(lastRow, 15)}`,
  include: "values,formulas",
  tableMaxRows: 15,
  tableMaxCols: 3,
  maxChars: 5000,
});
console.log(inspected.ndjson);
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(outputPath);
console.log(JSON.stringify({
  sourceRows: rows.length,
  uniquePatients: consolidatedRows.length,
  duplicatesRemoved: rows.length - blankPatients - invalidDates - consolidatedRows.length,
  blankPatients,
  invalidDates,
  outputPath,
}));
