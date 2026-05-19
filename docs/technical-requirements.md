# Requisitos Técnicos y Arquitectura (Technical Requirements)

## 1. Stack Tecnológico Front-end
* **Lenguajes:** HTML5, CSS3, Vanilla JavaScript (ES6+).
* **Restricción de Frameworks:** PROHIBIDO el uso de React, Angular, Vue o librerías UI (Bootstrap/Tailwind).
* **Librerías Permitidas:** Solo `html2pdf.js` para generación de comprobantes.

## 2. Estructura de Archivos
* `/index.html`: Estructura SPA principal, modales y vistas inyectables.
* `/css/styles.css`: Hoja de estilos única.
* `/js/main.js`: Controlador principal y Entry Point (Módulo ES6).
* `/js/estado.js`: Gestor de estado global.
* `/js/modulos/`: Directorio de módulos lógicos (`citas.js`, `salud.js`, `utilidades.js`).
* `/js/data.js`: Base de datos simulada y funciones de inicialización.

## 3. Modelos de Datos Actuales (LocalStorage)
La persistencia actual es LocalStorage (con miras a migración a Firebase). La estructura JSON debe respetarse estrictamente:

**A. sanitas_usuarios**
`[{ identificacion (String 10), password, nombre_1, nombre_2, apellido_1, apellido_2, fecha_nacimiento (YYYY-MM-DD), sexo, celular (String 10, inicia 09), email }]`

**B. sanitasFam_db -> cartera_especialistas**
`[{ id, especialidad, doctor: { nombres, apellidos, nombre_completo, cedula }, actividades: [] }]`

**C. sanitas_citas**
`[{ id_cita, cedula_paciente, id_especialidad, id_medico, fecha (YYYY-MM-DD), hora (HH:MM), codigoSeguimiento (String 6 char, ej: CIT-X8), estado (Activa/Cancelada) }]`

## 4. Reglas de Validación de Negocio (Blindaje)

### A. Registro de Usuarios (Edad)
* **Requisito:** Solo mayores de edad (>= 18 años) y hasta 90 años.
* **Lógica Técnica:** - `Fecha Máxima (DOB):` Hoy - 18 años (Permite a quienes cumplen hoy).
  - `Fecha Mínima (DOB):` Hoy - 90 años.
* **Acción:** Aplicar a los atributos `min` y `max` del input de fecha de nacimiento.

### B. Gestión de Citas (Rango Temporal)
* **Requisito:** Agendamiento y consulta limitados a un rango de 2 meses.
* **Lógica Técnica:**
  - `Fecha Mínima (Cita):` Hoy (No permite citas pasadas).
  - `Fecha Máxima (Cita):` Hoy + 60 días (2 meses). 

### C. Regla BR-1 (Blindaje de Tipos)
* **Formato Obligatorio:** Toda comparación de fechas para la regla BR-1 debe realizarse exclusivamente en formato ISO (`YYYY-MM-DD`). 
* **Acceso a Datos:** En el bucle de validación sobre `sanitas_citas`, el campo identificador es `cedula_paciente`. Está prohibido usar `c.cedula` si el objeto no tiene esa propiedad.



## 5. Decisiones Arquitectónicas y de Seguridad (Blindaje de IA)
Esta sección contiene patrones de diseño obligatorios implementados en el código. NINGUNA refactorización debe alterar este comportamiento:

* **A. Stateful Redirect (Enrutamiento Post-Login):** Tras un inicio de sesión, el sistema lee `vista_origen` del `sessionStorage` y retorna al usuario a su pantalla anterior. 
  * *Excepción 1:* Si viene de 'registro', va al 'home'.
  * *Excepción 2:* Si viene de 'citas' (Paso 3) como invitado, salta automáticamente al Paso 4 asumiendo que la cita es para el titular.
* **B. Hidden Form Pattern (Login):** Los inputs visibles de login NO están en un `<form>`. Al tener éxito, los datos se copian a un formulario oculto (`#hidden-login-form`) al que se le hace `.submit()` interceptado con `e.preventDefault()` para activar el guardado de contraseñas del navegador sin error HTTP 405.
* **C. Auto-Save Efímero y Seguridad:** * El formulario de Registro guarda borradores en `sessionStorage` con un TTL (Time-To-Live) de 3 minutos, destruyéndose al expirar o al detectar `visibilitychange` (usuario regresa a la pestaña).
  * Los campos de Login se vacían estrictamente al abandonar la vista.
* **D. Edición Continua Asíncrona (Perfil):** Los formularios de actualización múltiple NO se auto-cierran. Al guardar, el botón se deshabilita (`disabled = true`), muestra "Guardando...", simula latencia y luego muestra un mensaje de éxito que desaparece a los 3 segundos.
* **E. Smart Jumps (Calendario Móvil):** En pantallas `<= 767px`, el calendario usa un bucle `while` para saltar automáticamente los días sin atención y mostrar el primer día laborable disponible.
* **F. Navegación Secuencial Determinista (Regla de Oro de Retorno):**
  La función `irAtras()` y los botones `.btn-back-minimalist` deben seguir estrictamente el orden inverso del flujo activo:
  * **Flujo Invitado/Proxy:** 4 (Revisión) -> 3 (Datos) -> 2 (Calendario) -> 1 (Médicos) -> 0 (Especialidad).
  * **Flujo Titular Logueado:** 4 (Revisión) -> 2 (Calendario) -> 1 (Médicos) -> 0 (Especialidad). (Nota: El paso 3 se omite).
  * **Prohibición:** Está terminantemente prohibido que un botón "Volver" navegue hacia un paso superior al actual (ej. de 2 a 4) o que use `app.navegar()` si el cambio es interno del módulo de citas.

* **G. Salto de Paso Condicional (Asimetría de Retorno):**
  - **Avance:** Si una especialidad tiene exactamente un (1) médico, el flujo salta automáticamente del Paso 0 (Especialidad) al Paso 2 (Calendario).
  - **Retorno (Regla Crítica):** La función `irAtras()` debe reflejar este salto. Si el usuario está en el Paso 2 y la especialidad seleccionada tiene solo 1 médico, el retroceso debe apuntar obligatoriamente al Paso 0. El texto del botón de retroceso en el Paso 2 debe adaptarse dinámicamente a este destino.

## 6. Estándares de Validación y Eventos
* **Regex Whitelisting (`input` event):** Campos de búsqueda blindados en tiempo real contra XSS/SQLi permitiendo solo caracteres alfabéticos.
* **Feedback Contextual (`blur` event):** La validación de formularios DEBE ejecutarse al perder el foco y proporcionar mensajes granulares (H9). **REGLA CRÍTICA:** La validación NO debe ignorar los campos vacíos. Si el evento `blur` ocurre y el campo está vacío (`""`), debe inyectar el error de "campo obligatorio".
* **Persistencia de Errores:** Una vez que un campo muestra un error, este no debe desaparecer hasta que el usuario corrija el valor.
* **Sanitización en Tiempo Real:** Los campos de búsqueda y nombres deben usar Regex en el evento `input` para impedir físicamente la entrada de caracteres no permitidos (Whitelist).
* **Mensajes Granulares:** No usar mensajes genéricos. El sistema debe distinguir entre "Campo vacío", "Formato incorrecto" y "Valor inválido por lógica de negocio".
* **Aislamiento de Validación (Atomic Blur):** El evento `blur` debe ser atómico. Solo se debe validar y mostrar error en el elemento específico que perdió el foco (`event.target`). Está PROHIBIDO disparar validaciones visuales en campos que el usuario aún no ha visitado o modificado.
* **Estándar de Generación:** Queda PROHIBIDO descargar o imprimir capturas directas del DOM de la interfaz de usuario (UI). Todo documento debe generarse a partir de una plantilla HTML limpia e independiente (`_generarTicketHTML` o `_generarRecetaHTML`) inyectada en una ventana efímera o procesada por jsPDF con coordenadas fijas.
* **Validación de Colisiones por Identidad:**
  - El sistema debe permitir la selección de cualquier horario disponible en la agenda del médico en el Paso 2.
  - La lógica de "Cruce de horarios del paciente" se debe encapsular en una función que reciba `(cedula, fechaISO, horaInicio, duracion)`.
  - Esta función solo se invoca en los puntos de validación de identidad (Pasos 3 y 4).

* **Resolución de Nombre del Paciente (H2/H5):**
  - **Lógica de Selección:**
    1. Si `modoProxy` es TRUE: Usar los nombres/apellidos del formulario del Paso 3.
    2. Si `modoProxy` es FALSE: Concatenar `nombre_1` + `apellido_1` del `usuarioActivo`.
  - **Fallback de Seguridad:** Si el objeto de usuario está vacío o indefinido por error de sesión, el sistema debe mostrar un valor genérico pero digno (ej. "Usuario Sanitas") en lugar de un string técnico como "null" o "undefined".


