# Sesión de Diseño Activa: Ocultamiento Inteligente de Navegación (Hide vs Disable)

## 1. Objetivo
Aplicar la regla de "Ocultar en lugar de Deshabilitar" al botón de retroceso cuando el usuario se encuentre en el primer día hábil, mejorando el diseño minimalista (H8) y eliminando affordances engañosos, preservando la estabilidad del layout.

## 2. Instrucciones Técnicas para Antigravity

### A. Persistencia del Límite de Inicio (app.js)
* **Acción:** En la inicialización del calendario, guarda el primer día con horarios útiles en `this.fechaInicioDisponible`.

### B. Control de Visibilidad (app.js)
* **Localización:** Función de renderizado de la navegación móvil o actualización de UI.
* **Lógica:** 1. Compara `this.fechaBaseCalendario` con `this.fechaInicioDisponible` (reseteando horas a 00:00:00).
    2. Si son iguales (es el primer día): Aplica `style.visibility = "hidden"` al botón de retroceso (`cambiarDiaMobile(-1)`).
    3. Si el usuario avanzó a fechas futuras: Aplica `style.visibility = "visible"`.
    4. Elimina cualquier rastro de la lógica anterior que usaba `opacity` o `pointer-events`.

### C. Guarda Lógica en JS (Seguridad)
* **Acción:** En `cambiarDiaMobile(direccion)`, mantén el `return;` si `direccion === -1` y la fecha es igual al inicio disponible, por si el usuario intenta forzar la función desde la consola.