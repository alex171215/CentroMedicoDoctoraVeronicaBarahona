import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('btn--accent', 'btn--accion')
content = content.replace('btn--main', 'btn--accion')
content = content.replace('btn--action', 'btn--primario')
content = content.replace('btn--outline-action', 'btn--secundario')
content = content.replace('btn--outline', 'btn--secundario')
content = content.replace('btn-comprobante btn-comprobante--volver', 'btn btn--primario')
content = content.replace('btn-comprobante btn-comprobante--pdf', 'btn btn--secundario')
content = content.replace('btn-comprobante btn-comprobante--imprimir', 'btn btn--secundario')

# Replace inline styles for colors
content = re.sub(r'background-color:\s*#[a-fA-F0-9]+;\s*border-color:\s*#[a-fA-F0-9]+;', '', content)
content = content.replace('class="login-register-link__a"', 'class="enlace-accion"')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
