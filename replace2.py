import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the span for Cancelar Registro
content = content.replace('<span onclick="app.registro.cancelarRegistro()">Cancelar Registro</span>',
                          '<span onclick="app.registro.cancelarRegistro()" class="enlace-accion">Cancelar Registro</span>')

# Fix "Cancelar" in mi-perfil
content = content.replace('<span onclick="app.navegar(\'home\'); app.perfil.abrirModal()">Cancelar</span>',
                          '<span onclick="app.navegar(\'home\'); app.perfil.abrirModal()" class="enlace-accion">Cancelar</span>')

# Fix the Siguiente in Citas from btn--primario to btn--accion
content = content.replace('id="btn-citas-siguiente" class="btn btn--primario"',
                          'id="btn-citas-siguiente" class="btn btn--accion"')

# Fix inline styles (if any) missed by the regex
content = re.sub(r'style="([^"]*)background-color:\s*#[a-fA-F0-9]+;\s*border-color:\s*#[a-fA-F0-9]+;([^"]*)"',
                 r'style="\1\2"', content)
                 
# Fix 'style="background-color: #0DA99F; border-color: #0DA99F; opacity: 1;' etc. 
# Because my previous regex was strict. Let's do a more robust one to strip color overrides.
content = re.sub(r'background-color:\s*#[0-9a-fA-F]{3,6};\s*border-color:\s*#[0-9a-fA-F]{3,6};?\s*', '', content)
content = re.sub(r'color:\s*#[0-9a-fA-F]{3,6};\s*', '', content)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
