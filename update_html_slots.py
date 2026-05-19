import os
import glob

# Find all HTML files in the current directory
html_files = glob.glob('*.html')

target = '<div id="header-auth-slot" class="header__auth-slot"></div>'
replacement = '<button id="btn-auth-mobile" class="auth-avatar-btn" aria-label="Menú de perfil móvil" style="display: none;"></button>'
# Wait, the prompt says "Inyecta el botón para móviles directamente en la barra visible principal de la cabecera (junto al botón de menú hamburguesa):
# <button id="btn-auth-mobile" class="auth-avatar-btn" aria-label="Menú de perfil móvil"></button>"

replacement = '<button id="btn-auth-mobile" class="auth-avatar-btn" aria-label="Menú de perfil móvil"></button>'

count = 0
for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if target in content:
        content = content.replace(target, replacement)
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        count += 1

print(f"Updated {count} HTML files.")
