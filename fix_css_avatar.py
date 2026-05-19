import re

with open('css/styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the old styles for `.auth-avatar-btn` to avoid conflict, then append the new ones.
idx = content.find("/* Estilos del Círculo Móvil (Improvisado tipo Google) */")
if idx != -1:
    end_idx = content.find("/* Vista Móvil (< 768px):", idx)
    if end_idx != -1:
        content = content[:idx] + content[end_idx:]

new_css = """
/* --- TR-74: RESTAURACIÓN DE CÍRCULO EN AVATAR MÓVIL --- */
#btn-auth-mobile.auth-avatar-btn {
    width: 40px !important;
    height: 40px !important;
    min-width: 40px !important;
    min-height: 40px !important;
    border-radius: 50% !important;
    background-color: var(--action-color, #0da99f) !important;
    color: #ffffff !important;
    font-weight: 600 !important;
    font-size: 1.2rem !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    border: none !important;
    cursor: pointer !important;
    padding: 0 !important;
}
"""

with open('css/styles.css', 'w', encoding='utf-8') as f:
    f.write(content + "\n\n" + new_css)

print("styles.css updated successfully.")