## 7. Interfaz de Calendario: Restricciones y Consistencia
* **C1. Límite Dinámico de Retroceso (Ocultamiento de Affordance):** El sistema bloquea el retroceso a fechas anteriores al "Primer Día Disponible".
* **Comportamiento Visual:** Para evitar affordances falsos (botones que invitan al clic pero no funcionan), el botón de "Día anterior" (`.calendar-nav-btn`) DEBE ocultarse usando `visibility: hidden` cuando la fecha en pantalla sea igual al origen de disponibilidad (`fechaLimiteMinima`). NO usar `display: none` para no romper el centrado del layout. El botón volverá a `visibility: visible` al avanzar a días futuros.
* **C2. Smart Jumps (Disponibilidad Real - H7):** Al inicializar el calendario o cambiar de especialista, el sistema debe garantizar que la vista inicial sea un día con slots interactuables. 
* **Criterio de Éxito:** Un día se considera "hábil" solo si: 
    1. El médico atiende en esa fecha (pertenece a `diasLaborables`).
    2. Existe al menos un slot cuya hora sea posterior a la hora actual del sistema (`slot_time > Date.now()`).
    3. El slot no está ocupado en el `localStorage`.
* **Lógica:** El sistema debe iterar (máximo 14 días) hasta que se cumplan estas tres condiciones simultáneamente.
* **C3. Empty States Estandarizados (H4):** Los días sin horarios deben renderizar UN SOLO estilo: un contenedor centrado con un ícono (`fa-calendar-xmark` o similar) y el texto "No hay horarios disponibles para este día". Queda prohibido el uso de mini-recuadros grises.

## 8. Generación de Documentos y Portabilidad
* **Impresión Nativa:** Se debe usar `window.print()`. Requiere obligatoriamente una regla `@media print` en CSS que oculte barras de navegación, botones y fondos innecesarios, dejando solo el contenido limpio de la cita o receta.
* **Descarga PDF:** Se implementará mediante la librería externa `html2pdf.js`. El archivo debe adoptar un naming convention dinámico (ej. `Cita_Sanitas_[Fecha].pdf`).
* **Estándar de Generación (Aislamiento Total):** Queda ESTRICTAMENTE PROHIBIDO descargar o imprimir capturas directas del DOM (interfaz de usuario). Todo documento PDF o de impresión debe generarse a partir de una "Plantilla HTML Aislada" (`_generarTicketHTML`, `_generarRecetaHTML`) inyectada en una ventana efímera (`window.open`), o procesada nativamente por `jsPDF` utilizando coordenadas absolutas.

## 9. Arquitectura Modular (ES6 Modules)
El código Javascript debe estar estrictamente modularizado para evitar un archivo monolítico. Se prohíbe el uso de un objeto global gigante `const app = {}`.

### A. Estructura de Directorios JS
* `/js/main.js`: Punto de entrada (Entry point). Maneja la inicialización global, el enrutador (`navegar`) y el carrusel principal.
* `/js/estado.js`: Módulo de gestión de estado global. Debe exportar un objeto reactivo o variables let/const para compartir `usuarioActivo`, `citas` y `recetas` entre módulos.
* `/js/modulos/citas.js`: Lógica exclusiva del calendario, smart jumps, y agendamiento.
* `/js/modulos/salud.js`: Lógica exclusiva del dashboard, historial médico y detalle de recetas.
* `/js/modulos/utilidades.js`: Funciones puras (PDFs, impresión, validaciones de formato de celular, sanitización Regex).

### B. Reglas de Importación
* Todas las importaciones deben incluir la extensión `.js` (ej. `import { imprimirCita } from '../modulos/utilidades.js';`).
* El archivo `/index.html` DEBE cargar el script principal como módulo: `<script type="module" src="js/main.js"></script>`. Se deben eliminar las llamadas a funciones globales desde el HTML (como los `onclick=""`), reemplazándolas por Event Listeners dentro de sus respectivos módulos, o exponiéndolas explícitamente en el objeto `window` si es estrictamente necesario para el Liquid Layout actual.

### C. Contratos de Datos y Normalización (Data Mapping)
* **Normalización Obligatoria:** Cuando se transfieran datos entre módulos aislados (ej. desde el `localStorage` de Invitados hacia las funciones globales de `app.utilidades`), el agente DEBE normalizar el objeto.
* **Prevención de Fugas (Placeholder Leaks):** Antes de inyectar un objeto en un template de UI o en un generador de documentos (PDF/Impresión), se deben mapear explícitamente las propiedades clave (ej. asegurar que `cita.paciente` contenga el valor real uniendo `nombres` o `nombrePaciente`). Está prohibido pasar objetos crudos si sus claves no coinciden exactamente con la firma de la función receptora.

---

## 10. Estándares de Accesibilidad Estricta (WAI-ARIA y POUR)

Esta sección es **OBLIGATORIA** y protege el cumplimiento WCAG 2.2 nivel AA del proyecto. Ninguna refactorización, nueva funcionalidad o corrección de bugs puede degradar estos estándares. Cada regla tiene su implementación de referencia en el código actual.

---

### A. Focus Rings `:focus-visible` y Focus Trap en Modales

**Regla:** El sistema de foco de teclado se gestiona exclusivamente con `:focus-visible`, nunca con `:focus`. Está **PROHIBIDO** escribir `outline: none` o `outline: 0` sobre un selector que aplique a todos los estados de foco (debe ser siempre `:focus:not(:focus-visible)`).

**Implementación de referencia** (`css/styles.css`):
```css
/* CORRECTO — suprime solo foco por click, no por teclado */
*:focus:not(:focus-visible) { outline: none; }

/* Botones primarios: anillo blanco + sombra corporativa (alto contraste) */
.btn--primario:focus-visible,
.btn--accion:focus-visible {
    outline: 3px solid var(--white);
    outline-offset: 3px;
    box-shadow: 0 0 0 5px var(--action-color);
}

/* Inputs: glow sin outline, respeta border-radius */
input:focus-visible {
    outline: none;
    border-color: var(--action-color) !important;
    box-shadow: 0 0 0 3px rgba(13, 169, 159, 0.22) !important;
}
```

**Focus Trap en Modales** (`js/main.js` → `_initModalAccessibility()`):
* Todo modal con `role="dialog"` o `role="alertdialog"` **DEBE** atrapar el foco al interior. La tecla `Tab` y `Shift+Tab` deben ciclar únicamente entre los elementos focusables del modal.
* La tecla `Escape` **DEBE** cerrar el modal, salvo en modales con `role="alertdialog"` (decisión obligatoria del usuario).
* Al cerrar el modal, el foco **DEBE** retornar al elemento que lo abrió (`_triggerElement`).
* Implementación: `_initModalAccessibility()` se llama **una sola vez** en `app.init()` mediante delegación de eventos en `document`.

---

### B. Gestión de Foco en SPA (Cambio de Vista)

**Regla:** Cada vez que el router `navegar()` muestra una nueva vista, **DEBE** mover el foco al encabezado principal (`h1` o `h2`) de esa vista para que los lectores de pantalla anuncien el cambio de contexto. El encabezado receptor **no** debe tener `tabindex` en el HTML estático; se añade programáticamente y se elimina tras el foco.

**Implementación de referencia** (`js/main.js` → `_enfocarEncabezadoVista(vistaId)`):
```js
_enfocarEncabezadoVista(vistaId) {
    requestAnimationFrame(() => {
        const vista = document.getElementById(`view-${vistaId}`);
        if (!vista) return;
        const heading = vista.querySelector('h1, h2');
        if (!heading) return;
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: false });
        heading.addEventListener('blur', () =>
            heading.removeAttribute('tabindex'), { once: true });
    });
}
```
* `requestAnimationFrame` es **obligatorio** para garantizar que el DOM esté pintado antes de mover el foco.
* Esta función se llama al **final** de `navegar()`, después de mostrar la vista destino.

---

### C. Semántica de Pestañas WAI-ARIA APG (Keyboard Navigation)

**Regla:** Cualquier conjunto de pestañas (tabs) **DEBE** implementar el patrón APG Tab completo. Está **PROHIBIDO** usar solo `aria-pressed` en botones que actúan como pestañas.

**Requisitos de marcado obligatorio:**

| Elemento | Atributos obligatorios |
|---|---|
| Contenedor de pestañas | `role="tablist"` + `aria-label` o `aria-labelledby` |
| Cada botón de pestaña | `role="tab"` + `aria-selected="true/false"` + `aria-controls="[id-panel]"` |
| Cada panel de contenido | `role="tabpanel"` + `aria-labelledby="[id-tab]"` |
| `<li>` envolvente (si existe) | `role="presentation"` |

**Navegación de teclado obligatoria** (implementada en `js/modulos/salud.js`):
* `ArrowRight` / `ArrowDown` → mueve el foco a la siguiente pestaña y la activa.
* `ArrowLeft` / `ArrowUp` → mueve el foco a la pestaña anterior y la activa.
* `Enter` / `Space` → activa la pestaña enfocada.
* El ciclo es continuo (al llegar al último vuelve al primero y viceversa).
* El registro de `keydown` se hace con un guard (`_sidenavKeyboardInited`) para evitar duplicados.

**Actualización dinámica de ARIA:** la función `mostrarSeccion(seccion)` en `salud.js` **DEBE** usar `setAttribute('aria-selected', true/false)`. El uso de `aria-pressed` en este contexto está **PROHIBIDO**.

---

### D. Inyección Segura de Documentos: `<iframe>` Oculto en lugar de `window.open()`

