# Sesión de Diseño Activa: Mejoras de UX (Invitados y Modales)

## 1. Portabilidad para Invitados
* **Objetivo:** Inyectar los botones de `.btn--documento` (Imprimir/Descargar PDF) en el detalle de la cita pública (Widget de Consultas sin cuenta).
* **Lógica:** Usar `app.utilidades.imprimirCita` y `app.utilidades.descargarPDFCita` pasándole el objeto de la cita.
* **Restricción:** Solo mostrar si la cita NO está cancelada.

## 2. Salida Segura de Modales (H3 - Control y Libertad)
* **Objetivo:** Todo modal activo debe cerrarse si el usuario hace clic en el botón de cierre (la 'X') o en el fondo oscuro (overlay) fuera del contenedor del modal.
* **Lógica:** Implementar un EventListener global o específico en utilidades/main que detecte clics en elementos con la clase `.modal-overlay` o `.btn-close`.