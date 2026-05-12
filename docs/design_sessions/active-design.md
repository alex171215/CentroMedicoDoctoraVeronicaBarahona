# Sesión de Diseño Activa: Corrección de Sintaxis de Eventos y Mojibake (UTF-8)

## 1. Objetivo
Reparar la rotura del DOM causada por colisión de comillas en los botones de impresión del widget de invitados y ejecutar una limpieza global de errores de codificación (caracteres rotos).

## 2. Instrucciones Técnicas para Antigravity

### A. Refactorización de Botones de Documento (Widget Invitados)
* **Localización:** Función que renderiza el detalle de la cita para usuarios sin cuenta (probablemente `_renderDetalle` en el módulo de consultas/invitados).
* **El Problema:** El atributo `onclick` está recibiendo un objeto entero, rompiendo las comillas.
* **La Solución:** 1. Modifica la inyección del HTML para que solo pase el ID: `onclick="app.utilidades.imprimirCitaInvitado('${cita.id_cita}')"` y `descargarPDFCitaInvitado('${cita.id_cita}')`.
  2. Crea estas dos funciones proxy (`imprimirCitaInvitado` y `descargarPDFCitaInvitado`) en `app.utilidades` o en el módulo del widget.
  3. Estas funciones deben leer el arreglo completo desde `localStorage.getItem('sanitas_citas')`, buscar la cita que coincida con el ID proporcionado, y pasarle ese objeto limpio a `app.utilidades.imprimirCita(cita)` y `descargarPDFCita(cita)`.

### B. Limpieza Global de Codificación (Mojibake)
* **Acción:** Realizar un *Search and Replace* en todos los archivos `.js` y `.html` para corregir los caracteres UTF-8 corruptos.
* **Mapeo de Corrección:**
  - `Ã¡` -> `á`
  - `Ã©` -> `é`
  - `Ã­` -> `í` (í con tilde)
  - `Ã³` -> `ó`
  - `Ãº` -> `ú`
  - `Ã±` -> `ñ`
* **Verificación:** Asegúrate de que las palabras como "Médico", "Diagnóstico", "Día", etc., queden correctamente legibles.