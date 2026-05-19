import re

with open('css/styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the previous CSS block starting with "/* --- TR-74: MUTACIÓN GEOMÉTRICA RESPONSIVA DEL BOTÓN DE PERFIL --- */"
idx = content.find("/* --- TR-74: MUTACIÓN GEOMÉTRICA RESPONSIVA")
if idx != -1:
    content = content[:idx].strip()

new_css = """
/* --- TR-74: CORRECCIÓN RESPONSIVA DE AUTENTICACIÓN --- */

/* Vista Móvil (< 768px): Forzamos al botón original a aparecer como un círculo impecable */
@media (max-width: 767px) {
    #btn-auth {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: 40px !important;
        height: 40px !important;
        min-width: 40px !important;
        padding: 0 !important;
        border-radius: 50% !important;
        align-items: center !important;
        justify-content: center !important;
    }
    #btn-auth .auth-text-desktop {
        display: none !important;
    }
    #btn-auth .auth-initial-mobile {
        display: block !important;
        font-weight: 600 !important;
    }
}

/* Vista Tablet y PC (>= 768px): Devolvemos el óvalo perfecto original */
@media (min-width: 768px) {
    #btn-auth {
        display: inline-flex !important;
        width: auto !important;
        height: auto !important;
        border-radius: 100px !important; /* Re-establece la curvatura de óvalo original */
        padding: 10px 24px !important; /* Margen interno cómodo para el nombre */
    }
    #btn-auth .auth-initial-mobile {
        display: none !important;
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
