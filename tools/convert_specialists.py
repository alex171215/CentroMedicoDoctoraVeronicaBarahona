import re
import json
from pathlib import Path

path = Path('scaled_specialists_output.md')
text = path.read_text(encoding='utf-8')

# Split SQL section and JSON fragment
parts = text.split('--- JSON FRAGMENT ---')
if len(parts) != 2:
    raise SystemExit('Unexpected file format: no JSON FRAGMENT marker')

sql_text = parts[0]
json_text = parts[1]

insert_re = re.compile(r"INSERT INTO especialistas \(([^)]+)\) VALUES \((.+?)\);", re.DOTALL)

def split_values(s):
    vals = []
    cur = ''
    in_quote = False
    escape = False
    depth = 0
    for ch in s:
        if in_quote:
            if escape:
                cur += ch
                escape = False
            elif ch == '\\':
                cur += ch
                escape = True
            elif ch == "'":
                in_quote = False
                cur += ch
            else:
                cur += ch
        else:
            if ch == "'":
                in_quote = True
                cur += ch
            elif ch == '(':
                depth += 1
                cur += ch
            elif ch == ')':
                depth -= 1
                cur += ch
            elif ch == ',' and depth == 0:
                vals.append(cur.strip())
                cur = ''
            else:
                cur += ch
    if cur.strip():
        vals.append(cur.strip())
    return vals


def parse_doctor_nombre_completo(value):
    if value.endswith('::jsonb'):
        quoted = value[:-7].strip()
    else:
        quoted = value
    if quoted.startswith("'") and quoted.endswith("'"):
        inner = quoted[1:-1]
        inner = inner.replace("\\'", "'")
    else:
        inner = quoted
    try:
        obj = json.loads(inner)
    except json.JSONDecodeError as e:
        raise ValueError(f'Failed JSON parse doctor: {inner[:80]}...')
    return obj.get('nombre_completo', '')


def transform_insert(match):
    cols = [c.strip() for c in match.group(1).split(',')]
    values = split_values(match.group(2))
    if cols == ['id', 'especialidad', 'duracion_minutos', 'horarios_atencion', 'doctor', 'actividades']:
        id_val, esp_val, dur_val, horarios_val, doctor_val, actividades_val = values
        nombre_completo = parse_doctor_nombre_completo(doctor_val)
        nombre_val = "'" + nombre_completo.replace("'", "''") + "'"
        new_cols = 'id_especialista, especialidad, nombre_completo, duracion_minutos, horarios_atencion, actividades'
        new_vals = ', '.join([id_val, esp_val, nombre_val, dur_val, horarios_val, actividades_val])
        return f'INSERT INTO especialistas ({new_cols}) VALUES ({new_vals});'
    return match.group(0)

new_sql = insert_re.sub(transform_insert, sql_text)

json_fragment = json_text.strip()
try:
    data = json.loads(json_fragment)
    if isinstance(data, list):
        new_data = []
        for item in data:
            if 'doctor' in item:
                item['nombre_completo'] = item['doctor'].get('nombre_completo', item.get('nombre_completo', ''))
                item.pop('doctor', None)
            if 'id' in item and 'id_especialista' not in item:
                item['id_especialista'] = item.pop('id')
            new_data.append(item)
        new_json = json.dumps(new_data, ensure_ascii=False, indent=4)
    else:
        raise ValueError('JSON fragment is not a list')
except Exception as e:
    print('Warning: could not parse JSON fragment, leaving it unchanged:', e)
    new_json = json_fragment

new_text = new_sql.strip() + '\n\n--- JSON FRAGMENT ---\n' + new_json + '\n'
path.write_text(new_text, encoding='utf-8')
print('updated', path)
