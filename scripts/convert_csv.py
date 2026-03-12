import csv
import json
import os
import glob

base_dir = '/Users/nt718/learning/language'
output_dir = os.path.join(base_dir, 'flashcard-app/src/data')
os.makedirs(output_dir, exist_ok=True)

csv_files = glob.glob(os.path.join(base_dir, '*.csv'))
materials_manifest = []

for csv_path in csv_files:
    file_name = os.path.basename(csv_path)
    material_name = file_name.replace('.csv', '').replace(' - master', '')
    safe_name = material_name.lower().replace(' ', '_')
    json_filename = f"{safe_name}.json"
    json_path = os.path.join(output_dir, json_filename)
    
    sentences = []
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            jp = row.get('Japanese')
            en = row.get('English')
            cn = row.get('Chinese')
            grammar = row.get('Grammar')
            point = row.get('Point')
            pinyin = row.get('Pinyin')
            
            if not jp or not (en or cn):
                continue
            if jp == en or '〜' in jp:
                continue
                
            entry = {
                "jp": jp,
                "en": en,
                "cn": cn,
                "pinyin": pinyin,
                "grammar": grammar,
                "notes": point,
            }
            entry = {k: v for k, v in entry.items() if v}
            sentences.append(entry)
    
    chunk_size = 20
    for i in range(0, len(sentences), chunk_size):
        chunk = sentences[i:i + chunk_size]
        start_idx = i + 1
        end_idx = i + len(chunk)
        
        chunk_json_filename = f"{safe_name}_{start_idx}_{end_idx}.json"
        chunk_json_path = os.path.join(output_dir, chunk_json_filename)
        
        with open(chunk_json_path, mode='w', encoding='utf-8') as f:
            json.dump(chunk, f, ensure_ascii=False, indent=2)
        
        # Determine grammar themes for the chunk if possible
        grammars = list(dict.fromkeys([s.get('grammar', '') for s in chunk if s.get('grammar')]))
        grammar_label = f" ({', '.join(grammars[:2])}{'...' if len(grammars) > 2 else ''})" if grammars else ""
        
        materials_manifest.append({
            "id": f"{safe_name}_{start_idx}_{end_idx}",
            "name": f"{material_name} {start_idx}-{end_idx}{grammar_label}",
            "path": f"./{chunk_json_filename}",
            "count": len(chunk)
        })

    
# Sort materials by name to ensure consistent order in UI
# Since names are like "瞬間作文_1000文 1-20", sorting by name is tricky for numeric parts.
# Let's sort based on the start index embedded in the id instead.
import re
def extract_start_idx(material_id):
    match = re.search(r'_(\d+)_\d+$', material_id)
    return int(match.group(1)) if match else 0

materials_manifest.sort(key=lambda x: extract_start_idx(x['id']))

with open(os.path.join(output_dir, 'materials.json'), mode='w', encoding='utf-8') as f:
    json.dump(materials_manifest, f, ensure_ascii=False, indent=2)

print(f"Processed {len(materials_manifest)} materials with supplementary notes support.")
