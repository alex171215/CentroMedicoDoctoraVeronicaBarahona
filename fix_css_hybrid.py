import re

with open('css/styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the previous CSS block starting with "/* --- CONTROL ESTRICTO DE BOTONES DE AUTENTICACIÓN --- */"
idx = content.find("/* --- CONTROL ESTRICTO DE BOTONES DE AUTENTICACIÓN --- */")
if idx != -1:
    content = content[:idx].strip()

new_css = """
/* --- MUTACIÓN DEL BOTÓN DE PERFIL --- */

/* Vista Móvil (< 768px): El botón se hace un círculo perfecto */
@media (max-width: 767px) {
    #btn-auth.btn-auth-hibrido {
        width: 40px !important;
        height: 40px !important;
        padding: 0 !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 1.2rem !important;
        font-weight: 600 !important;
        /* Conserva el color naranja de la clase base .btn--accion */
    }
    #btn-auth.btn-auth-hibrido .texto-pc {
        display: none !important; /* Oculta nombre en móvil */
    }
}

/* Vista Tablet y PC (>= 768px): El botón vuelve a la normalidad corporativa */
@media (min-width: 768px) {
    #btn-auth.btn-auth-hibrido .avatar-movil {
        display: none !important; /* Oculta la "P" inicial en PC */
    }
    #btn-auth.btn-auth-hibrido .texto-pc {
        display: flex !important;
        align-items: center;
        gap: 8px;
    }
}
"""

with open('css/styles.css', 'w', encoding='utf-8') as f:
    f.write(content + "\n\n" + new_css)

print("styles.css updated successfully.")
