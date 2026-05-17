# Sesión de Diseño Activa: Implementación de History API para Navegación Móvil

## 1. Objetivo
Resolver el "secuestro" del botón Atrás en dispositivos móviles. Al abrir un modal o un detalle de cita (ej. en "Mi Salud"), si el usuario presiona "Atrás" en su celular, debe regresar a la lista de citas, no salir de la página ni perder su progreso (Heurística 3).

## 2. Instrucciones Técnicas para Antigravity

### A. Registro de Estado en Vistas Dinámicas (`js/modulos/salud.js` o similar)
* **Localización:** Función encargada de abrir la vista de "Detalle de Cita" (ej. `verDetalleCita(id)`).
* **Acción 1:** Justo después de mostrar el div del detalle en pantalla, inyecta un estado en el historial del navegador:
  `history.pushState({ vista: 'detalleCita', citaId: id }, '', '#detalle');`
* **Acción 2:** Modifica el botón visual de "Cerrar" o "Volver" propio de esa vista de detalle. En lugar de simplemente ocultar el div, debe ejecutar `history.back();` (lo cual disparará el evento popstate para mantener el historial limpio).

### B. Interceptación Global de Retroceso (`js/main.js` o `js/app.js`)
* **Localización:** Inicialización global de la aplicación.
* **Acción:** Añade un Event Listener para `popstate`:
  ```javascript
  window.addEventListener('popstate', (evento) => {
      // Lógica para detectar si hay un detalle de cita abierto y cerrarlo.
      // Si el estado del evento es nulo o no es 'detalleCita', asegurar que
      // los modales o vistas superpuestas se oculten para volver a la vista principal.
  });
  ```

### C. (Opcional/Recomendado) Aplicación a Pasos de Formulario
* Si es viable sin romper código, aplica el mismo patrón `pushState` a la función que cambia de pasos en formularios (ej. `_irAPaso(paso)`), para que el botón "Atrás" del celular sirva para retroceder de paso.