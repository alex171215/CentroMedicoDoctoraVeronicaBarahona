# Sesión de Diseño Activa: Validación Atómica y Aislada (Paso 3)

## 1. Objetivo
Corregir el comportamiento de validación masiva en el Paso 3, asegurando que los errores solo se muestren en el campo específico que pierde el foco (`blur`), respetando el flujo natural del usuario.

## 2. Instrucciones Técnicas para Antigravity (Claude)

### A. Refactorización de Listeners (app.js)
* **El Problema:** Al salir de un campo, el sistema valida todo el formulario y muestra errores en campos no visitados.
* **Acción:** Modifica los Event Listeners de `blur` para los inputs del Paso 3.
* **Lógica Atómica:**
  1. La función ejecutada en el `blur` debe recibir el evento y actuar ÚNICAMENTE sobre `e.target`.
  2. Valida el valor del `target`. Si está vacío o es inválido, muestra el mensaje de error **solo para ese ID**.
  3. No llames a funciones globales de validación (como las que habilitan el botón "Siguiente") que tengan efectos secundarios visuales en otros campos durante el `blur`.

### B. Sincronización de Botón "Siguiente"
* **Acción:** Mantén la validación global (habilitar/deshabilitar botón) únicamente para el evento `input`, pero asegúrate de que esa función no inyecte clases de error (`--error`) ni muestre mensajes de texto. El evento `input` debe ser silencioso.

**Restricción Estricta:** No alteres el diseño de los modales ni la lógica de las colisiones de 30 minutos.