**Regla:** La impresión nativa **DEBE** realizarse mediante un `<iframe>` oculto pre-existente en el DOM, **no** con `window.open()`. El uso de `window.open()` para impresión está **PROHIBIDO** en este proyecto porque los bloqueadores de popups impiden su ejecución y rompen la experiencia del usuario.

**Implementación de referencia** (`js/modulos/utilidades.js` → `imprimirCita` / `imprimirReceta`):
```js
// IDs reservados en el DOM para impresión:
// <iframe id="__sanitas_print_cita__" ...>
// <iframe id="__sanitas_print_receta__" ...>

function imprimirConIframe(iframeId, htmlContent) {
    let frame = document.getElementById(iframeId);
    if (!frame) {
        frame = document.createElement('iframe');
        frame.id = iframeId;
        frame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:0;';
        document.body.appendChild(frame);
    }
    frame.srcdoc = htmlContent;
    frame.onload = () => { frame.contentWindow.focus(); frame.contentWindow.print(); };
}
```
* La plantilla HTML inyectada en el `iframe` **DEBE** ser autónoma (`_generarTicketHTML`, `_generarRecetaHTML`) y no capturar el DOM visible de la interfaz.
* Los PDFs se siguen generando con `html2pdf.js`.

---

### E. Formularios Estrictos (WCAG 1.3.1, 1.3.5, 3.3.1, 3.3.2)

Todo `<input>`, `<select>` o `<textarea>` con validación dinámica **DEBE** cumplir las siguientes tres reglas simultáneamente:

**E.1 — Vinculación de errores (`aria-describedby`)**
```html
<!-- CORRECTO -->
<input id="campo" aria-describedby="campo-error" aria-required="true">
<span id="campo-error" role="alert" style="display:none;"></span>
```
* El `id` del `<span>` de error **DEBE** coincidir exactamente con el valor `aria-describedby` del input.
* El span **DEBE** tener `role="alert"` para que sea anunciado automáticamente por lectores de pantalla al aparecer.
* Está **PROHIBIDO** mostrar errores solo visualmente sin actualizar el span vinculado.

**E.2 — Propósito del campo (`autocomplete` — WCAG 1.3.5)**

Tokens obligatorios por tipo de campo:

| Campo | Token `autocomplete` |
|---|---|
| Primer nombre | `given-name` |
| Segundo nombre | `additional-name` |
| Primer apellido | `family-name` |
| Segundo apellido | `off` (sin token estándar en WCAG 1.3.5) |
| Cédula / ID nacional | `off` (sin token estándar) |
| Teléfono / Celular | `tel` |
| Email | `email` |
| Contraseña actual | `current-password` |
| Contraseña nueva | `new-password` |
| Código OTP / verificación | `one-time-code` |
| Fecha de nacimiento | `bday` |
| Sexo | `sex` |
| Usuario / Username | `username` |
| Búsqueda (sin persistir) | `off` |

**E.3 — Campos obligatorios (`aria-required`)**
* Todo campo requerido por lógica de negocio **DEBE** tener `aria-required="true"` además del atributo HTML `required`.
* El atributo HTML `required` controla la validación nativa del navegador; `aria-required="true"` comunica la obligatoriedad a tecnologías asistivas que ignoran el atributo HTML nativo.

---

### F. Íconos Decorativos y Regiones Dinámicas

**F.1 — Íconos FontAwesome (`aria-hidden`)**
* Todo ícono `<i class="fa-...">` puramente decorativo (que acompaña texto visible) **DEBE** tener `aria-hidden="true"`.
* Los botones que contienen **únicamente** un ícono (sin texto visible) **DEBEN** tener un `aria-label` descriptivo en el elemento `<button>`, y el ícono interno **DEBE** tener `aria-hidden="true"`.

```html
<!-- CORRECTO: ícono decorativo junto a texto -->
<button aria-label="Cerrar modal">
    <i class="fa-solid fa-xmark" aria-hidden="true"></i>
</button>

<!-- PROHIBIDO: ícono sin aria-hidden ni aria-label en el botón -->
<button><i class="fa-solid fa-xmark"></i></button>
```

**F.2 — Regiones dinámicas (`aria-live`)**

Cualquier contenedor cuyo contenido se actualice mediante JavaScript sin recarga de página **DEBE** tener `aria-live`:

| Contenedor | Valor | Razón |
|---|---|---|
| Listados de citas/recetas | `aria-live="polite"` | Actualización no urgente |
| Grids de productos/especialistas | `aria-live="polite"` | Búsqueda/filtrado |
| Grilla del calendario de citas | `aria-live="polite"` | Cambio de semana |
| Etiqueta del mes en calendario | `aria-live="polite"` + `aria-atomic="true"` | El mes cambia como unidad |
| Detalle de cita/receta (maestro-detalle) | `aria-live="polite"` | Navegación interna |
| Mensajes de éxito en formularios | `role="status"` + `aria-live="polite"` | Confirmación no urgente |
| Errores críticos / alertas | `role="alert"` (implica `aria-live="assertive"`) | Urgente, interrumpe |

**F.3 — Bypass Block (Skip Link)**
* El primer elemento dentro de `<body>` **DEBE** ser siempre el skip link:
```html
<a href="#main-content" class="skip-link">Saltar al contenido principal</a>
```
* Visualmente oculto (`top: -100%`) hasta recibir foco, momento en que aparece con estilos de alto contraste.
* El destino (`#main-content`) **DEBE** existir en el DOM como `id` del elemento `<main>`.

**F.4 — Barra de Progreso de Citas**
* Los pasos completados **DEBEN** incluir `<span class="sr-only">Completado</span>` junto al ícono de check.
* El paso activo **DEBE** tener `aria-current="step"` en su elemento contenedor.
* Los números de paso deben estar en `<span aria-hidden="true">` para que el lector de pantalla no los repita si el label ya los describe.

---

### G. Checklist de Revisión de Accesibilidad

Antes de entregar cualquier cambio que afecte HTML, CSS o JS interactivo, verificar:

- [ ] Todos los `<input>` con validación tienen `aria-describedby` apuntando a su `<span role="alert">`.
- [ ] Todos los `<input>` obligatorios tienen `aria-required="true"`.
- [ ] Todos los `<input>` tienen un token `autocomplete` apropiado (o `autocomplete="off"` explícito).
- [ ] Todos los íconos decorativos tienen `aria-hidden="true"`.
- [ ] Todos los botones icon-only tienen `aria-label` descriptivo.
- [ ] Los contenedores actualizados por JS tienen `aria-live="polite"` (o `role="alert"` si es urgente).
- [ ] Los conjuntos de pestañas usan `role="tablist"` / `role="tab"` / `role="tabpanel"` con navegación por flechas.
- [ ] Los modales tienen `role="dialog"` + `aria-modal="true"` + `aria-labelledby` + Focus Trap.
- [ ] El router SPA llama a `_enfocarEncabezadoVista()` al final de cada cambio de vista.
- [ ] La impresión usa `<iframe>` oculto, nunca `window.open()`.
- [ ] El skip link `<a href="#main-content" class="skip-link">` es el primer hijo de `<body>`.
- [ ] El `<meta name="viewport">` **no** contiene `maximum-scale` ni `user-scalable=no`.

## 11. Seguridad y Sanitización OWASP (Defensa en Profundidad)

Para prevenir XSS e Inyecciones (OWASP Top 10) y prevenir errores del usuario (H5), todos los inputs deben ser sanitizados en tiempo real:

* **A. Nombres y Apellidos:** Lista blanca de letras (A-Z, a-z), tildes (á, é, í, ó, ú) y la letra ñ/Ñ. Se permite un (1) espacio simple entre palabras. **Prohibido:** Números, símbolos, espacios al inicio/final o espacios múltiples consecutivos.
* **B. Cédula y Teléfono Celular:** Exclusivamente numérico (0-9). **Prohibido:** Letras, espacios y símbolos.
* **C. Pasaporte:** Alfanumérico. **Prohibido:** Espacios y símbolos especiales.
* **D. Correo Electrónico y Contraseña:** Bloqueo absoluto de espacios en blanco en cualquier posición.
* **E. Textos Libres (Motivo de consulta):** Escapado estricto de entidades HTML (reemplazar `<`, `>`, `&`, `"`, `'`) en tiempo real para evitar XSS.
* **F. Antispam Global:** Ningún campo puede enviarse vacío o compuesto únicamente por espacios.
* **G. Disparadores (Triggers):** 1. Evento `input`: Bloqueo físico en tiempo real (Regex reemplaza caracteres no deseados mientras el usuario teclea).
    2. Evento `blur`: Aplica `.trim()` para limpiar espacios residuales al perder el foco.

## 12. Gestión de Foco y Scroll en Formularios (SPA)
* **Scroll Automático (UX):** Al transicionar entre pasos en un formulario multi-paso (Registro, Agendamiento), el sistema DEBE resetear el scroll de la ventana hacia la parte superior (`window.scrollTo({ top: 0, behavior: 'smooth' })`) o enfocar el título del nuevo contenedor. Esto previene la desorientación del usuario y cumple con la gestión de foco establecida en el diseño centrado en el usuario.

## 13. Estándares de Tiempo y Fechas de Nacimiento (H3, H5)

