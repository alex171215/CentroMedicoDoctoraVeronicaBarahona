import os

css_rules = """
/* 1. Comportamiento en Celulares (Vista Móvil) */
@media (max-width: 767px) {
    /* Ocultar el saludo de texto para que no empuje el logo hacia abajo */
    .auth-greeting {
        display: none !important;
    }
    
    /* Asegurar que el contenedor mantenga una sola línea rígida sin wrapping */
    .header__main-container {
        flex-wrap: nowrap !important;
    }
}

/* 2. Comportamiento en Computadoras y Tablets */
@media (min-width: 768px) {
    /* El botón iconográfico compacto de invitado no debe existir en PC, se oculta */
    .auth-slot-guest {
        display: none !important;
    }
    
    /* Volver a mostrar el saludo de texto completo en pantallas grandes */
    .auth-greeting {
        display: inline-block !important;
    }
}
"""

with open('css/styles.css', 'a', encoding='utf-8') as f:
    f.write("\n" + css_rules)

print("CSS rules appended to css/styles.css")
