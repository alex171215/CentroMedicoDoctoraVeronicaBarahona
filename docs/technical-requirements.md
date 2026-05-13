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