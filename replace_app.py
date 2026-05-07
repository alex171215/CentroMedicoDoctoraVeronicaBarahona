import re

with open('js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace classes in HTML strings in app.js
content = content.replace('btn--action', 'btn--primario')
content = content.replace('btn--outline-action', 'btn--secundario')
content = content.replace('btn--primary', 'btn--primario')
content = content.replace('btn--outline', 'btn--secundario')
content = content.replace('btn--danger', 'btn--peligro')
content = content.replace('btn--outline-main', 'btn--secundario')

# Replace inline styles for colors in app.js
content = re.sub(r'style="([^"]*)background-color:\s*#[a-fA-F0-9]+;\s*border-color:\s*#[a-fA-F0-9]+;([^"]*)"', r'style="\1\2"', content)
content = re.sub(r'style="([^"]*)background-color:\s*var\(--status-red,\s*#[a-fA-F0-9]+\);\s*border-color:\s*var\(--status-red,\s*#[a-fA-F0-9]+\);([^"]*)"', r'style="\1\2"', content)

with open('js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
