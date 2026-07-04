import json
import sys
import pandas as pd

# Ensure stdout/stderr handle UTF-8 correctly on Windows
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    pass

json_file = "dictation_data.json"
excel_file = "dictation_data.xlsx"

print(f"Loading {json_file}...")
with open(json_file, 'r', encoding='utf-8') as f:
    all_data = json.load(f)

print(f"Converting JSON to Excel: {excel_file}...")

# Create an Excel writer
with pd.ExcelWriter(excel_file, engine='openpyxl') as writer:
    for sheet_name, items in all_data.items():
        if not items:
            continue
            
        # Convert list of dicts to DataFrame
        df = pd.DataFrame(items)
        
        # Reorder columns if they exist
        column_order = ['unit', 'zh', 'pinyin', 'vi', 'viPlus', 'type']
        # Filter columns to only include those present in the df
        cols_to_use = [col for col in column_order if col in df.columns]
        # Include any extra columns not in our preferred order
        cols_to_use += [col for col in df.columns if col not in cols_to_use]
        
        df = df[cols_to_use]
        
        # Rename columns to friendly Vietnamese names
        rename_map = {
            'unit': 'Bài học (Unit)',
            'zh': 'Chữ Hán (zh)',
            'pinyin': 'Pinyin',
            'vi': 'Nghĩa Tiếng Việt (vi)',
            'viPlus': 'Nghĩa bổ sung (viPlus)',
            'type': 'Loại bài học (type)'
        }
        df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})
        
        # Sanitize sheet name length (Excel limit is 31 chars)
        safe_sheet_name = sheet_name[:31]
        
        # Write to sheet
        df.to_excel(writer, sheet_name=safe_sheet_name, index=False)

print("SUCCESS: Excel workbook created successfully!")
