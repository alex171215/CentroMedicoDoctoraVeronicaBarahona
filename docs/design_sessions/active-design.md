# Sesión de Diseño Activa: Corrección de Identidad en Resumen (H2)

## 1. Objetivo
Asegurar que el resumen de la cita muestre el nombre real del titular de la cuenta cuando este agenda para sí mismo, eliminando el placeholder "Paciente".

## 2. Instrucciones Técnicas para Antigravity (app.js)
* **Localización:** Función que genera el resumen del Paso 4 y la pantalla de éxito del Paso 5.
* **Refactorización de Variable `nombrePaciente`:**
    * Crear una variable local que determine el nombre a mostrar.
    * Si el usuario está logueado y NO es flujo de familiar: extraer los datos de `app.usuarioActivo` (o del objeto recuperado de `sanitas_usuarios`).
    * Formato: `Firstname + Lastname`.
* **Inyección en DOM:** Asegurarse de que el elemento que muestra "Paciente: ..." reciba esta variable procesada.