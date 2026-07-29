import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/adm.note/Downloads/MODELO.xlsx";
const outputDir = "tmp/modelo_inspection";

await fs.mkdir(outputDir, { recursive: true });
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = await workbook.inspect({
  kind: "workbook,sheet,table,region,definedName,drawing",
  maxChars: 18000,
  tableMaxRows: 30,
  tableMaxCols: 20,
  tableMaxCellChars: 180,
});
await fs.writeFile(`${outputDir}/summary.ndjson`, summary.ndjson, "utf8");

const sheetRecords = [];
for (let index = 0; index < workbook.worksheets.getSheetCount(); index += 1) {
  const sheet = workbook.worksheets.getItemAt(index);
  const sheetName = sheet.name;
  sheetRecords.push({ index, name: sheetName, usedRange: sheet.getUsedRange()?.address ?? null });
  const safe = sheetName.replace(/[<>:"/\\|?*]/g, "_");
  const detail = await workbook.inspect({
    kind: "region,table,formula",
    sheetId: sheetName,
    range: "A1:Z80",
    maxChars: 18000,
    tableMaxRows: 80,
    tableMaxCols: 26,
    tableMaxCellChars: 240,
    options: { maxResults: 300 },
  });
  await fs.writeFile(`${outputDir}/${safe}.ndjson`, detail.ndjson, "utf8");
  const preview = await workbook.render({
    sheetName,
    range: "A1:L60",
    scale: 1,
    format: "png",
  });
  await fs.writeFile(`${outputDir}/${safe}.png`, new Uint8Array(await preview.arrayBuffer()));
}
await fs.writeFile(`${outputDir}/sheets.json`, JSON.stringify(sheetRecords, null, 2), "utf8");

console.log(summary.ndjson);
