# Sesión de Diseño Activa: Auditoría y Corrección de Sincronización de Perfil

## 1. Objetivo
Delegar al agente la auditoría del flujo de edición de perfil para corregir el bug de "Desincronización de Estado Local", donde los nombres/apellidos se revierten visualmente a su valor anterior tras ser guardados.

## 2. Instrucciones de Auditoría y Corrección para Antigravity

### A. Auditoría de `guardarCambios()` (Módulo Perfil)
* **El Problema:** La actualización de `celular` y `email` funciona, pero los nombres vuelven a su estado anterior en la UI.
* **Tu Tarea:** Analiza la función que se dispara con el botón "Guardar Cambios" (`app.perfil.guardarCambios` o equivalente).
* **Corrección Exigida:** Revisa el bloque de código que se ejecuta **después** de que Supabase responde con éxito. Debes asegurarte de que el objeto `usuarioActivo` que se guarda de vuelta en `localStorage` actualice explícitamente sus propiedades divididas (`nombre_1`, `nombre_2`, `apellido_1`, `apellido_2`) tomando los valores exactos que el usuario acaba de escribir en los inputs `#edit-nombre1`, etc.

### B. Auditoría de la Recarga de UI
* **El Problema:** Al cerrar la vista de edición y volver al perfil, el nombre visible (ej. "Hola, Pepito") no se actualiza.
* **Tu Tarea:** Analiza qué función renderiza la vista principal del perfil.
* **Corrección Exigida:** Asegúrate de que, tras un guardado exitoso y la actualización del `localStorage`, se invoque automáticamente a la función que redibuja el DOM del perfil con los datos frescos.