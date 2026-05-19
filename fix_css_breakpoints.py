import re

with open('css/styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the old styles for TR-74 to avoid conflict, then append the new ones.
idx = content.find("/* --- TR-74: CONTROL DE ACCESOS DE AUTENTICACIÓN SEPARADOS --- */")
if idx != -1:
    content = content[:idx].strip()
    
idx2 = content.find("/* --- TR-74: RESTAURACIÓN DE CÍRCULO EN AVATAR MÓVIL --- */")
if idx2 != -1:
    content = content[:idx2].strip()

new_css = """
/* ==========================================================================
   TR-74: CONTROL DE ACCESOS DE AUTENTICACIÓN (CELULAR VS TABLET/PC)
   ========================================================================== */

/* --- VISTA MÓVIL (Menor a 768px) --- */
@media (max-width: 767px) {
    /* Ocultar botón de PC en celulares */
    #btn-auth {
        display: none !important;
    }
    /* Estilar la inicial "P" en círculo perfecto dentro del celular */
    #btn-auth-mobile {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: 40px !important;
        height: 40px !important;
        min-width: 40px !important;
        border-radius: 50% !important;
        background-color: var(--action-color, #0da99f) !important;
        color: #ffffff !important;
        font-weight: 600 !important;
        font-size: 1.2rem !important;
        align-items: center !important;
        justify-content: center !important;
        border: none !important;
        cursor: pointer !important;
        padding: 0 !important;
    }
}

/* --- VISTA TABLET Y COMPUTADORA (768px o mayor) --- */
@media (min-width: 768px) {
    /* Elimina por completo el botón de celular y lo saca del flujo de la tecla TAB */
    #btn-auth-mobile {
        display: none !important;
    }
    /* Restaura el hermoso óvalo original del botón de PC que te gustaba */
    #btn-auth.btn--accion {
        display: inline-flex !important;
        border-radius: 100px !important; /* Forma de óvalo original restaurada */
        padding: 10px 24px !important;
    }
}
"""

with open('css/styles.css', 'w', encoding='utf-8') as f:
    f.write(content + "\n\n" + new_css)

print("styles.css updated successfully.")
