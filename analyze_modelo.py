import json
import pandas as pd

path = r"C:\Users\adm.note\Downloads\MODELO.xlsx"
xls = pd.ExcelFile(path)
result = {"sheets": xls.sheet_names, "details": {}}

for sheet in xls.sheet_names:
    df = pd.read_excel(path, sheet_name=sheet, dtype=object)
    detail = {
        "rows": int(len(df)),
        "columns": [str(c) for c in df.columns],
        "non_empty": {str(c): int(df[c].notna().sum()) for c in df.columns},
        "unique_samples": {},
    }
    for c in df.columns:
        values = (
            df[c]
            .dropna()
            .astype(str)
            .str.strip()
        )
        unique = values[values.ne("")].value_counts().head(40)
        detail["unique_samples"][str(c)] = [
            {"value": str(k), "count": int(v)} for k, v in unique.items()
        ]
    result["details"][sheet] = detail

with open(r"tmp\modelo_inspection\analysis.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(json.dumps(result, ensure_ascii=True, indent=2))
