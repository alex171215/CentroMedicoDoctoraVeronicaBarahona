# Sesión de Diseño Activa: Blindaje de Fechas y Edición de Perfil

## 1. Objetivo
Implementar límites dinámicos de edad (18 a 120 años para creación de cuenta), proteger el envío del formulario mediante JS y permitir la edición de este dato en el perfil de usuario.

## 2. Instrucciones Técnicas para el Agente (app.js / HTML)

### A. Límites Dinámicos en HTML (Registro y Edición)
* **Localización:** Funciones de inicialización de formularios (Registro y Perfil).
* **Lógica:** Calcula la fecha actual. 
  - `maxDate` (Titular): Fecha exacta de hace 18 años (ej. `2008-MM-DD`).
  - `minDate`: Fecha exacta de hace 120 años.
* **Acción:** Aplica estos valores a los atributos `min` y `max` de los inputs de fecha de nacimiento. Dejar que el input abra por defecto en el `maxDate` para mejorar la UX.

### B. Validación Anti-Hack en el Submit (JS)
* **Localización:** Función de validación final antes de crear la cuenta o guardar el perfil (ej. `app.registro.crearCuenta`).
* **Acción:** Convierte el valor del input a un objeto `Date` y compáralo con las fechas límite en JS. Si la fecha es mayor a hace 18 años o menor a hace 120 años, bloquea el envío y muestra un mensaje de error (ej. "Debes ser mayor de 18 años para crear una cuenta principal").

### C. Edición de Perfil (Control del Usuario - H3)
* **Acción:** Añade el input de "Fecha de Nacimiento" al formulario HTML de edición de perfil (si no existe).
* **Carga:** Asegúrate de que, al abrir el modal/vista de perfil, este campo se llene con el dato actual del `usuarioActivo`.
* **Guardado:** Asegúrate de que al guardar el perfil, la nueva fecha se actualice en el `localStorage`.