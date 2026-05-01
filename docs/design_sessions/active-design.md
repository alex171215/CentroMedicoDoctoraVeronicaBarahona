# Sesión de Diseño Activa: Blindaje Final de Comprobantes e Impresión

## 1. Objetivo
Corregir el renderizado del PDF (evitar hoja en blanco), implementar la función de impresión física directa y asegurar que el buscador de citas sea infalible.

## 2. Instrucciones Técnicas para Antigravity

### A. Fix de Renderizado PDF (app.js)
* **Problema:** PDF en blanco por falta de tiempo de renderizado.
* **Solución:** En `descargarComprobantePDF`, el elemento temporal debe tener `opacity: 1; position: absolute; left: -9999px; display: block;`. 
* **Sincronismo:** Usa `await` o un `setTimeout` de 800ms antes de llamar a `html2pdf().save()` para asegurar que los estilos se apliquen. Asegura que el contenedor tenga un ancho fijo de `800px` para evitar desbordamientos.

### B. Implementación de Botón "Imprimir" (Requisito Ingeniera)
* **Acción:** Añadir botón `#btn-imprimir-comprobante` en la vista de éxito.
* **Lógica:** Crear función `imprimirComprobante()` que abra una `window.open`, inyecte el mismo HTML del ticket y ejecute `window.print()`. Esto da libertad al usuario de elegir soporte físico.

### C. Refactorización del Buscador (Búsqueda Dual)
* **Lógica de Filtro:** Modificar la función de consulta para que sea "EITHER/OR". La cita se encuentra si:
  `(cita.cedula === inputCedula) AND (cita.fecha === inputFecha OR cita.codigoSeguimiento === inputCodigo)`.
* **Normalización:** Usa `.trim()` en todos los strings de comparación para evitar errores por espacios invisibles.

### D. UI y Diseño (styles.css e index.html)
* **Botones:** La pantalla de confirmación debe tener tres botones: [Descargar PDF], [Imprimir], [Volver al Inicio].
* **Layout:** Centrar verticalmente el contenido del ticket en el PDF usando `flexbox` inline en el elemento temporal.