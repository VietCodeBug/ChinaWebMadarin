import json

json_file = "dictation_data.json"
js_file = "dictation_data.js"

print(f"Loading {json_file}...")
with open(json_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Writing to {js_file}...")
with open(js_file, 'w', encoding='utf-8') as f:
    f.write("window.DICTATION_DATA = ")
    # Write JSON in compact format
    json.dump(data, f, ensure_ascii=False)
    f.write(";\n")

print("SUCCESS: Data converted to JS module format!")
