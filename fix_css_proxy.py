import re

with open('css/styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the previous CSS block starting with "/* --- MUTACIÓN DEL BOTÓN DE PERFIL --- */"
idx = content.find("/* --- MUTACIÓN DEL BOTÓN DE PERFIL --- */")
if idx != -1:
    content = content[:idx].strip()

new_css = """
/* --- ESTÉTICA DEL AVATAR MÓVIL --- */
.auth-avatar-btn {
    width: 40px !important;
    height: 40px !important;
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

/* --- CONTROL DE VISIBILIDAD (EVITAR DUPLICADOS) --- */

/* Vista Móvil (< 768px): Oculta botón de PC */
@media (max-width: 767px) {
    .hide-on-mobile { display: none !important; }
    .hide-on-desktop { display: flex !important; } /* Muestra la P */
}

/* Vista Tablet y PC (>= 768px): Oculta la "P" */
@media (min-width: 768px) {
    .hide-on-desktop { display: none !important; }
    .hide-on-mobile { display: inline-flex !important; } /* Muestra el original */
}
"""

with open('css/styles.css', 'w', encoding='utf-8') as f:
    f.write(content + "\n\n" + new_css)

print("styles.css updated successfully.")
