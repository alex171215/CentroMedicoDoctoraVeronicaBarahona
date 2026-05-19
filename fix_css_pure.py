import re

with open('css/styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the previous CSS block starting with "/* --- ESTÉTICA DEL AVATAR MÓVIL --- */"
idx = content.find("/* --- ESTÉTICA DEL AVATAR MÓVIL --- */")
if idx != -1:
    content = content[:idx].strip()

new_css = """
/* --- TR-74: MUTACIÓN GEOMÉTRICA RESPONSIVA DEL BOTÓN DE PERFIL --- */

/* Vista Móvil (< 768px): Convierte el mismo botón en un círculo perfecto */
@media (max-width: 767px) {
    #btn-auth.btn--accion {
        width: 40px !important;
        height: 40px !important;
        padding: 0 !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 1.15rem !important;
        font-weight: 600 !important;
    }
    #btn-auth .auth-text-desktop {
        display: none !important; /* Oculta texto de PC */
    }
    #btn-auth .auth-initial-mobile {
        display: block !important; /* Muestra inicial */
    }
}

/* Vista Tablet y Escritorio (>= 768px): Restaura su diseño horizontal clásico */
@media (min-width: 768px) {
    #btn-auth.btn--accion {
        width: auto !important;
        height: auto !important;
        padding: 8px 16px !important; /* Ajusta según tu padding estándar de botones */
        border-radius: 4px !important; /* Restaura esquinas redondeadas del UI Kit */
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
    }
    #btn-auth .auth-initial-mobile {
        display: none !important; /* Oculta inicial en PC */
    }
    #btn-auth .auth-text-desktop {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
    }
}
"""

with open('css/styles.css', 'w', encoding='utf-8') as f:
    f.write(content + "\n\n" + new_css)

print("styles.css updated successfully.")
