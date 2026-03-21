import csv
import json
import os
import re

base_dir = '/Users/nt718/learning/language'
output_dir = os.path.join(base_dir, 'flashcard-app/src/data')
os.makedirs(output_dir, exist_ok=True)

CSV_FILES = {
    'en': os.path.join(base_dir, 'memo2_en.csv'),
    'zh': os.path.join(base_dir, 'memo2_zh.csv'),
}

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9\u4e00-\u9fff\u3040-\u30ff]+', '_', text)
    return text.strip('_')[:40]

materials_manifest = []

for lang, csv_path in CSV_FILES.items():
    sections = {}  # section_name -> list of entries

    with open(csv_path, encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            jp      = row.get('Japanese', '').strip()
            en      = row.get('English', '').strip()
            cn      = row.get('Chinese', '').strip()
            pinyin  = row.get('Pinyin', '').strip()
            section = row.get('Section', '').strip()
            point   = row.get('Point', '').strip()

            if not jp or not (en or cn):
                continue

            entry = {"jp": jp}
            if en:      entry["en"]     = en
            if cn:      entry["cn"]     = cn
            if pinyin:  entry["pinyin"] = pinyin
            if section: entry["grammar"] = section
            if point:   entry["notes"]   = point

            sections.setdefault(section, []).append(entry)

    for idx, (section_name, entries) in enumerate(sections.items(), start=1):
        slug = f"memo2_{lang}_s{idx:02d}"
        json_filename = f"{slug}.json"
        json_path = os.path.join(output_dir, json_filename)

        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(entries, f, ensure_ascii=False, indent=2)

        lang_label = 'English' if lang == 'en' else 'Chinese'
        materials_manifest.append({
            "id":    slug,
            "name":  f"{section_name} ({lang_label})",
            "path":  f"./{json_filename}",
            "count": len(entries),
        })

        print(f"  {json_filename}: {len(entries)} sentences")

# Sort: group by section index, then lang
def sort_key(m):
    match = re.search(r's(\d+)$', m['id'])
    num = int(match.group(1)) if match else 0
    lang = 0 if '_en_' in m['id'] else 1
    return (num, lang)

materials_manifest.sort(key=sort_key)

with open(os.path.join(output_dir, 'materials.json'), 'w', encoding='utf-8') as f:
    json.dump(materials_manifest, f, ensure_ascii=False, indent=2)

print(f"\nDone: {len(materials_manifest)} materials written to materials.json")
