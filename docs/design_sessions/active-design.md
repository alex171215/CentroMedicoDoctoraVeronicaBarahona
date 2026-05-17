# Sesión de Diseño Activa: Fuerza Bruta CSS para Carrusel

## 1. Objetivo
Aplicar reglas de CSS inquebrantables para solucionar el desbordamiento en la Slide 1 (dejando solo 2 íconos en móvil), ocultar elementos no deseados en la Slide de Política y destruir la restricción de ancho (pared invisible) en la Slide 3.

## 2. Instrucciones Técnicas para Antigravity

### A. Preparación del HTML (`index.html`)
* Ve al slider principal.
* Asegúrate de que el Slide 1 tenga la clase base: `<div class="hero__slide hero__slide--inicio">`.
* Asegúrate de que el Slide 3 (Especialidades) tenga la clase explícita: `<div class="hero__slide hero__slide--wide">`.
* Asegúrate de que el Slide 5 (Política 24h) tenga la clase explícita: `<div class="hero__slide hero__slide--policy">`.

### B. Ejecución de Media Queries (`styles.css`)
Inyecta las siguientes reglas exactas. Tienes permitido usar `!important` para sobrescribir la cascada CSS actual.

**Para Móviles (`@media (max-width: 767px)`):**
```css
/* Slide 1: Ocultar el 3er y 4to ícono para dejar solo 2 y salvar el botón */
.hero__slide--inicio .hero__feature:nth-child(n+3) {
    display: none !important;
}

/* Slide 5 (Política): Ocultar el ícono de 'Cancela o modifica' */
.hero__slide--policy .hero__features {
    display: none !important;
}

/* Slide 5 (Política): Centrar el contenido que estaba muy a la izquierda */
.hero__slide--policy .hero__content {
    margin: 0 auto !important;
    text-align: center !important;
    padding: 0 15px !important;
}
```

**Para Escritorio (`@media (min-width: 1024px)`):**
```css
/* Slide 3 (Especialidades): Destruir la pared invisible */
.hero__slide--wide .hero__content {
    max-width: 900px !important;
    width: 90% !important;
}

/* Slide 5 (Política): Centrar correctamente el bloque de texto */
.hero__slide--policy .hero__content {
    margin: 0 auto !important;
    text-align: center !important;
    max-width: 800px !important;
}
```