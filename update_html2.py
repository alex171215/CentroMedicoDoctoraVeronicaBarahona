import os
import re

html_files = [f for f in os.listdir('.') if f.endswith('.html')]

# The exact line to remove
nav_login_str = '<li class="header__nav-item" id="nav-login-item"><a href="login.html" id="nav-login-link" class="header__nav-link">Iniciar Sesión</a></li>'
nav_login_str_regex = r'<li class="header__nav-item" id="nav-login-item">.*?</li>\s*'

# The div to inject
auth_slot_div = '<div id="header-auth-slot" class="header__auth-slot"></div>'

for file_name in html_files:
    with open(file_name, 'r', encoding='utf-8') as f:
        content = f.read()
    
    modified = False
    
    # 1. Remove nav-login-item
    if 'id="nav-login-item"' in content:
        content = re.sub(nav_login_str_regex, '', content)
        modified = True

    # 2. Inject header-auth-slot before the menu toggle if it doesn\'t exist
    if 'id="header-auth-slot"' not in content:
        # Find the button toggle
        target_toggle = '<button class="header__menu-toggle"'
        if target_toggle in content:
            content = content.replace(target_toggle, auth_slot_div + '\n                ' + target_toggle)
            modified = True

    # 3. Modify #modal-logout buttons
    # From:
    # <div class="modal-actions">
    #     <button type="button" class="btn btn--secundario modal-cerrar" onclick="app.cerrarModalLogout()">Cancelar</button>
    #     <button type="button" class="btn btn--primario" style="background-color: #d32f2f;" onclick="app.ejecutarLogout()">Sí, cerrar sesión</button>
    # </div>
    # To:
    # <div class="modal-actions" style="display: flex; flex-direction: column; gap: 12px;">
    #     <button type="button" class="btn btn--primario" onclick="app.ejecutarLogout()">Sí, cerrar sesión</button>
    #     <button type="button" class="btn btn--secundario" style="background-color: #d32f2f; color: white;" onclick="app.cerrarModalLogout()">Cancelar</button>
    # </div>
    if 'id="modal-logout"' in content and 'flex-direction: column' not in content:
        # We need to replace the innerHTML of .modal-actions for the #modal-logout only
        # We can do this with regex, finding the modal-logout block first
        modal_start = content.find('id="modal-logout"')
        if modal_start != -1:
            actions_start = content.find('<div class="modal-actions">', modal_start)
            if actions_start != -1:
                actions_end = content.find('</div>', actions_start) + 6
                
                new_actions = """<div class="modal-actions" style="display: flex; flex-direction: column; gap: 12px;">
                <button type="button" class="btn btn--primario" onclick="app.ejecutarLogout()">Sí, cerrar sesión</button>
                <button type="button" class="btn btn--secundario modal-cerrar" style="background-color: #d32f2f; color: white;" onclick="app.cerrarModalLogout()">Cancelar</button>
            </div>"""
                content = content[:actions_start] + new_actions + content[actions_end:]
                modified = True
                
    if modified:
        with open(file_name, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file_name}")

print("Done updating HTML files.")