Para prevenir errores lógicos y cumplir con la legalidad de uso del software:
* **Titulares de Cuenta:** Deben tener un mínimo de 18 años y un máximo de 120 años.
* **Pacientes/Familiares (Dependientes):** Pueden tener desde 0 años (nacidos hoy) hasta 120 años.
* **Prevención de Errores (H5):** Los inputs tipo `date` deben tener los atributos `min` y `max` calculados dinámicamente vía JavaScript al cargar la página (para evitar fechas futuras como 2030).
* **Validación de Capa 2:** Independientemente de los límites del HTML, el evento `submit` del formulario debe validar la fecha mediante JS puro para prevenir manipulaciones del DOM (DevTools).
* **Control y Libertad (H3):** El usuario debe ser capaz de editar su fecha de nacimiento en el módulo de "Mi Perfil" en caso de cometer un error tipográfico dentro del rango válido.

## 14. Integridad de Vistas y Enrutamiento (H3)
* **Persistencia de Plantillas:** Queda prohibido eliminar o modificar los bloques de plantillas HTML (Template Strings) de las vistas principales (Login, Registro, Home, Citas) sin una orden explícita de rediseño.
* **Verificación de Navegación:** Cualquier cambio en la lógica global de `app.js` o `main.js` debe validar que la función `app.navegar()` siga teniendo acceso a todos los contenedores de vista.

## TR-14: Persistencia de Estado en Flujo de Citas (MPA)
1. **Regla de Oro:** Todo el progreso del agendamiento (paso actual, especialidad seleccionada, médico, fecha y hora) DEBE persistir en `sessionStorage` bajo la clave `sanitas_cita_en_progreso`.
2. **Lógica de Re-entrada:** Al cargar `citas.html`, el módulo `citas.js` debe verificar si existe un proceso previo. Si existe, debe saltar automáticamente al paso guardado.
3. **Sincronización de Identidad:** - Si el usuario está en el Paso 2 (Formulario de Invitado) e inicia sesión, el sistema DEBE detectar el cambio de estado de `usuarioActual`.
   - Al estar logueado, el Paso 2 debe omitirse automáticamente y llevar al usuario directamente al Paso 4 (Revisión), inyectando los datos del perfil del usuario en la cita.
4. **Protección de Renderizado:** Nunca debe mostrarse un paso si los datos necesarios (especialidades o médicos) no han terminado de cargarse. Usar `async/await` para asegurar que la data de los JSON esté lista antes de ejecutar `_irAPaso()`.
5. **Prohibición de Redirecciones Vacías:** Si `app.navegar('citas')` se invoca tras un login, debe heredar los parámetros de paso previo para evitar volver al Paso 1 por defecto.

## TR-15: Lógica de Navegación Retroactiva (Botón Volver)
1. **Validación de Salto:** El botón "Volver" no debe restar -1 al paso actual de forma ciega. Debe consultar el `historialPasos` (array en memoria/sesión).
2. **Caso Especial 1 Médico:** Si una especialidad tiene solo 1 médico, el "Paso de Selección de Médico" DEBE marcarse como omitido. Al volver desde el calendario, el sistema debe saltar directamente a "Selección de Especialidad".

## TR-16: Sinceridad en el Indicador de Progreso (WCAG 2.2)
1. **Pasos Dinámicos:** El número total de pasos en la barra de progreso DEBE ser dinámico. 
   - Si la especialidad tiene >1 médico: Mostrar 5 pasos (Especialidad, Médico, Calendario, Datos, Revisión).
   - Si tiene 1 médico: Mostrar 4 pasos (Especialidad, Calendario, Datos, Revisión).
2. **Claridad Semántica:** El texto para lectores de pantalla (`.sr-only`) debe anunciar el número real de pasos para no confundir al usuario no vidente.

## TR-17: Estabilidad e Integridad de la Barra de Progreso (Heurística #1 y #4)
1. **Sinceridad Absoluta (Sin mutaciones):** La barra de progreso NUNCA debe cambiar su longitud o sus etiquetas en medio del flujo. Los hitos deben calcularse en el Paso 0 y mantenerse idénticos hasta el final.
2. **Paso Final Obligatorio:** El paso de "Confirmación" (o "Éxito") DEBE estar visible en la barra de progreso desde el momento en que el usuario inicia el flujo.
3. **Cálculo de Contexto Persistente:** Para determinar si se muestra el paso "Médico" (cuando hay >1 doctor), el sistema debe leer el ID de la especialidad desde `_citaTemporal.especialidad` en CUALQUIER paso (incluyendo Revisión y Confirmación) para no perder el contexto.

## TR-18: Navegación Estricta por Historial (Botón Volver)
1. **Prohibido el salto ciego:** La función de retroceso (`irAtras` o `volverAlPasoAnterior`) no debe restar índices fijos ni adivinar. DEBE hacer un `pop()` del array `historialPasos` que guarda exactamente el ID del paso DOM anterior por el que pasó el usuario.
2. Si `historialPasos` indica que el usuario vino del Paso 1 (Médicos), el botón "Volver" en el Calendario DEBE decir "Volver a Médicos" y llevarlo a ese DOM.

## TR-19: Persistencia del Estado de Éxito (Paso 5)
1. **Inmunidad del Ticket:** Una vez que la cita ha sido confirmada y se genera el ticket (resumenTicketConfirmado), este estado DEBE ser inmune a la recarga de página o al cambio de sesión (login) mientras el usuario permanezca en `citas.html`.
2. **Prioridad de Recuperación:** En la función `_recuperarEstadoCita`, la presencia de un `resumenTicketConfirmado` en el snapshot de persistencia debe tener la máxima prioridad. Si existe, el sistema DEBE saltar directamente al Paso 5 y renderizar el ticket, ignorando cualquier otro paso guardado.
3. **Limpieza Diferida:** La eliminación de la clave `sanitas_cita_en_progreso` SOLO debe ocurrir cuando el usuario presiona explícitamente el botón "Finalizar" o cuando navega físicamente a otra página que no sea `login.html`.

## TR-20: Salidas Claras en Pantallas de Éxito (Heurística #3)
1. **Múltiples Vías de Navegación:** Las pantallas de confirmación final (como el Paso 5 de citas) NUNCA deben tener un solo botón de "Finalizar". 
2. **Botones Obligatorios:** Deben proveer al menos dos salidas contextuales:
   - Acción Principal (ej. "Ver Mis Citas").
   - Acción Secundaria/Neutral (ej. "Volver al Inicio").

