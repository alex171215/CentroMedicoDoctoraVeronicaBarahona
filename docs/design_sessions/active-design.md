# Sesión de Diseño Activa: Erradicación de Estado "Disabled" Fantasma

## 1. Objetivo
Forzar la eliminación de la clase `btn--secundario-main` (que está pintando los botones de gris) en el renderizado dinámico de las tarjetas de especialistas, cumpliendo con la regla crítica de Affordance.

## 2. Instrucciones Técnicas para Antigravity

### A. Cirugía de Template String (app.js)
* **El Problema:** La IA falló en la sesión anterior al intentar corregir el botón "Ver perfil y servicios" de las tarjetas de los médicos. Siguen renderizándose con fondo gris.
* **Acción (Find and Replace):**
  1. Abre `app.js`.
  2. Busca LITERALMENTE la cadena de texto: `btn--secundario-main` dentro de las funciones que generan HTML (probablemente en el módulo del directorio o donde se iteran los especialistas).
  3. Reemplaza ESA cadena exacta por: `btn--secundario`.
  4. El código final inyectado debe ser exactamente este: `class="btn btn--secundario directory-card__link"`

### B. Auditoría de Especificidad CSS (styles.css)
* **Acción:** Revisa `styles.css`. Si por alguna razón la clase `.directory-card__link` o alguna otra clase contenedora está forzando un `background-color` gris oscuro o negro para los botones, ELIMINA esa propiedad. El botón debe heredar el fondo transparente y el borde turquesa de la clase base `.btn--secundario`.

**Restricción Estricta:** Esta es una tarea de búsqueda y destrucción de la clase antigua. No toques nada más del DOM ni de la lógica.