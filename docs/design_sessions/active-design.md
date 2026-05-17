# Sesión de Diseño Activa: Modal de Cambio de Contraseña en Perfil

## 1. Objetivo
Implementar un modal seguro para el cambio de contraseña dentro del área del Perfil del usuario, utilizando el patrón de divulgación progresiva y garantizando la validación estricta de las credenciales antiguas y nuevas.

## 2. Instrucciones Técnicas para Antigravity

### A. Modificaciones UI (`perfil.html` o donde esté la vista de edición)
* **Trigger:** Añade un enlace o botón con el texto "Cambiar Contraseña" cerca de los botones de edición de perfil.
* **Modal de Contraseña:** Crea un nuevo bloque HTML al final del documento para este modal. DEBE usar las clases globales de tu UI Kit (`.modal-overlay`, `.modal-content`, `.modal-header`, `.modal-body`).
* **Estructura del Formulario:**
  - Input 1: "Contraseña actual" (`id="pass-actual"`).
  - Input 2: "Nueva contraseña" (`id="pass-nueva"`).
  - Input 3: "Repetir nueva contraseña" (`id="pass-repetir"`).
  - *UX Requisito:* Los tres inputs deben ser `type="password"`, tener un `maxlength="128"`, y estar acompañados de sus respectivos `span` para errores. 

### B. Lógica JavaScript (Módulo Perfil / `main.js`)
* **Gestión del Modal:** Crea las funciones `abrirModalPassword()` y `cerrarModalPassword()`. Al cerrar, asegúrate de limpiar los values de los 3 inputs.
* **Validación y Guardado (`cambiarPasswordUsuario()`):**
  1. Verifica que ningún campo esté vacío.
  2. Verifica que `pass-nueva` sea igual a `pass-repetir`. Si no, lanza error en el campo de repetir.
  3. Consulta a Supabase (o al estado global si almacenas el password hasheado/plano) para verificar que `pass-actual` sea correcto.
  4. Si todo es correcto, ejecuta el `UPDATE` en la tabla `pacientes` de Supabase para actualizar la columna `password`.
  5. Muestra un mensaje de éxito ("Contraseña actualizada correctamente") y cierra el modal.