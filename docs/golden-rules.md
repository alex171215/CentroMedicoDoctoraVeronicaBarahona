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

### 3. Regla de Oro: Jerarquía y Semántica de Botones (Design System)
Para mantener la consistencia visual (H4) y los affordances correctos, PROHIBIDO usar estilos inline o colores hexadecimales sueltos para botones. **REGLA CRÍTICA: Ningún botón activo debe tener fondo gris con texto oscuro, ya que simula un estado 'disabled'.** Usa estrictamente estas clases:
* `.btn--primario` (Fondo Turquesa, texto blanco): Acciones finales (Confirmar, Consultar).
* `.btn--accion` (Fondo Naranja, texto blanco): Progresión (Siguiente, Iniciar Sesión).
* `.btn--secundario` (Outline Turquesa, texto Turquesa): Acciones opcionales/secundarias (Descargar PDF, Imprimir, Enlaces a perfiles).
* `.btn--peligro` (Fondo rojo claro, texto rojo): Acciones destructivas (Cancelar).
* `.enlace-accion` (Texto Turquesa, subrayado): Enlaces de texto puro sin padding de botón.

### 4. Patrones de Maquetación: Calendario Adaptativo (Liquid Layout)
Para cumplir con la Heurística de Diseño Minimalista y evitar el "Broken Layout", los contenedores de tipo calendario/grilla dinámica deben usar un patrón líquido:
* **Cero anchos fijos:** Las columnas (ej. días) NUNCA deben tener un ancho estricto en píxeles.
* **Expansión Equitativa:** El contenedor usa `display: flex;` y las columnas usan `flex: 1 1 0;` para expandirse y dividirse el 100% del ancho, sin importar si hay 1 o 5 elementos.
* **Ley de Fitts en Botones:** Los botones internos de selección (ej. horarios) deben tener `width: 100%` para maximizar su área interactiva dentro de la columna expandida.

### 5. Breakpoints Responsivos Oficiales
Todo el sistema debe respetar estrictamente los siguientes puntos de ruptura (Media Queries) definidos en los lineamientos del proyecto:
* **Escritorio:** `min-width: 1024px`
* **Tablets:** Entre `768px` y `1023px`
* **Móviles (Celulares):** `max-width: 767px` (El límite mínimo es 320px).

* **Patrón de Edición Continua:** Los modales o vistas de edición múltiple (como "Editar Perfil") NUNCA deben cerrarse automáticamente tras guardar un cambio. El usuario debe mantener el control y ser quien cierre explícitamente la ventana. Se debe compensar con feedback visual in-line (H1).


## 6. Estándares de Retroalimentación de Éxito (Puntos Finales)

Para cerrar correctamente el ciclo cognitivo del usuario (H1), el sistema aplicará los siguientes patrones según la acción:

1. **Pantallas de Éxito (Redirección):** Para acciones mayores.
   * *Crear Cuenta:* Redirigir al `Home` o `Login` con un mensaje de bienvenida.
   * *Agendar Cita:* Redirigir al `Paso 5 (Confirmación)` con el resumen y código.
2. **Toasts Asíncronos (Feedback no obstructivo):** Para acciones de actualización.
   * *Modificar Cita / Editar Perfil:* Inyectar mensaje temporal (3 segundos) sin cambiar de vista ni requerir clics adicionales.
3. **Modales de Resolución:** Para acciones destructivas.
   * *Cancelar Cita:* Modal de confirmación previa -> Cambio a estado de éxito -> Redirección obligatoria al Dashboard al cerrar.

* **H1 - Punto Final de Registro:** La confirmación de "Cuenta creada" debe aparecer ÚNICAMENTE tras la validación exitosa del código de verificación. Es el cierre del ciclo cognitivo. Queda prohibido navegar al Home o Login antes de que el usuario vea y acepte esta pantalla de éxito.

* **Feedback Contextual y Adaptativo:** Los mensajes de éxito deben reflejar la intención específica del usuario. Si la acción fue una modificación, el mensaje debe usar términos como "Reagendada" o "Actualizada". Se prohíbe el uso de mensajes genéricos que oculten la naturaleza de la transacción realizada.

* **Botones de Documento (`.btn--documento`):** Deben tener borde y texto en color Turquesa (`#0DA99F`) con fondo transparente o blanco. Se usan exclusivamente para acciones de portabilidad ("Descargar PDF" e "Imprimir"). Deben incluir siempre un icono representativo (`fa-file-pdf` o `fa-print`) para rápida identificación visual (H4 - Consistencia y Estándares).

### Manejo de Eventos en Templates (Prevención de XSS y Colisiones)
* **Paso de Parámetros Seguros:** Queda ESTRICTAMENTE PROHIBIDO inyectar objetos completos convertidos a cadena (ej. `JSON.stringify`) dentro de atributos de eventos HTML en línea (como `onclick`). 
* **Regla de Delegación:** En los templates literales, los manejadores de eventos solo deben recibir identificadores primitivos (strings simples, IDs o números). La función receptora será responsable de buscar el objeto completo en el estado (`this._citas`, `localStorage`, etc.) utilizando dicho ID.