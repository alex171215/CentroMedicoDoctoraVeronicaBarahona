import re

with open('css/styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the previous CSS block starting with "/* --- TR-74: CORRECCIÓN RESPONSIVA DE AUTENTICACIÓN --- */"
idx = content.find("/* --- TR-74: CORRECCIÓN RESPONSIVA")
if idx != -1:
    content = content[:idx].strip()

new_css = """
/* --- TR-74: CONTROL DE ACCESOS DE AUTENTICACIÓN SEPARADOS --- */

/* Estilos del Círculo Móvil (Improvisado tipo Google) */
.auth-avatar-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: var(--action-color, #0da99f);
    color: #ffffff;
    font-weight: 600;
    font-size: 1.15rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    padding: 0;
}

/* Vista Móvil (< 768px): Muestra círculo, el de PC se oculta automáticamente por el contenedor .header__top */
@media (max-width: 767px) {
    #btn-auth-mobile {
        display: flex !important;
    }
}

/* Vista Tablet y Escritorio (>= 768px): Oculta por completo el círculo y lo saca del flujo del TAB */
@media (min-width: 768px) {
    #btn-auth-mobile {
        display: none !important; /* Desaparece visualmente y del teclado */
    }
    
    /* Asegurar que el botón de PC mantenga su hermoso diseño de óvalo original */
    #btn-auth.btn--accion {
        display: inline-flex !important;
        border-radius: 100px !important; /* Óvalo inmutable */
        padding: 10px 24px !important;
    }
}
"""

with open('css/styles.css', 'w', encoding='utf-8') as f:
    f.write(content + "\n\n" + new_css)

print("styles.css updated successfully.")
