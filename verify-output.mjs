import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

function clean(v) {
  return String(v ?? "").replace(/\s*\(Compromisso\)\s*$/i, "").replace(/\s+/g, " ").trim();
}
function key(v) {
  return clean(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[.]+$/g, "").replace(/\s+/g, " ").trim();
}
function time(v) {
  if (v instanceof Date) return v.valueOf();
  if (typeof v === "number") return Date.UTC(1899, 11, 30 + v);
  const m = String(v ?? "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  const parsed = Date.parse(String(v ?? ""));
  return Number.isNaN(parsed) ? NaN : parsed;
}

const file = "outputs/pacientes-ultima-consulta/Listagem Dulce - Ultima Consulta por Paciente.xlsx";
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(file));
const original = wb.worksheets.getItem("Dados Originais").getUsedRange().values.slice(1);
const result = wb.worksheets.getItem("Pacientes - Última Data").getUsedRange().values.slice(1);
const expected = new Map();
for (const row of original) {
  const k = key(row[1]);
  const t = time(row[0]);
  if (!k || Number.isNaN(t)) continue;
  if (!expected.has(k) || t > expected.get(k)) expected.set(k, t);
}
const seen = new Set();
let duplicateKeys = 0;
let wrongLatestDate = 0;
for (const row of result) {
  const k = key(row[1]);
  if (seen.has(k)) duplicateKeys++;
  seen.add(k);
  if (time(row[0]) !== expected.get(k)) wrongLatestDate++;
}
console.log(JSON.stringify({ resultRows: result.length, expectedRows: expected.size, duplicateKeys, wrongLatestDate, sheets: 2 }));
