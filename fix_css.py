import re

with open('css/styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

# We want to remove the previous media queries injected for auth visibility.
# The previous queries contained `.auth-desktop-only`, `.auth-mobile-only`, `.auth-greeting`
# We can just remove everything after the first `/* 1. Comportamiento en Celulares (Vista Móvil) */`
# or `/* Vista Móvil (< 768px) */`

idx1 = content.find("/* 1. Comportamiento en Celulares")
idx2 = content.find("/* Vista Móvil (< 768px) */")

idx = min(i for i in [idx1, idx2] if i != -1) if any(i != -1 for i in [idx1, idx2]) else -1

if idx != -1:
    content = content[:idx].strip()

new_css = """
/* --- CONTROL ESTRICTO DE BOTONES DE AUTENTICACIÓN --- */

/* Vista Móvil (< 768px) */
@media (max-width: 767px) {
    .wrapper-desktop-auth { display: none !important; }
    .wrapper-mobile-auth { display: block !important; }
}

/* Vista Tablet y Escritorio (>= 768px) */
@media (min-width: 768px) {
    .wrapper-mobile-auth { display: none !important; }
    .wrapper-desktop-auth { display: block !important; }
}
"""

with open('css/styles.css', 'w', encoding='utf-8') as f:
    f.write(content + "\n" + new_css)

print("styles.css updated successfully.")
