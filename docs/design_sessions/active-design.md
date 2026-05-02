# Sesión de Diseño Activa: Conexión de Funciones y Modal de Cancelación Profesional

## 1. Objetivo
Asegurar que las funciones de cancelación sean accesibles desde el DOM y reemplazar las alertas del sistema por un modal de confirmación integrado (H3 y H4).

## 2. Instrucciones Técnicas para Antigravity

### A. Exposición de Funciones (Scope en app.js)
* **El Problema:** El `onclick` busca `app.salud.cancelarCita` y `app.widgetInvitado.cancelarCita`, pero las funciones están "escondidas" dentro de los módulos.
* **Acción:** Revisa el final de los módulos `salud` y `widgetInvitado`. ASEGÚRATE de que la función `cancelarCita` esté incluida en el `return` de cada objeto para que sea pública. 
* **Depuración:** Añade un `console.log("Iniciando proceso de cancelación para:", idCita);` al principio de la función para verificar que el clic llega al código.

### B. Modal de Confirmación HTML (Adiós al window.confirm)
* **Acción:** Crea una función `mostrarConfirmacionCancelacion(idCita, callback)`.
* **Diseño:** 1. Inyecta un `div` con ID `#modal-confirmar-cancelacion` que cubra toda la pantalla (overlay oscuro).
  2. Dentro, un cuadro centrado que pregunte: "¿Estás seguro de que deseas cancelar esta cita?".
  3. Dos botones: 
     - "No, mantener cita" (clase `.btn--outline`).
     - "Sí, cancelar cita" (clase `.btn--primary` con un color de advertencia o rojo).
* **Lógica:** Si el usuario presiona "Sí", ejecuta el cambio de estado en el LocalStorage y cierra el modal.

### C. Actualización de Estado y Re-renderizado
* Una vez confirmada la cancelación:
  1. Busca el objeto en `sanitas_citas` por su ID y cambia `estado: 'Cancelada'`.
  2. Guarda en `localStorage`.
  3. **CRÍTICO:** Ejecuta la función de renderizado correspondiente (`app.salud.renderizarCitas()` o la del widget) para que el botón y la tarjeta de la cita desaparezcan o cambien de aspecto visual inmediatamente (Heurística 1).

**Restricciones:** No uses `alert()` ni `confirm()`. Usa exclusivamente clases CSS de tu archivo `styles.css` para el diseño del modal.