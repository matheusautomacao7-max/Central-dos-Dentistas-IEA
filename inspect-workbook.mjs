import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const source = "Listagem 2026 Dulce.xlsx";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const summary = await workbook.inspect({
  kind: "workbook,sheet,table,region",
  maxChars: 12000,
  tableMaxRows: 15,
  tableMaxCols: 12,
  tableMaxCellChars: 120,
});
console.log(summary.ndjson);

const sheets = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 3000 });
console.log(sheets.ndjson);

const first = workbook.worksheets.getItemAt(0);
const used = first.getUsedRange();
console.log(JSON.stringify({ firstSheet: first.name, usedAddress: used?.address ?? null }));

await fs.mkdir("qa", { recursive: true });
const preview = await workbook.render({ sheetName: first.name, autoCrop: "all", scale: 1, format: "png" });
await fs.writeFile("qa/original.png", new Uint8Array(await preview.arrayBuffer()));
