# Reglas de Oro de IHC y Accesibilidad (Golden Rules)

CUALQUIER modificación en la interfaz debe cumplir obligatoriamente con las siguientes reglas. Una violación a estas normas se considera un error crítico (P-0).

## 1. Heurísticas de Nielsen (Interacción)
* **H1 (Visibilidad del Estado):** Proveer feedback visual inmediato (ej. iluminar botón "Siguiente" tras validación, inyectar clase `--active` en navegación).
* **H3 (Control y Libertad):** Tras el login, el sistema DEBE redirigir al "Home" (no imponer el flujo de "Mi Salud"). Proveer botones de "Cerrar/Volver" en todos los modales.
* **H5 (Prevención de Errores - REGLA CRÍTICA):** Las validaciones de formularios SE DEBEN EJECUTAR EN EL EVENTO `blur` (pérdida de foco), NUNCA en el evento `input`. Esto evita interrumpir la memoria de trabajo.
* **H7 (Eficiencia de Uso):** Proveer atajos lógicos (ej. agendar desde el perfil de un médico salta directo al calendario).
* **Ley de Jakob:** Aplicar interfaces estándar (menú inferior móvil, menú superior desktop, patrón Maestro-Detalle).

## 2. Lineamientos de Accesibilidad (WCAG 2.2)
* **Perceptibilidad (1.4.1):** Los errores de formulario NO deben depender solo del color. Deben incluir borde de error y mensaje textual inyectado dinámicamente debajo del campo.
* **Operabilidad (Ley de Fitts):** TODO elemento interactivo (botones, enlaces, iconos clickeables) DEBE tener un área de impacto mínima de **44x44 píxeles** en móviles.
* **Semántica y ARIA (4.1.2):** Uso estricto de HTML semántico (`<header>`, `<main>`, `<nav>`). Componentes dinámicos deben usar atributos ARIA (`role="alert"`, `aria-live="polite"`, `aria-modal="true"`, `aria-hidden="true"` para iconos decorativos).