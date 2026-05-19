import os

css_rules = """
/* Vista Móvil (< 768px) */
@media (max-width: 767px) {
    .auth-desktop-only {
        display: none !important;
    }
    .auth-mobile-only {
        display: flex !important; /* El avatar circular */
    }
}

/* Vista Tablet y Escritorio (>= 768px) */
@media (min-width: 768px) {
    .auth-mobile-only {
        display: none !important; /* Oculta el círculo */
    }
    .auth-desktop-only {
        display: inline-flex !important; /* Muestra el botón naranja corporativo */
    }
}
"""

with open('css/styles.css', 'a', encoding='utf-8') as f:
    f.write("\n" + css_rules)

print("CSS rules appended to css/styles.css")
