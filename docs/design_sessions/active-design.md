# Sesión de Diseño Activa: Reparación Radical de Glifos en Listas

## 1. Objetivo
Forzar la renderización correcta de las viñetas en `.modal-activities-list li` eliminando la herencia de fuente que rompe los íconos.

## 2. Instrucciones Técnicas para Gemini (Agente)

### A. CSS de Fuerza Bruta (`css/styles.css`)
Inyecta este código. He añadido una instrucción de `content` explícita por si el original se perdió, y asegurado la familia de fuentes:

```css
/* --- TR-75: REPARACIÓN RADICAL DE VIÑETAS --- */

.modal-activities-list li {
    font-family: inherit !important; /* Mantiene la tipografía del texto */
    list-style: none !important;     /* Elimina viñeta por defecto del navegador */
    position: relative;
    padding-left: 25px !important;
}

.modal-activities-list li::before {
    /* Forzamos el ícono de FontAwesome */
    content: "\f00c" !important; /* Unicode del Check de FontAwesome */
    font-family: "Font Awesome 6 Free" !important;
    font-weight: 900 !important;
    position: absolute;
    left: 0;
    color: var(--action-color, #0da99f) !important; /* Mantiene tu color corporativo */
    font-size: 0.9rem !important;
}
```