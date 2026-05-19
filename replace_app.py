import os
import re

html_files = [f for f in os.listdir('.') if f.endswith('.html')]

# 1. Add nav link
nav_link_addition = '\n                        <li class="header__nav-item" id="nav-login-item"><a href="login.html" id="nav-login-link" class="header__nav-link">Iniciar Sesión</a></li>'

# 2. Inject Modal at the end of body
modal_html = """
    <!-- Modal Cerrar Sesión -->
    <div id="modal-logout" class="modal-overlay" style="display: none;">
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-header__title">Cerrar Sesión</h3>
            </div>
            <div class="modal-body">
                <p style="text-align: center; margin-top: 10px;">¿Estás seguro de que deseas cerrar tu sesión actual?</p>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn--secundario modal-cerrar" onclick="app.cerrarModalLogout()">Cancelar</button>
                <button type="button" class="btn btn--primario" style="background-color: #d32f2f;" onclick="app.ejecutarLogout()">Sí, cerrar sesión</button>
            </div>
        </div>
    </div>
"""

for file_name in html_files:
    with open(file_name, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if we need to modify
    modified = False
    
    # 1. Update Navigation
    if 'id="nav-login-item"' not in content:
        # insert after <ul class="header__nav-list">
        content = re.sub(r'(<ul class="header__nav-list">)', r'\1' + nav_link_addition, content, count=1)
        modified = True
        
    # 2. Add Modal
    if 'id="modal-logout"' not in content:
        # insert before </body>
        content = content.replace('</body>', modal_html + '\n</body>')
        modified = True
        
    # 3. Update Logout Button OnClick
    if 'app.perfil.cerrarSesion()' in content:
        content = content.replace('app.perfil.cerrarSesion()', 'app.abrirModalLogout()')
        modified = True
        
    if modified:
        with open(file_name, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file_name}")

print("Done updating HTML files.")
