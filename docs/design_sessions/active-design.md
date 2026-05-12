# Sesión de Diseño Activa: Sanitización Dinámica y UX de Scroll

## 1. Objetivo
Reparar la sanitización del campo de identificación para que respete el tipo de documento seleccionado (Pasaporte vs Cédula) e implementar el scroll automático al cambiar de paso en formularios multi-paso para reducir la carga cognitiva.

## 2. Instrucciones Técnicas para Antigravity (app.js / main.js)

### A. Sanitización Dinámica de Identificación (Bug Pasaporte)
* **Localización:** Función o Event Listener que sanitiza `#reg-identificacion`.
* **El Problema:** Actualmente no diferencia si el usuario eligió Cédula o Pasaporte en `#reg-tipo-doc`.
* **La Solución:** Dentro del evento `input` de `#reg-identificacion`, debes leer el valor actual del tipo de documento (ej. verificando el `value` o texto de `#reg-tipo-doc` o el estado interno).
  1. **Si es Pasaporte:** Aplicar regex Alfanumérica: `replace(/[^a-zA-Z0-9]/g, '')`.
  2. **Si es Cédula:** Aplicar regex Numérica: `replace(/[^0-9]/g, '')`.
* **Feedback:** Si la regex elimina algún carácter, debe disparar la clase `.input-rechazado` creada en la sesión anterior para dar retroalimentación visual.

### B. Gestión de Scroll en Formularios (Bug de Salto de Paso)
* **Localización:** Funciones que gestionan el avance de pasos. Principalmente en `app.registro.avanzarPaso()` (o similar) y `app.citas.mostrarPaso()`.
* **La Solución:** Inmediatamente después de ocultar el paso anterior y mostrar el nuevo paso, inyecta la siguiente instrucción para subir la pantalla suavemente:
  `window.scrollTo({ top: 0, behavior: 'smooth' });`
* **Validación:** Asegúrate de que esto se aplique tanto en el flujo de Registro de Cuentas como en el de Agendamiento de Citas.