## TR-21: Eficiencia en Formularios (Autocomplete)
1. **Campos de Identificación:** Aunque no exista un token WCAG específico para Documentos de Identidad Nacional (Cédula), estos inputs DEBEN usar `autocomplete="on"` para aprovechar el autocompletado nativo del navegador, reduciendo la carga cognitiva y física del usuario (Heurística #7).

## TR-22: Redirección Inteligente Post-Agendamiento (Invitado vs Registrado)
1. **Diferenciación de Salida:** El botón "Ver Mi Cita" en el Paso 5 debe detectar el estado del usuario:
   - **Usuario Registrado:** Redirigir físicamente a `mi-salud.html`.
   - **Usuario Invitado:** Redirigir físicamente a `index.html`.
2. **Automatización para Invitados (Deep Linking):** - Al navegar al Home como invitado desde un éxito, el sistema DEBE persistir el `id_cita` y la `cedula` en el `sessionStorage`.
   - Al cargar `index.html`, el módulo `main.js` (Widget de Invitado) debe detectar estos datos, hacer scroll automático hasta el widget, autocompletar los campos y disparar la búsqueda de la cita automáticamente para mostrar el detalle al usuario sin que este deba escribir.
3. **Limpieza de Persistencia:** Una vez que el widget del invitado ha realizado la consulta automática, los datos temporales de "autocompletado post-cita" deben eliminarse de la sesión.

## TR-23: Integridad de Datos en Tarjetas y Detalles de Cita
1. **Prohibido el uso de Placeholders fijos:** Al renderizar tarjetas de citas o detalles (tanto en `salud.js` como en `main.js` para el widget), NUNCA se deben usar textos quemados como "Dr. Nombre". 
2. **Mapeo Estricto:** - El médico debe extraerse de `cita.medico` (incluyendo su prefijo Dr./Dra.).
   - El paciente DEBE mostrarse en la tarjeta de la cita (`Paciente: [Nombre]`) y extraerse de `cita.paciente` o `cita.nombres`.
3. **Formato de Tarjeta Original:** La tarjeta debe mantener la estructura: [Médico] | [Especialidad] | [Paciente] | [Fecha - Hora]. Ningún dato debe ser omitido.

## TR-24: Navegación Profunda en Mi Salud (Auto-Detalle)
1. **Paso de Parámetros:** Al presionar "Ver Mi Cita" siendo usuario registrado, el sistema DEBE guardar el ID de la cita recién creada en `sessionStorage` bajo la clave `sanitas_abrir_detalle_id`.
2. **Disparo de Interfaz:** Al cargar `mi-salud.html`, el módulo `salud.js` debe verificar dicha clave. Si existe, debe ejecutar automáticamente la función `verDetalleCita(id)` tras renderizar la lista, asegurando que el usuario vea el detalle sin clics adicionales.

## TR-25: Control de Visibilidad Preventivo (Widget Invitado)
1. **Estado Inicial:** El contenedor del widget de invitados en `index.html` debe tener la propiedad `style="display: none;"` de forma nativa en el HTML o mediante una clase de utilidad.
2. **Aparición Condicional:** El script de `main.js` solo debe remover el rastro de ocultamiento si y solo si `usuarioActual` es nulo. Esto evita el "efecto flash" o parpadeo del elemento desapareciendo al iniciar sesión.

## TR-26: Optimización de Rendimiento y Caché (FCP y LCP)
1. **Estrategia Cache-First para Catálogos:** Los catálogos estáticos (como la tabla `especialistas` de Supabase) NO DEBEN bloquear la interfaz con pantallas de carga en cada navegación. 
   - El sistema debe leer primero de `localStorage`.
   - Solo si el `localStorage` está vacío, se permite mostrar el spinner `conCargaGlobal()` para traer los datos de la API.
2. **Lazy Loading de Recursos Visuales:** Toda imagen inyectada dinámicamente desde JS (tarjetas de doctores, avatares, etc.) debe incluir el atributo HTML nativo `loading="lazy"` para diferir su carga y optimizar el ancho de banda, cumpliendo con las guías de optimización de recursos.

## TR-27: Protocolo de Inserción Relacional (Citas e Invitados)
1. **Existencia Previa de Paciente:** NUNCA se debe intentar un INSERT en la tabla `citas` sin confirmar que la `cedula_paciente` existe en la tabla `pacientes`. 
2. **Flujo de Registro Silencioso:** Si el usuario es Invitado o Proxy, el sistema debe realizar un `upsert` (insertar o actualizar) en la tabla `pacientes` con el flag `es_invitado: true` ANTES de proceder al insert de la cita.
3. **Mapeo de IDs:** El campo `id_especialista` en la tabla `citas` debe ser obligatoriamente el ID que viene de Supabase, no el nombre del doctor.

## TR-28: Experiencia de Carga No Invasiva (Heurística #7)
1. **Adiós a Modales Intermedios:** Se eliminan los modales de texto como "Guardando cita...". En su lugar, se usará el `conCargaGlobal()` (overlay semitransparente) solo durante la petición de red.
2. **Transición Atómica:** Al recibir éxito de la base de datos, el sistema debe ocultar la carga y mostrar el Paso 5 (Éxito) en un solo movimiento, sin clics intermedios del usuario.

## TR-29: Gestión de Foco y Scroll en Transiciones (UX)
1. **Reset Visual:** Cada vez que el usuario avanza a un nuevo paso en un formulario largo (como Registro o Agendamiento) o llega a una pantalla de éxito, el sistema DEBE forzar un `window.scrollTo({ top: 0, behavior: 'smooth' })` para asegurar que el usuario vea el inicio del nuevo contenido.

## TR-30: Prevención y Recuperación de Cuentas Duplicadas (Heurísticas #5 y #9)
1. **Prevención Temprana (Paso 1):** Al intentar avanzar del Paso 1 al Paso 2 en el Registro, el sistema debe consultar a Supabase si la `cedula` o el `correo` ya existen.
2. **Recuperación Clara (Modal):** Si los datos ya existen (ya sea detectado en el Paso 1 o por un fallo en el Paso 3), se debe mostrar un Modal o un Estado de Error amigable que explique claramente el problema y ofrezca un botón primario de "Ir a Iniciar Sesión" que redirija al usuario a `login.html`. Quedan prohibidos los mensajes de error genéricos y los "callejones sin salida".

## TR-31: Gestión de Credenciales en SPA y Accesibilidad (WCAG)
1. **Semántica Obligatoria:** Los formularios SIEMPRE deben usar la etiqueta `<form>`. Está PROHIBIDO usar `<div>` como contenedor principal de inputs, ya que viola la WCAG.
2. **Prevención de Prompts Prematuros:** Para evitar que el navegador ofrezca guardar la contraseña al cambiar de paso, todos los botones de navegación interna ("Siguiente") deben ser estrictamente `<button type="button">`. 
3. **Ghost Form para Guardado (UX):** El prompt de "Guardar contraseña" del navegador solo debe dispararse cuando Supabase confirme la creación del usuario. Se logrará inyectando un formulario temporal en el DOM con las credenciales, ejecutando `.submit()` y eliminándolo inmediatamente.

## TR-32: Sincronización Bidireccional (Single Source of Truth)
1. **Updates Seguros:** En la vista de "Editar Perfil", el sistema DEBE ejecutar primero un `UPDATE` en la tabla `pacientes` de Supabase (`await supabase.from('pacientes').update(...)`).
2. **Fallback Local:** Solo si Supabase responde con éxito, se actualizará el `localStorage`. Si falla, se lanza un error y el estado local se mantiene intacto.

## TR-33: Integridad de Credenciales en el Registro
1. **Mapeo Completo:** La función de empaquetado de datos para nuevos registros (`pacienteDesdeRegistroLocal` o similar) DEBE mapear explícitamente el campo `password` ingresado por el usuario hacia la columna `password` de Supabase.

## TR-34: Evasión de Heurísticas de Chrome (Anti-Regresión)
1. **Borrado de Memoria en DOM (Inmutable):** Bajo ninguna circunstancia se debe eliminar el hack de evasión de Chrome en la transición del Paso 2 al Paso 3 del registro. 
2. El flujo exacto y obligatorio antes de aplicar `display: none` al Paso 2 es:
   `sessionStorage.setItem('temp_pass', document.getElementById('reg-password').value);`
   `document.getElementById('reg-password').value = '';`
   Si un agente elimina esto durante una refactorización, está introduciendo un Bug Crítico (P-0).

## TR-35: Transparencia en Base de Datos (Zero Silent Failures)
1. **Updates Explícitos:** Toda operación `UPDATE` a Supabase debe manejar su propio objeto `{ error }`. Si hay error, el sistema está OBLIGADO a hacer un `alert()` o mostrar en la UI el `error.message` exacto que devuelve Supabase, para evitar fallos silenciosos en producción.

## TR-36: Prevención Heurística del Navegador (Password Prompts)
1. **Control de Credenciales:** El sistema DEBE prevenir que el navegador (Chrome, Edge, Safari) dispare el modal de "Guardar Contraseña" de forma prematura durante las transiciones visuales (ej. ocultar pasos con `display: none`).
2. **Disparo Legítimo:** El modal del navegador SOLO debe permitirse al final del flujo, cuando la base de datos (Supabase) ha confirmado la inserción exitosa del nuevo usuario. El desarrollador/agente tiene la libertad de elegir la mejor técnica técnica para lograr esto sin romper el DOM ni la accesibilidad.

## TR-37: Sincronización Estricta de Perfil (Single Source of Truth)
1. **Prioridad Backend:** Toda edición de datos del usuario (Perfil) debe seguir un flujo estricto: 
   1ro. Petición `UPDATE` a Supabase.
   2do. Si falla, detener flujo y mostrar error real.
   3ro. Si es exitoso, actualizar `localStorage` con los datos devueltos.
   4to. Reflejar visualmente en la UI (mensaje de éxito y actualización de textos).
2. **Prohibición de Falsos Positivos:** Queda prohibido mostrar mensajes de "Datos actualizados correctamente" si la transacción en Supabase no se completó.

## TR-38: Mapeo de Datos UI-DB (Data Shape Matching)
1. **Concatenación Obligatoria:** Dado que el esquema de la tabla `pacientes` en Supabase utiliza columnas unificadas (`nombres` y `apellidos`), todo formulario que recolecte estos datos de forma dividida (`nombre1`, `nombre2`, `apellido1`, `apellido2`) DEBE concatenarlos antes de ejecutar un `INSERT` o `UPDATE`.
   - `nombres` = Primer Nombre + (espacio) + Segundo Nombre
   - `apellidos` = Primer Apellido + (espacio) + Segundo Apellido
2. **Sincronización Total del Estado:** Al actualizar el perfil, el objeto `usuarioActivo` en `localStorage` debe conservar TANTO las propiedades divididas (para rellenar el formulario de edición en el futuro) COMO las propiedades unificadas (para enviar a Supabase).

## TR-39: Flujo de Recuperación de Contraseña (H9 y MPA)
1. **Arquitectura:** La recuperación de contraseña debe vivir en su propio archivo físico `recuperar.html`, sumando a la cuota de pantallas del proyecto. Debe heredar exactamente el mismo layout, CSS y clases de `login.html` para mantener la Heurística 4 (Consistencia).
2. **Proceso de 3 Fases (Divulgación Progresiva):**
   - **Fase 1:** Input de Cédula o Correo. Validar existencia en la tabla `pacientes` de Supabase.
   - **Fase 2:** Si existe, generar OTP, enviar por EmailJS y mostrar inputs para "Código OTP" y "Nueva Contraseña".
   - **Fase 3:** Validar OTP. Si es correcto, hacer `UPDATE` estricto en Supabase. Si hay éxito, mostrar mensaje y botón para ir al Login.

## TR-40: Integración de Notificaciones (EmailJS)
1. **Contrato de Variables Exacto:** Al usar `emailjs.send()`, el objeto de parámetros (payload) DEBE usar estrictamente las siguientes llaves para coincidir con la plantilla del usuario:
   - `nombre_usuario` (Nombres del paciente)
   - `correo_destino` (Email del destinatario)
   - `codigo_otp` (El código de 6 dígitos)
   Queda prohibido usar variaciones como `to_name` o `otp_code`.

## TR-41: Integridad de Identidad en Notificaciones
1. **Prohibición de Anonimato:** Queda estrictamente prohibido el uso del fallback 'Usuario' en los correos electrónicos si el dato existe en la base de datos o en el formulario.
2. **Carga Obligatoria:** Toda consulta a la tabla `pacientes` realizada para enviar un OTP DEBE incluir la columna `nombres` en el `select` de Supabase para personalizar el saludo.
3. **Sincronía de EmailJS:** El envío del correo de registro debe esperar a que el DOM esté completamente listo y las credenciales cargadas.

## TR-42: Estándares de Autenticación y Anti-Enumeración (OWASP / H5)
1. **Identificadores Únicos:** El inicio de sesión (Login) utilizará EXCLUSIVAMENTE el Documento de Identificación (Cédula o Pasaporte). La recuperación de contraseña utilizará EXCLUSIVAMENTE el Correo Electrónico.
2. **Anti-Enumeración (Seguridad):** En el formulario de Login, si las credenciales son incorrectas, el sistema tiene estrictamente PROHIBIDO indicar si el fallo fue en el usuario o en la contraseña. El mensaje de error debe ser genérico (ej. "Credenciales incorrectas") y **AMBOS campos (input de cédula y de password) deben resaltarse en rojo (clase `.input-rechazado` o `.error`) simultáneamente**, protegiendo la privacidad del sistema.

## TR-43: Enrutamiento Absoluto (H3 - Control y Libertad)
1. El botón principal de "Iniciar Sesión" en el Header (`#btn-auth`) debe funcionar contextualmente. Si el usuario no está en la página principal (`index.html` o `login.html`), el botón debe ejecutar un `window.location.href = 'login.html'` en lugar de intentar manipular el DOM local.

## TR-44: Canal Exclusivo de Recuperación y Flujo de Rescate (H3, H5, H9)
1. **Exclusividad de Input:** El proceso de recuperación de contraseña utilizará únicamente el Correo Electrónico como identificador legítimo en `#rec-identificador`. Queda descartado el uso de la cédula en este flujo.
2. **Validación de Existencia:** Antes de enviar cualquier código OTP, el sistema debe consultar en Supabase si el correo ingresado existe en la tabla `pacientes`.
3. **Modal de Rescate:** Si el correo NO existe, se bloqueará el avance y se desplegará un modal emergente con un mensaje claro (H9: "Este correo electrónico no está registrado"). El modal debe incluir dos opciones: un botón principal que redirija al formulario de registro y un botón de cancelar. El modal debe cerrarse limpiamente al dar clic en cancelar o fuera del contenedor (overlay).

## TR-45: Espaciado y Ley de Proximidad de Gestalt (H8)
1. **Respiración de la Interfaz:** Para evitar la fatiga visual y mejorar la legibilidad, la separación vertical entre elementos del formulario (`.login-field`) debe ser espaciosa (mínimo `24px`).
2. **Separación de Bloques de Acción:** Los botones de envío o gestión principal deben estar separados de los campos de texto por un espacio en blanco de seguridad de mínimo `32px`, separando claramente la entrada de datos de la ejecución de comandos.

## TR-46: Micro-Interacciones y Sanitización Física (H5, OWASP)
1. **Validación de Formato vs Existencia:** Los errores de formato (ej. cédula incompleta, correo sin '@') deben mostrarse al usuario en el evento `blur` (H5). Los errores de existencia (credenciales incorrectas) deben ser genéricos (Anti-Enumeración).
2. **Sanitización Estricta de OTP:** Los campos de códigos de verificación deben usar `e.target.value.replace(/[^0-9]/g, '')` en el evento `input` para garantizar que solo se procesen números.
3. **Límites de Contraseña:** Todo input de `password` debe tener un `maxlength="128"` por seguridad. No se deben bloquear caracteres especiales (NIST standard), pero sí se deben ignorar espacios al inicio y al final en el payload.

## TR-47: Consistencia de Componentes UI (Heurística 4 y 8)
1. **Estándar de Selectores (Dropdowns):** Queda prohibido el uso de la etiqueta nativa `<select>` en los formularios principales si ya existe un patrón personalizado. Todos los campos de selección deben usar el patrón de `<input readonly>` con un ícono de flecha (`fa-chevron-down`) que dispare un Modal inferior para elegir la opción.
2. **Estándar de Modales:** Todos los modales generados dinámicamente mediante JavaScript DEBEN utilizar estrictamente las clases CSS globales del sistema (ej. `.modal-overlay`, `.modal-content`, `.modal-header`, `.modal-body`) para heredar la estética de esquinas redondeadas, sombras y botones. Queda prohibido el uso de estilos en línea (`style="..."`) para la maquetación principal.

## TR-48: Gestión de Foco y Scroll en Errores (WCAG 2.2 / H1)
1. **Auto-Focus y Smooth Scroll:** En cualquier formulario (Registro, Perfil, Citas, Recuperación), cuando el usuario intente avanzar/enviar y exista un error de validación, el sistema DEBE interceptar la acción y hacer un scroll suave (`behavior: 'smooth'`) hacia el primer elemento inválido.
2. Además del scroll, el sistema debe aplicar `.focus()` al input correspondiente para que el usuario pueda empezar a corregir el error inmediatamente sin tener que hacer clic en él.

## TR-49: Flujo Seguro de Cambio de Contraseña (H5, Progressive Disclosure)
1. **Separación de Contextos:** La edición de la contraseña NO debe estar visible por defecto en el formulario de datos personales. Debe aislarse mediante "Divulgación Progresiva", accesible a través de un botón/enlace específico ("Cambiar contraseña") que abra un Modal dedicado.
2. **Campos de Validación (H5):** El modal debe exigir 3 campos estrictos:
   - Contraseña Actual (para validar la identidad y prevenir secuestros de sesión).
   - Nueva Contraseña.
   - Repetir Nueva Contraseña (para prevenir errores tipográficos).
3. **Validación Lógica:** Antes de consultar a Supabase, el sistema debe verificar en el Front-End que la 'Nueva Contraseña' y 'Repetir Nueva Contraseña' coincidan exactamente. Si no coinciden, aplicar el Auto-Scroll/Foco (TR-48) y mostrar error.
4. **Actualización Segura:** Si coinciden, se verifica que la 'Contraseña Actual' ingresada coincida con la de la base de datos antes de permitir el `UPDATE`.

## TR-50: Single Source of Truth (SSOT) para Citas Multi-dispositivo
1. **Prioridad Supabase:** Todas las funciones del sistema encargadas de renderizar, listar o consultar historiales de citas médicas (tanto el Panel de "Mi Salud" para usuarios registrados, como el Widget de consulta para pacientes Invitados) DEBEN realizar un `SELECT` asíncrono directo a la base de datos de Supabase en tiempo de ejecución.
2. **Prohibición de Fallbacks Locales Obsoletos:** Queda estrictamente prohibido que la UI dependa del `localStorage` o de variables en memoria local como fuente primaria de lectura para citas existentes. El estado local solo podrá actualizarse como consecuencia de una respuesta exitosa del backend en la nube, garantizando que una cita agendada en un dispositivo móvil sea visible inmediatamente en un computador de escritorio.

## TR-51: Consistencia de Esquema de Datos UI-DB
1. **Mapeo de Atributos:** Al realizar la lectura de datos desde Supabase, el payload recibido debe mapearse respetando fielmente el esquema relacional estricto de la base de datos (`cedula_paciente`, `id_especialista`, `fecha`, `hora`, `estado`, `motivo`, `tipo_consulta`).
2. **Resolución de Dependencias Visuales:** La interfaz debe cruzar el `id_especialista` obtenido con la cartera de médicos del sistema para inyectar dinámicamente el campo `nombre_completo` de la doctora o especialista en el DOM, garantizando que el usuario visualice información legible y no identificadores crípticos.

## TR-52: Gestión de Historial Nativo para Vistas Dinámicas (History API / H3)
1. **Soporte para Botón "Atrás" Móvil:** Toda vista dinámica que sobreponga contenido a la pantalla principal sin cambiar de página física (como el "Detalle de Cita" en Mi Salud, o transiciones entre pasos en formularios largos) DEBE registrar un estado en el historial del navegador utilizando `history.pushState()`.
2. **Interceptación de Retroceso (Popstate):** El sistema debe implementar un listener global para el evento `window.addEventListener('popstate')`. Si el usuario presiona el botón físico "Atrás" del celular o el botón de retroceso del navegador, el sistema atrapará este evento y cerrará la vista dinámica o regresará al paso anterior de forma controlada, evitando expulsar al usuario de la aplicación.

## TR-53: Sincronización Estricta de Router Nativo (History API) y DOM (H3)
1. **Delegación Estricta en Popstate:** El evento global `window.popstate` tiene PROHIBIDO calcular pasos de formularios matemáticamente (`paso - 1`). Su única función debe ser actuar como un "gatillo" que dispare las mismas funciones visuales de "Cerrar Modal", "Ocultar Detalle" o "Volver Atrás" que ya existen en el sistema.
2. **Registro Obligatorio en Modales (PushState):** NINGÚN modal (`.modal-overlay`) ni vista sobrepuesta (Detalle de Cita) puede hacerse visible sin antes inyectar un estado en el historial: `history.pushState({ modal: true }, '', '');`. Si esto se omite, el botón físico "Atrás" sacará al usuario del sitio.
3. **Respeto al Flujo Dinámico (Smart Jumps):** En los formularios multi-paso, el retroceso disparado por el botón "Atrás" del celular debe invocar directamente la función interna de retroceso (ej. `app.citas.irAtras()`). Esta función consultará el historial real de navegación del usuario para respetar los saltos de pasos condicionales.

## TR-54: Sistema de Enrutamiento y Máquina de Estados Global (History API)
1. **Consistencia Universal:** El evento nativo `window.popstate` actuará como el controlador supremo de navegación para todos los formularios por pasos (Agendamiento, Registro, Recuperación de Contraseña) y Modales del sitio.
2. **Registro Obligatorio de Pasos:** Cada vez que cualquier flujo cambie de paso hacia adelante (vía JS), o se abra un modal, el sistema DEBE registrar un estado único usando `history.pushState({ tipo: 'nombre-flujo', paso: numeroPaso }, '', '')`.
3. **Delegación de Cierre:** El `popstate` jamás modificará el DOM directamente ni usará restas matemáticas elementales. Su única función será invocar los métodos visuales de retroceso propios de cada módulo (ej. `app.citas.irAtras()`, `app.registro.irAtras()`, `app.recuperar.irAtras()`), respetando el historial dinámico de cada flujo.

## TR-55: Protección de Integridad de Credenciales (Safe Upsert)
1. **Bloqueo de Upsert Destructivo:** Al agendar una cita sin sesión iniciada (flujo invitado), el sistema tiene PROHIBIDO hacer un `upsert` directo que pueda borrar credenciales (`password`, `correo`) de un usuario previamente registrado.
2. **Patrón Read-Before-Write:** Se debe consultar primero si la cédula existe. Si existe y el usuario tiene cuenta (`es_invitado: false`), se omitirá la actualización de sus credenciales para preservar la integridad de su cuenta.

## TR-56: Integridad de Nombres en Listados (Supabase JOINs / H1)
1. **Consultas Relacionales:** Todas las consultas a la tabla `citas` que alimenten listados visuales (tanto en "Mi Salud" como en el Widget de Invitados) DEBEN incluir un JOIN explícito a la tabla `pacientes` mediante la sintaxis de Supabase: `select('*, pacientes(nombres, apellidos)')`.
2. **Eliminación de Fallbacks:** Esto garantiza que el nombre del paciente se renderice correctamente en las tarjetas HTML, erradicando el error "Paciente: No especificado".

## TR-57: Retorno Contextual entre Páginas (Heurística 6)
1. **Memoria de Transición:** Al finalizar un flujo de creación o reagendamiento de cita en `citas.html`, el CTA principal ("Ver mi cita") debe inyectar el `id_cita` en `sessionStorage` bajo la clave `cita_destacada` ANTES de redirigir a la vista del historial.
2. **Auto-Apertura:** El módulo de listado (`salud.js` o `main.js`) DEBE interceptar esta clave durante su inicialización. Si la clave existe, debe disparar automáticamente la función `verDetalleCita(id)` y luego eliminar la clave del `sessionStorage`.

## TR-58: Integridad Relacional y Desambiguación (Supabase JOINs)
1. **Desambiguación Obligatoria:** Como la tabla `citas` tiene dos llaves foráneas apuntando a `pacientes` (`cedula_paciente` y `cedula_titular`), CUALQUIER consulta `SELECT` que incluya un JOIN debe especificar la llave foránea exacta para evitar errores de ambigüedad. 
   - Sintaxis obligatoria: `.select('*, datos_paciente:pacientes!fk_paciente(nombres, apellidos)')`
2. **Consulta Híbrida (Titular y Dependiente):** Para cargar el historial de citas en "Mi Salud", la consulta debe usar un filtro lógico `OR` que traiga las citas donde el usuario es el paciente directo O donde es el gestor (titular): `.or('cedula_paciente.eq.${cedula},cedula_titular.eq.${cedula}')`.

## TR-59: Retorno Contextual y Prevención de Errores Visuales (H6, H5)
1. **Redirección con Memoria:** Al reagendar o agendar una cita, el botón "Ver mi cita" debe guardar el ID generado en `sessionStorage.setItem('cita_destacada', id)` antes de navegar a la lista. La lista atrapará este ID y disparará `verDetalleCita(id)`.
2. **Estética Informativa (H8):** Los elementos del carrusel promocional o de políticas (ej. restricción de 24 horas) deben prescindir de botones engañosos (H5) y usar espaciado asimétrico (alineación a la derecha o con márgenes amplios) para evitar superposiciones con imágenes de fondo complejas.

## TR-60: Manejo de Nombres Incompletos (Proxy / Dependientes)
1. **Sanitización de Fallbacks:** Queda estrictamente prohibido usar placeholders visibles como "Invitado" o "Desconocido" para rellenar apellidos de pacientes dependientes. Si el apellido no se proporciona, el sistema debe enviar un string vacío `''` (soportado por el `NOT NULL` de Postgres).
2. **Renderizado Limpio:** Toda UI que concatene nombres y apellidos DEBE aplicar la función `.trim()` para evitar espacios en blanco cuando el apellido esté vacío.

## TR-61: Robustez en Consultas Supabase (Zero-Single-Trap)
1. **Manejo de Multiplicidad:** En consultas de lectura (ej. consultar citas por cédula en el Widget de Invitados), queda prohibido el uso del modificador `.single()` si la columna filtrada no es estrictamente UNIQUE (como la cédula, que puede tener múltiples citas asociadas).
2. **Resolución Segura:** Se debe omitir `.single()`, recibir la data como un Array, y si hay resultados, procesar `data[0]` (o listar todos los resultados pertinentes). Además, los bloques `catch` deben imprimir/mostrar el `error.message` real de Supabase en consola para diagnóstico.

## TR-62: Bloqueo Temporal de Edición (Regla de Negocio de 24h / H5)
1. **Validación de Tiempo Real:** El sistema debe calcular dinámicamente la diferencia entre la fecha/hora actual del sistema y la fecha/hora agendada de la cita.
2. **Ocultamiento Preventivo:** Si la diferencia es menor a 24 horas, los botones de "Modificar Cita" y "Cancelar Cita" DEBEN ocultarse del DOM (o deshabilitarse visualmente) en el detalle de la cita, previniendo acciones tardías.

## TR-63: Deprecación del Módulo de Farmacias (Scope del MVP)
1. **Amputación de Módulo:** El alcance del proyecto excluye formalmente la geolocalización e inventario de farmacias.
2. **Limpieza de Interfaz:** Se prohíbe renderizar estados de "Disponibilidad en Farmacia" dentro de las recetas médicas. Asimismo, se debe eliminar cualquier enlace de navegación que apunte al archivo `farmacia.html`.


## TR-64: Arquitectura Mobile-First y Breakpoints (Diseño Responsivo)
1. **Flujo de Trabajo CSS:** Todos los estilos base deben estar programados para dispositivos móviles (0px a 480px). Las adaptaciones para pantallas grandes se harán exclusivamente mediante `min-width` (Mobile-First).
2. **Breakpoints Oficiales:** Basado en los estándares del proyecto, se utilizarán las siguientes Media Queries:
   - Móvil Grande: `@media (min-width: 481px)`
   - Tablet: `@media (min-width: 768px)`
   - Laptop: `@media (min-width: 1024px)`
   - Desktop: `@media (min-width: 1200px)`

## TR-65: Patrón de Navegación Adaptativa (H4 y H7)
1. **Móviles (< 768px):** La navegación principal DEBE ocultarse en un Menú Hamburguesa (Off-canvas o desplegable), liberando espacio en la pantalla. Queda descartado el uso de "Bottom Navigation Bars" tipo App nativa para mantener el estándar web.
2. **Desktop (>= 768px):** El ícono de hamburguesa debe desaparecer y los enlaces de navegación deben mostrarse en una barra horizontal clásica en el Header.

## TR-66: Divulgación Progresiva en Hero/Slider
1. **Control de Carga Cognitiva:** En la vista móvil del Carrusel Principal, los textos secundarios (ej. subtítulos extensos o la grilla de características `.hero__features`) DEBEN ocultarse usando `display: none;` para privilegiar el Título Principal y el Botón de Acción (Call to Action).
2. Estos elementos ocultos deben restaurarse (`display: flex` o `block`) a partir del breakpoint de Tablet (`min-width: 768px`).

## TR-67: Comportamiento Responsivo del Carrusel Principal (H8)
1. **Control de Desbordamiento Vertical (Móvil):** Para evitar que el botón principal (CTA) colisione con los controles de navegación del carrusel en resoluciones menores a `768px`, se DEBE aplicar `display: none;` a los contenedores secundarios (`.hero__features` y `.hero__subtitle`) en las slides que presenten sobrecarga visual (específicamente Slide 1 y Slide 3).
2. **Priorización de Información Crítica:** En el Slide de "Políticas" (Slide 4/5), la prioridad se invierte: El título informativo (`.hero__title`) DEBE permanecer siempre visible (`display: block`), mientras que los íconos ilustrativos (`.hero__features`) pueden ocultarse en móvil.
3. **Liberación de Ancho en Desktop:** El contenedor de texto del carrusel (`.hero__content`) debe expandir su `max-width` en resoluciones Desktop (`>= 1024px`) para evitar forzar saltos de línea prematuros que empujen el contenido hacia abajo (eliminación del efecto "pared invisible").

## TR-68: Especificidad CSS y Prevención de Desbordamiento (H8)
1. **Prohibición de Pseudo-clases de Posición:** Queda estrictamente prohibido usar `:nth-child` para aplicar estilos críticos de layout a las diapositivas del carrusel, debido a su fragilidad en el DOM dinámico. Toda diapositiva con requerimientos de diseño únicos DEBE tener una clase modificadora explícita (ej. `.hero__slide--policy`, `.hero__slide--wide`).
2. **Control de Carga Cognitiva (Slide 1):** En dispositivos móviles (`max-width: 767px`), la primera diapositiva debe mostrar estrictamente DOS características (features) para evitar que el botón principal colisione con la navegación inferior.
3. **Erradicación de "Paredes Invisibles":** El contenedor principal `.hero__content` debe liberar su restricción de `max-width` en vistas de escritorio (`min-width: 1024px`) mediante el uso de anchos escalables (ej. `900px` o `80%`) para las diapositivas que requieran texto horizontal extenso.

## TR-69: Layout Asimétrico en Carrusel (H8)
1. **Alineación de Bloques vs. Contenido:** En pantallas de escritorio, el bloque de contenido de la Política de 24h debe estar posicionado en el extremo derecho de la pantalla (`margin-left: auto`), con su texto alineado a la derecha para respetar el margen. El bloque que contiene el ícono y su texto destacable DEBE estar centrado independientemente de la alineación del resto del texto.

## TR-70: Zonas Seguras de Interacción en Móviles (Ley de Fitts / H8)
1. **Prevención de Toques Accidentales:** Ningún botón de acción principal (CTA) en dispositivos móviles (`max-width: 767px`) debe estar posicionado a menos de `40px` de distancia de controles de navegación (como los puntos del carrusel o barras nativas del SO).
2. **Aplicación:** Se debe inyectar un `margin-bottom` de seguridad a los botones del carrusel en resoluciones pequeñas para elevarlos a la zona de confort del pulgar.

## TR-71: Alineación Vertical y Flujo de Lectura (H8 y Ley de Fitts)
1. **Flujo de Lectura Natural:** Los contenedores de texto en el carrusel (`.hero__content`) no deben anclarse al límite inferior de la pantalla en la vista de escritorio. Deben elevarse mediante márgenes inferiores (`margin-bottom` o `padding-bottom`) para respetar el flujo de lectura humano (arriba hacia abajo).
2. **Desanclaje Móvil:** En dispositivos móviles, la separación de seguridad (40px-60px) para evitar colisiones con los puntos de navegación debe aplicarse al contenedor padre completo (`.hero__content`), no solo a los elementos internos, garantizando que todo el bloque se eleve.

## TR-72: Sanitización Absoluta y Feedback Flotante (OWASP / H1 / H4)
1. **Fase de Captura (Event Capturing):** El sanitizador global DEBE registrarse en el `document` usando la fase de captura (`{ capture: true }`) para ejecutarse antes que los scripts de validación locales.
2. **Independencia del DOM (Floating Tooltip):** Queda estrictamente PROHIBIDO reutilizar los spans de error nativos (`aria-describedby`) para mostrar rechazos de caracteres en tiempo real, ya que colisionan con las lógicas de limpieza `oninput` del sistema. 
3. **Inyección Cero-Impacto y Coherencia Visual (H4):** El script debe inyectar dinámicamente un `<div height="0" position="relative">`. Dentro de este, el mensaje de error "Carácter no permitido" debe posicionarse de forma absoluta (`position: absolute; left: 0;`), pero **DEBE imitar visualmente a los errores nativos** (texto rojo `#d32f2f`, sin fondo, alineado a la izquierda), garantizando la coherencia interna sin desplazar elementos hermanos como íconos.
4. **Animación Nativa:** Todo rechazo de carácter dispara la Web Animations API (`element.animate()`).

## TR-73: Prevención de Colisión Visual de Errores (UI Overlap / H8)
1. **Supresión Temporal:** Cuando el sanitizador global inyecta el Tooltip Flotante de "Carácter no permitido", DEBE ocultar temporalmente cualquier error nativo subyacente manipulando su opacidad (`opacity: 0 !important`) para evitar la superposición de textos.
2. **Limpieza en Evento Blur (Garbage Collection):** Se debe implementar un listener global en la fase de captura para el evento `blur`. Al perder el foco, el sistema DEBE destruir instantáneamente cualquier Tooltip Flotante activo en ese input, limpiar su temporizador y restaurar la opacidad del error nativo a `1`. Esto garantiza que las validaciones nativas de campos vacíos tengan el espacio visual despejado.

## TR-74: Control Estricto y Visibilidad de Autenticación por Breakpoints (H4 / WCAG 2.4.3)
1. **Separación de Pantallas Absoluta:**
   - **Vista Celular (`max-width: 767px`):** El botón de escritorio `#btn-auth` DEBE ocultarse por completo. El botón `#btn-auth-mobile` debe ser un círculo perfecto de 40x40px mostrando la inicial.
   - **Vista Tablet y PC (`min-width: 768px`):** El botón móvil `#btn-auth-mobile` DEBE ser destruido visualmente (`display: none !important`). Esto lo elimina del DOM visible y del flujo del teclado (`Tab`). El botón original `#btn-auth` debe recuperar su forma de óvalo nativo (`border-radius: 100px`).
2. **Unificación de Comportamiento:** Ambos botones deben activar exactamente el mismo menú contextual de opciones completas de perfil (Editar perfil, Mi Salud, Cerrar sesión). Queda prohibido que el botón móvil ejecute una acción distinta al de escritorio.

## TR-75: Prevención de Errores en Cierre de Sesión (H5 y H3)
1. **Confirmación Obligatoria (Modal):** La acción de "Cerrar Sesión" debe abrir el modal `#modal-logout`.
2. **Jerarquía de Botones en Bloque de Acciones:** Dentro del contenedor `.modal-actions`, el botón de confirmación ("Sí, cerrar sesión") DEBE posicionarse en la parte superior, mientras que el botón de escape ("Cancelar") DEBE colocarse estrictamente en la parte inferior y estar pintado en color rojo de advertencia, respetando la consistencia interna y la Heurística 3.
3. **Integración con History API:** Se mantiene el registro del estado `history.pushState` al abrirse el modal para soporte de botón "Atrás" físico en celulares.

## TR-76: Corrección Tipográfica y Protección de FontAwesome en Modales (H4)
1. **Herencia Tipográfica:** Los contenidos inyectados dinámicamente en los modales (como la lista de servicios `.modal-activities-list li`) DEBEN forzar `font-family: inherit` en su texto principal para evitar tipografías por defecto del navegador (Times New Roman), manteniendo la consistencia (H4).
2. **Excepción de Pseudo-Elementos (Protección de Íconos):** Es ESTRICTAMENTE PROHIBIDO que la herencia tipográfica (`!important`) sobrescriba los pseudo-elementos `::before` o `::after`. El sistema debe garantizar que el `font-family` de FontAwesome se mantenga intacto para renderizar viñetas o checks correctamente sin errores de glifo ("tofu").

## TR-77: Gestión de Concurrencia y Bloqueo Optimista de Citas (H1, H5, WCAG 2.2.1)
1. **Gatillo de Bloqueo (Trigger):** El temporizador y la reserva en la base de datos se activan EXCLUSIVAMENTE cuando el usuario presiona el botón de confirmación de horario (`#btn-confirmar-cita`) en el Paso 2 (Calendario).
2. **Persistencia Temporal Aislada:** Debido a restricciones de llaves foráneas (`cedula_paciente`), el bloqueo NO debe insertarse en la tabla `citas`. Debe manejarse mediante una tabla temporal `bloqueos_horarios` (o lógica de bloqueo equivalente en persistencia) que registre `id_especialista`, `fecha`, `hora` y `expiracion`.
3. **Deshabilitación Visual (H1):** El renderizado del calendario debe pintar y deshabilitar (`disabled`, estilo grisado) tanto las horas ocupadas en la tabla `citas` como las horas retenidas en bloqueos activos de otros usuarios.
4. **Temporizador de Sesión (TTL):** El bloqueo tiene un Time-To-Live (TTL) estricto de **10 minutos**, garantizando tiempo suficiente para la recolección de documentos físicos del paciente (WCAG 2.2.1). Al dispararse el trigger, inicia un `setTimeout` global en el frontend.
5. **Manejo de Caducidad (Timeout):** Si el TTL expira antes de completar la cita, se detiene cualquier acción y se muestra un Modal Restrictivo con el texto: *"El tiempo de espera o tiempo permitido ha excedido"*. El modal contará con un botón de "Cerrar" y una "X". Al cerrarse, el usuario es redirigido al Home, purgando su estado local y liberando el horario en la base de datos.