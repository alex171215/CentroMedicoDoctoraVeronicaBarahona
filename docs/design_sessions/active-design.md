# Sesión de Diseño: Implementación de Concurrencia y TTL de 10 Minutos

## 1. Objetivo
Blindar el proceso de agendamiento para evitar colisiones entre usuarios, implementando un bloqueo temporal de 10 minutos con visualización de horarios deshabilitados.

## 2. Instrucciones Técnicas

### A. Lógica JS (No tocar el DOM principal)
* **Persistencia:** No inyectar HTML nuevo. Crear una función `app.citas.bloquearHorario(especialistaId, fecha, hora)` que gestione el `sessionStorage` y el estado en Supabase.
* **Interfaz:** Crear una función `app.citas.deshabilitarHorarios()` que recorra los botones de horario en el Paso 2 y les añada el atributo `disabled` si su valor coincide con un horario bloqueado.
* **Timer:** Usar un `setTimeout` de 600,000ms (10 min). Al finalizar, ejecutar `app.citas.liberarHorario()` y abrir el modal.

### B. Modal de Caducidad (UI)
* Reutilizar la estructura de modales existente (manteniendo la clase `.modal-overlay`, `.modal-content`).
* Título: "Tiempo excedido". Mensaje: "El tiempo de espera o tiempo permitido ha excedido".
* Botón de cierre con evento para llamar a `window.location.href = 'index.html'`.

### C. CSS de Deshabilitación
```css
.citas-calendar-grid button:disabled, 
.citas-calendar-grid button.is-pending {
    background-color: #ccc !important;
    cursor: not-allowed !important;
    opacity: 0.6 !important;
}
```