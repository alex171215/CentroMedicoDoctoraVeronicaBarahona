# Sesión de Diseño: Corrección de Feedback de Cierre de Sesión (Static Injection)

## 1. Objetivo
Corregir la invisibilidad del modal de "Cerrando sesión..." utilizando un enfoque de inyección estática en lugar de dinámica para evitar condiciones de carrera (Race Conditions) con la redirección.

## 2. Instrucciones Técnicas
- **HTML:** Asegurar que el modal `#modal-logout-loader` exista estáticamente en el DOM.
- **CSS:** Utilizar una clase `.show` con `display: flex !important` y `z-index: 99999`.
- **JS:** La función de logout solo debe manipular `classList` y esperar 1.5s antes del `window.location.href`.

## 3. Implementado (Registro de Cambios)
- Se inyectó estáticamente el modal de carga `#modal-logout-loader` al final del `index.html`.
- Se implementó la restricción en `styles.css` garantizando `display: none !important` mediante la pseudo-clase `.hidden` de utilería.
- Se reescribió `ejecutarLogout` en `main.js` para destruir la carga de innerHTML y manejar estrictamente `logoutLoader.classList.remove('hidden')`.
- El temporizador se mantuvo en `1500ms` garantizando que el usuario procese mentalmente la visibilidad antes de la redirección.

## Corrección de Race Condition en Logout
- Se aplicó doble `requestAnimationFrame` para forzar que el navegador ejecute el Reflow y renderice el modal estático en pantalla antes de bloquear el hilo.
- Se simplificó la limpieza de sesión por `localStorage.clear();` en la redirección dura.

## Arquitectura de Datos y Escalabilidad (13 -> 60 Especialistas)
- Se implementó un "Adaptador de Datos" (`transformarDeSupabase` y `transformarParaSupabase`) en `js/modulos/supabaseServicio.js` que hace de puente entre el backend plano de Supabase y el frontend jerárquico (`doctor.nombre_completo`).
- Se ampliaron los datos localmente en `data.js` respetando la integridad de los especialistas históricos `esp-001` al `esp-013`.

## Aislamiento de Eventos (Fix Modal Regresión)
- Se redefinió la lógica de cierre del modal de perfil de especialista (`#modal-especialista`) en `js/main.js` para asegurar unicidad (idempotencia) mediante la bandera `this._eventosModalAgregados`.
- Se introdujo `e.stopPropagation()` y `e.preventDefault()` en los listeners para evitar la propagación (Race Conditions / burbujeo) espuria hacia los disparadores subyacentes (que causaba que el sistema avanzara erróneamente seleccionando al último doctor iterado).
---

## Estabilización Visual y Reseteo de Contexto Temporal en Calendario

**Fecha:** 2026-05-20  
**Requisitos aplicados:** TR-79, TR-80, TR-81  
**Archivo modificado:** `js/modulos/citas.js`

### Problema

El módulo de agendamiento presentaba dos fallos de persistencia y ergonomía visual:

1. **Contaminación de estado:** Al volver al Paso 1 y seleccionar un médico diferente, el calendario heredaba la semana y el slot seleccionados del médico anterior, generando affordances falsos (affordances de slots ya seleccionados de otro contexto).
2. **Botón de avance sin límite visual:** El botón "Siguiente semana" / "Siguiente día" no desaparecía al alcanzar el límite máximo de 90 días, contradiciendo TR-79 e incumpliendo H1 (Visibilidad del Estado) y H8 (Diseño Minimalista).

### Cambios Implementados

#### TR-79 — Límites de navegación temporal (`cambiarSemana` / `cambiarDiaMobile`)

- **`cambiarSemana(-1)`**: Bloquea si el Sábado de la semana destino es `< hoy` (semana enteramente pasada). Aplica `disabled = true` y clase `.calendar-nav-btn--disabled`.
- **`cambiarSemana(+1)`**: Bloquea si el Lunes de la semana destino es `> hoy + 90 días`. Aplica `disabled = true` y clase `.calendar-nav-btn--disabled`.
- **`cambiarDiaMobile(-1)`**: Bloquea si el día objetivo es `< hoy`.
- **`cambiarDiaMobile(+1)`**: Bloquea si el día objetivo es `> hoy + 90 días`.
- Los botones se reactivan (`disabled = false`, clase removida) antes de navegar para que `generarCalendario()` los recalcule en el nuevo contexto.

#### TR-80 — Reseteo de ciclo de vida del calendario

- **`seleccionarDoctorParaCita(med)`** (Paso 1 → multi-médico): Antes de llamar a `generarCalendario(true)`, se ejecuta:
  - `this.fechaBaseCalendario = new Date()` — la fecha base vuelve al instante actual.
  - `this.diaSeleccionadoMobile = 0` — el índice de día móvil se reinicia al Lunes.
  - `sessionStorage.removeItem('cita_hora_seleccionada')` — purga la hora efímera.
  - `sessionStorage.removeItem('cita_fecha_iso')` — purga la fecha ISO efímera.
  - `this.horaSeleccionada = null` y `this.fechaISOSeleccionada = null` — limpia el estado en memoria.
- **`evaluarEspecialidad`** (Paso 0 → único médico): Mismo reseteo antes de llamar a `generarCalendario(true)`.
- **Persistencia Transaccional (TR-80.3):** El reset solo ocurre en los puntos de cambio de médico. Al volver desde Paso 3 o Paso 4 via `irAtras()`, `generarCalendario` se llama sin `autoSeek=true` y sin reset previo, por lo que la semana y hora del slot seleccionado se conservan intactas.

#### TR-81 — Ocultamiento absoluto por `visibility` en `generarCalendario()`

- El bloque de UI post-render de `generarCalendario()` fue refactorizado para calcular `limiteMaximoNorm = hoy + 90 días` y aplicar `style.visibility = 'hidden'` (no solo `disabled`) de forma atómica:
  - **Desktop — botón Siguiente:** `visibility: hidden` si `lunesSiguiente > limiteMaximoNorm`.
  - **Móvil — botón Día Siguiente:** `visibility: hidden` si `diaSiguienteMobile > limiteMaximoNorm`.
  - **Desktop — botón Anterior:** Sin cambios; sigue ocultándose cuando `lunesNorm <= hoyNorm`.
  - **Móvil — botón Día Anterior:** Sin cambios; sigue ocultándose por `fechaInicioDisponible`.
- Se usa `visibility: hidden` en todos los casos (nunca `display: none`) para mantener el layout Flexbox del header de navegación estable (golden-rules.md §4).

### Garantías de Integridad

- No se alteraron las clases estructurales BEM del calendario.
- No se inyectaron nodos dinámicos; solo se manipuló `style.visibility` sobre elementos del DOM existente.
- No se modificaron las consultas relacionales de Supabase.
- La estructura de datos de los médicos (`cartera_especialistas`) permanece intacta.


## Re-arquitectura del Flujo de Consulta Invitados (TR-80 / BR-1)
- Se extrajo el widget de consulta de citas en línea de `index.html` hacia un nuevo modal estático `#modal-consulta-invitado`, accesible desde el botón "Consultar Cita" en el Header.
- Se optimizó el contexto para requerir únicamente la "Cédula", filtrando programáticamente mediante Supabase `.gte('fecha', hoy)`.
- Se aplicaron reglas de truncamiento preventivo (`text-overflow: ellipsis; white-space: nowrap; overflow: hidden`) a la vista de Maestro de resultados.
- Se ajustó el salto directo al Detalle desde un agendamiento exitoso pasando solo `cedula` e `id_cita` por `sessionStorage`.

## Ajustes Críticos Flujo Consulta Invitados (TR-81)
- **Visibilidad Global:** Se verificó y aseguró que el botón `#btn-consulta-invitado` mantenga un renderizado persistente en toda la aplicación para usuarios no autenticados (`usuarioLogueado !== 'true'`), replicando la persistencia de iniciar sesión.
- **Cableado del Botón:** Se restableció correctamente el evento de clic sobre el botón `#btn-consultar-cita` en el modal de inicialización, garantizando el disparo asíncrono de la búsqueda por cédula sin depender del campo expirado de fecha.
- **IHC (Estilos):** Se ajustó directamente la propiedad CSS en línea a `color: #ffffff !important;` en el ícono `<i class="fa-regular fa-calendar-check">` dentro de `#modal-consulta-invitado`, restaurando el contraste óptico conforme a WCAG.
- **Estado de Bug:** Cierre total confirmado.

## Parches de Estabilidad, Accesibilidad y Ergonomía Visual — Modal Consulta Invitados (TR-84)

### Fecha: 2026-05-20

### 1. Persistencia de Cédula al Volver (Vista B / Vista C → Vista A)
- Se agregó la variable de estado interna `_cedulaConsultada: ''` al objeto `app.widgetInvitado`.
- Se reemplazó el string estático `_vistaAHTML` por el método dinámico `_generarVistaAHTML()`, que interpola `this._cedulaConsultada` directamente en el atributo `value` del campo `#widget-cedula`.
- Se asigna `this._cedulaConsultada = cedula` en `consultar()` en el instante exacto en que Supabase devuelve resultados válidos (post-validación), garantizando que la cédula nunca se persista si la consulta falló.
- El ciclo completo: Consulta exitosa → Vista B/C → Volver → Vista A re-hidratada con la cédula anterior.

### 2. Contraste de Accesibilidad WCAG 2.2 (Ícono Vista C)
- El elemento `<i class="fa-solid fa-calendar-check">` en `_renderVistaC()` tenía `color: var(--action-color)`, variable que en ciertos contextos de fondo oscuro no garantizaba ratio ≥ 4.5:1.
- Se forzó `color: #ffffff !important;` en línea para garantizar contraste máximo sobre cualquier fondo cromático del modal.

### 3. Cableado Determinista CRUD en Vista C
- Los `onclick` de los botones Modificar, Cancelar, Imprimir y Descargar PDF ya interpolaban `${idCitaEstable}` (derivado de `cita.id_cita`), no IDs estáticos.
- Confirmado: no existen IDs de ejemplo ni literales hardcodeados en ningún botón de acción.

### 4. Scroll Ergonómico en Vista B (Listados Volumétricos)
- El bloque de filas de citas en `_renderVistaB()` fue envuelto en un `<div>` contenedor con:
  `max-height: 360px; overflow-y: auto; box-sizing: border-box; padding-right: 5px;`
- Esto aplica desplazamiento vertical interno cuando el paciente posee múltiples registros, sin desbordar el viewport del navegador ni romper el layout del modal.

### Estado: ✅ CERRADO — TR-84 implementado y validado (`node -c js/main.js` → 0 errores de sintaxis)

## Migración a Delegación Global Inmortal en Document (TR-85)

### Fecha: 2026-05-20

### Problema raíz detectado
Las mutaciones asíncronas causadas por el re-renderizado mediante `innerHTML` destruían las referencias DOM locales antes de que el navegador lograra fijar los event listeners, incluso bajo el patrón de `contenedor.onclick` (TR-94), dejando los botones de Vista C muertos en ciertos flujos dinámicos.

### Solución implementada: Event Delegation en App Shell
Se eliminaron por completo las funciones frágiles `_bindVistaC` y `_mostrarVistaC`. En su lugar, se implementó un **único listener global e inmortal** vinculado a `document` dentro de `inicializar()`.

Este listener captura **todos** los clics de la aplicación y filtra por delegación utilizando `e.target.closest('button, a')` y verificando las clases de acción (e.g. `.cita-acciones__btn--modificar`).

Para mantener la integridad del estado sin depender de cierres léxicos locales (closures), el sistema ahora guarda el ID de la cita en curso en `app.widgetInvitado._citaActivaId` justo antes de inyectar el HTML de Vista C (`body.innerHTML = this._renderVistaC(...)`). El listener global lee directamente este identificador de forma segura.

### Garantías preservadas
- **Botón Header:** `#btn-consultar-cita-header` sigue intacto en HTML. Las reglas de `style.display` en `iniciarSesionUsuario()` no se tocaron según requerimiento.
- **Persistencia de Cédula:** El input de Vista A mantiene estrictamente `value="${this._cedulaConsultada || ''}"`.
- **Accesibilidad Visual:** El ícono de calendario en Vista C retiene el atributo `style="color: #ffffff !important;"`.
- **Integridad JS:** `node -c js/main.js` confirma cero errores de sintaxis tras la refactorización profunda.

### Estado: ✅ CERRADO — TR-85 implementado y validado.

## Implementación de Smart Jumps en Modificación de Citas (TR-86)

### Fecha: 2026-05-20

### Objetivo Estratégico
Eliminar la fricción de requerir que los invitados vuelvan a llenar (o confirmar) sus datos personales (Paso 3) cuando únicamente desean modificar la fecha/hora de una cita existente. Esta inmutabilidad de identidad aumenta la seguridad y mejora drásticamente el flujo de UX (Smart Jump).

### Solución Técnica Implementada

1. **Contexto Operativo Completo (main.js):** 
   En la rutina `prepararModificacion`, se expandió el payload de `cita_modificacion` inyectando el flag maestro `modoModificacion: true`, acompañado de los campos estables del paciente: `paciente`, `cedula` (y sus variantes para resiliencia) e `id_especialista`. Esto desacopla el flujo del DOM.

2. **Supresión Activa del Paso 3 (citas.js):**
   - El método `_omitirDatosEnFlujo()` fue refactorizado para retornar `true` de forma temprana si detecta el flag de modificación (`modoModificacion`).
   - El método principal `avanzarPaso()` intercepta la transición desde el Paso 2 (Calendario). Si identifica una modificación de invitado con el contexto protegido, *esquiva* las validaciones y el renderizado del Paso 3 y llama de inmediato a `prepararResumenFinal(false)` para realizar un **Smart Jump** al Paso 4.

3. **Inmutabilidad Visual en Resumen (Paso 4):**
   Se ajustó el renderizado del resumen (`_mostrarResumen`) para inyectar un *badge* semántico que informa explícitamente: "Identidad protegida. Solo cambia la fecha y hora de la cita". Se separó jerárquicamente la "Nueva Fecha y Hora" con alto contraste frente a la fecha anterior tachada visualmente. Los campos personales se visualizan bajo una etiqueta estricta de `(solo lectura)`.

4. **Integridad de Datos en Persistencia (Confirmación):**
   Dado que el formulario del Paso 3 fue saltado, los `<input>` no poseen datos. El adaptador `_filaPacienteUpsertParaConfirmar` fue dotado de resiliencia: si está en modo de salto, captura la identidad `[cédula, nombres, apellidos]` directamente del blob original salvado en `sessionStorage`, impidiendo desincronización de registros de pacientes durante la llamada RPC o Upsert a Supabase.

5. **Aislamiento en Limpieza:**
   Se garantizó la higiene del `sessionStorage` destruyendo `modoModificacion` dentro del método maestro de cierre de flujos (`limpiarSessionFlujoCitas`), para que futuras reservas estándar no muten al modo inteligente accidentalmente.

### Estado: ✅ CERRADO — TR-86 integrado, garantizando un workflow inmutable para la identidad de citas preexistentes.

## Prevención de Regresión de Enrutamiento en Modificación de Invitados (TR-96)

### Fecha: 2026-05-20

### Bug Detectado
El sistema sufría una regresión de enrutamiento al hacer clic en "Cambiar Fecha/Hora" desde el Widget de Invitado. La aplicación navegaba hacia `citas.html` y los mecanismos legados de recuperación interceptaban erróneamente el flujo, derivando al usuario hacia el dashboard protegido `mi-salud.html`, prohibido para no autenticados. Adicionalmente, el Smart Jump no estaba acorazado para el uso exclusivo del Widget.

### Solución Técnica Implementada en `citas.js`

1. **Guard de Inicialización Estricto (Hard-Routing):**
   Se inyectó un bloque de contención prioritario (Guard) al inicio de `iniciarFlujo()`. Este mecanismo inspecciona proactivamente `cita_modificacion`. Si detecta la propiedad estricta `origen === 'widget'`, bloquea las rutinas de recuperación de sesión (`_recuperarEstadoCita` y enrutamientos a `mi-salud`), reescribe el historial silenciando errores y fuerza visual y algorítmicamente el renderizado del **Paso 2 (Calendario)** de la interfaz de `citas.html` con el médico respectivo pre-seleccionado.

2. **Fortalecimiento del Smart Jump (Paso 3):**
   Dentro de `avanzarPaso()`, el "Salto Inteligente" hacia el Paso 4 (Resumen) ya dependía de la bandera `modoModificacion`. Se reforzó añadiendo la condición `origen === 'widget'`. Ahora, la evasión del formulario de datos personales es una directiva absoluta y dependiente de la procedencia de la petición, brindando resiliencia contra otros flujos del sistema.

3. **Inmutabilidad y Auto-Recarga (Paso 4 & 5):**
   Se verificó que los datos inyectados por el Guard alimenten apropiadamente al renderizador `_mostrarResumen` manteniendo las reglas de "Solo lectura". Finalmente, al completar el ciclo (Paso 5) y presionar la acción principal (o salir), el sistema elimina `cita_modificacion` del Storage y ejecuta la directiva asíncrona existente `_guardarAutoConsultaInvitadoYIrHome()`, la cual traslada al invitado al `index.html` re-gatillando automáticamente la auto-consulta con la nueva fecha de cita sin afectar la integridad del paciente (Upsert + Update en Supabase).

### Estado: ✅ CERRADO — TR-96 resuelto, preservando la exclusión de MiSalud para invitados y blindando la edición fluida mediante el Widget.

---

## Unificación del App Shell y Sincronización de Consulta en la Arquitectura MPA (TR-87)

### Fecha: 2026-05-21

### Problema Detectado

En la arquitectura MPA (Multi-Page Application) del centro médico, el botón `#btn-consultar-cita-header` solo existía en el DOM de `index.html`. Al navegar a cualquier otra sección (citas, especialistas, mi-salud, farmacia, contacto, login, registro), el botón desaparecía físicamente del header, rompiendo la consistencia visual del App Shell compartido. El usuario invitado perdía el acceso al widget de consulta de cita cada vez que cambiaba de pestaña.

### Causa Raíz

La arquitectura MPA implica que cada página carga su propio HTML estático. El botón había sido inyectado únicamente en `index.html` durante su implementación inicial (TR-93), sin replicarse en los demás archivos HTML del proyecto.

### Solución Técnica Implementada

#### 1. Réplica Estática en el DOM de cada página HTML

Se inyectó el botón `#btn-consultar-cita-header` de forma **estática y quirúrgica** en el bloque `div.header__top-buttons` de los 7 archivos HTML restantes:

| Archivo | Estado antes | Estado después |
|---|---|---|
| `citas.html` | ❌ Ausente | ✅ Inyectado |
| `especialistas.html` | ❌ Ausente | ✅ Inyectado |
| `mi-salud.html` | ❌ Ausente | ✅ Inyectado |
| `farmacia.html` | ❌ Ausente | ✅ Inyectado |
| `contacto.html` | ❌ Ausente | ✅ Inyectado |
| `login.html` | ❌ Ausente | ✅ Inyectado |
| `registro.html` | ❌ Ausente | ✅ Inyectado |
| `index.html` | ✅ Ya existía | ✅ Sin cambios |

Estructura inyectada en cada archivo (idéntica a la de `index.html`):

```html
<button id="btn-consultar-cita-header" class="btn btn--secundario"
    style="display: inline-block;"
    onclick="app.widgetInvitado.abrirModalConsulta()"
    aria-label="Consultar Cita">
    <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Consultar Cita
</button>
```

El atributo `style="display: inline-block;"` es un valor inicial HTML neutro. La visibilidad real la determina `iniciarSesionUsuario()` en `js/main.js` al ejecutarse en cada carga de página, evitando el parpadeo (FOUC) sin depender de JavaScript para la primera render.

#### 2. Sincronización del Estado Global en `js/main.js`

La función `iniciarSesionUsuario()` ya contenía la lógica TR-93 (líneas ~792-795). Se amplió su documentación interna para reflejar explícitamente la cobertura TR-87:

**Regla de ocultamiento condicional aplicada en cada carga:**
```javascript
const btnConsultarHeader = document.getElementById('btn-consultar-cita-header');
if (btnConsultarHeader) {
    btnConsultarHeader.style.display = (usuarioLogueado === 'true') ? 'none' : 'inline-block';
}
```

- `usuarioLogueado === 'true'` → `display: none` (usuario autenticado, accede desde Mi Salud)
- Cualquier otro valor → `display: inline-block` (invitado, puede consultar su cita)

Dado que `iniciarSesionUsuario()` es invocada desde `app.init()` —que se ejecuta en cada página del MPA— la sincronización es **automática, global e inmediata** en toda la aplicación.

### Garantías de Integridad

- ✅ **No se usaron scripts destructivos** (replace.js, git reset, etc.)
- ✅ **Edición manual y quirúrgica**: cada archivo HTML fue modificado en exactamente 1 línea de inserción dentro del bloque `header__top-buttons`
- ✅ **Paridad estructural**: la estructura del botón es idéntica en los 8 archivos HTML
- ✅ **Sin regresión en `index.html`**: el botón pre-existente no fue modificado
- ✅ **Sin duplicados de IDs**: el botón tiene el mismo `id` en todos los archivos porque el MPA garantiza una sola página activa a la vez en el navegador
- ✅ **Compatibilidad con `widgetInvitado`**: el modal `#modal-consulta-invitado` existe en `index.html`; `app.widgetInvitado.abrirModalConsulta()` es la función pública que gestiona su apertura desde cualquier vista

### Estado: ✅ CERRADO — TR-87 implementado. El botón "Consultar Cita" es ahora consistente en las 8 páginas del MPA y se sincroniza automáticamente con el estado de sesión del usuario en cada carga de página.

---

## Correcciones de UX en el Calendario de Citas y Widget de Invitados (TR-88, TR-89, TR-99)

### Fecha: 2026-05-21

---

### TR-88 — Corrección de Autocompletado en #widget-cedula

**Archivo:** `js/main.js` (función `_generarVistaAHTML`, línea ~3419)

**Problema:** El navegador mostraba sugerencias de correos electrónicos en el campo de cédula del widget de consulta para invitados, porque el atributo `autocomplete="on"` era demasiado permisivo. El navegador infería que se trataba de un campo de usuario/email al no existir un `name` explícito.

**Solución:** Se añadió el atributo `name="username"` y se cambió `autocomplete="on"` por `autocomplete="username"`. El valor `"username"` es la señal semántica estándar (WHATWG Autofill) que le indica al navegador que el campo espera un identificador de cuenta (cédula), **no** una dirección de correo.

```diff
- aria-describedby="widget-cedula-error" autocomplete="on" style="width: 100%;"
+ aria-describedby="widget-cedula-error" name="username" autocomplete="username" style="width: 100%;"
```

**Estado:** ✅ CERRADO

---

### TR-89 — Liberación de Slots por Abandono del Calendario

**Archivo:** `js/modulos/citas.js` (función `irAtras()`, línea ~892)

**Problema:** Cuando el usuario presionaba "Volver a Médicos" o "Volver a Especialidades" desde el paso del calendario (Paso 2), el slot de hora que había pre-seleccionado quedaba bloqueado en gris (`is-pending`) de forma permanente. Esto ocurría porque `bloquearHorario()` marcaba el slot en `sessionStorage` pero `irAtras()` no llamaba a `liberarHorario()` al destruir el contexto del calendario.

**Solución:** Se añadió una llamada explícita a `this.liberarHorario(false)` dentro del bloque `if (this.pasoActual === 2)` en `irAtras()`, justo después de limpiar la imagen del doctor. La llamada con `isTimeout = false` limpia el `sessionStorage` de la reserva temporal sin disparar el modal de "Tiempo excedido".

```diff
  if (this.pasoActual === 2) {
      const imgEl = document.getElementById('citas-doctor-img');
      if (imgEl) imgEl.src = '';
+     // TR-89: Liberar slot temporal al abandonar el calendario.
+     this.liberarHorario(false);
  }
```

**Estado:** ✅ CERRADO

---

### TR-99 — Estado Azul vs Gris al Regresar al Calendario

**Archivo:** `js/modulos/citas.js` (función `generarCalendario()`, línea ~2815)

**Problema:** Si el usuario seleccionaba una hora, avanzaba al Paso 4 (Revisión) y luego presionaba "Atrás" para regresar al calendario, el slot de su hora elegida se renderizaba con la clase `is-pending` y el atributo `disabled` (gris, no interactuable). Esto contradecía la Heurística H1 de Nielsen (Visibilidad del Estado del Sistema) porque el usuario no podía reconocer su progreso ni modificarlo.

**Causa raíz:** `generarCalendario()` reconstruye el HTML del grid desde cero. Al llamar a `deshabilitarHorarios()` al final, el slot que tenía `reserva_temporal` en sessionStorage se convertía en `is-pending`. La lógica no distinguía entre "slot bloqueado por otro usuario" y "mi propio slot en curso".

**Solución:** Se añadió una verificación en el bucle de renderizado de slots disponibles. Antes de escribir el botón HTML, se compara el `label` del slot con `this.horaSeleccionada`. Si coinciden, el botón se renderiza con la clase `time-slot--selected` (azul, habilitado) en lugar de la clase neutra `time-slot`, y `deshabilitarHorarios()` lo respeta gracias a la guardia ya existente en línea ~3163 (`if (btn.classList.contains('time-slot--selected')) return`).

```diff
- html += `<button class="time-slot" onclick="..."></button>`;
+ const estaSeleccionado = this.horaSeleccionada && label === this.horaSeleccionada;
+ const claseSlot = estaSeleccionado ? 'time-slot time-slot--selected' : 'time-slot';
+ html += `<button class="${claseSlot}" onclick="..."></button>`;
```

**Garantía de integridad:** La guardia en `deshabilitarHorarios()` (línea ~3163) ya existía con la condición `if (btn.classList.contains('time-slot--selected')) return`, lo que significa que el slot azul no será sobreescrito a gris por esa rutina. No fue necesario modificarla.

**Estado:** ✅ CERRADO

---

## Ciclo de vida MPA, autofill de login y pre-reservas de calendario (TR-90, TR-91, TR-92)

### Fecha: 2026-05-21

---

### TR-90 — Estabilización del widget de consulta en la MPA (App Shell)

**Archivo:** `js/main.js` (métodos de apertura del widget: `abrirModalConsulta`, `cerrarModalConsulta`, `restaurarVistaA` y helpers `_normalizarShellModalMPA`, `_asegurarUtilidadHidden`)

**Problema:** En páginas secundarias (`citas.html`, `login.html`, etc.) el modal `#modal-consulta-invitado` se abría vacío o inerte porque:
1. `#modal-consulta-invitado-body` nacía sin HTML de captura.
2. El markup MPA usaba `class="modal hidden"` sin `modal-overlay`, por lo que el contenedor no se posicionaba como overlay.
3. La utilidad `.hidden` no tenía regla CSS activa en el proyecto, impidiendo el toggle visual consistente.

**Solución (quirúrgica, solo en métodos de apertura):**
1. **`_normalizarShellModalMPA()`**: Reestructura el DOM degenerado de la MPA (body hijo directo con clase `modal-content`) envolviéndolo en `.modal-content.modal-consulta__content`, inyecta botón cerrar y añade `modal-overlay modal-consulta` al contenedor raíz.
2. **`_asegurarUtilidadHidden()`**: Inserta reglas mínimas para que `.hidden` oculte y `:not(.hidden)` muestre el overlay con `display: flex`.
3. **`abrirModalConsulta()`**: Normaliza shell → evalúa ausencia de `#widget-cedula` → invoca `restaurarVistaA()` o re-enlaza con `_bindVistaA()` → remueve `.hidden` (sin depender de `display` inline).
4. **`cerrarModalConsulta()`**: Añade `.hidden` y `display: none` para compatibilidad con `index.html`.
5. **`_bindVistaA()`**: Usa `oninput`/`onclick` idempotentes para evitar listeners duplicados que dejaban el botón Consultar inerte.

**Estado:** ✅ CERRADO — Widget operativo en todas las páginas del App Shell compartido.

---

### TR-91 — Ruptura de autofill de correo en `#login-cedula`

**Archivo:** `login.html` (input `#login-cedula`)

**Problema:** `autocomplete="username"` forzaba a Chrome a sugerir correos electrónicos guardados en un campo destinado exclusivamente a cédula o pasaporte.

**Solución:** Reemplazo por `autocomplete="off"` manteniendo `type="text"` e `inputmode="numeric"`.

```diff
- autocomplete="username"
+ autocomplete="off"
```

**Estado:** ✅ CERRADO

---

### TR-92 — Gestión de ciclo de vida de pre-reservas del calendario (CERRADO)

**Archivo:** `js/modulos/citas.js`

**Claves de almacenamiento rastreadas:**
| Clave | Rol |
|-------|-----|
| `reserva_temporal` | Soft-lock TTL (10 min) al hacer clic en un slot |
| `cita_hora_seleccionada` | Label de hora comprometida (solo tras `#btn-confirmar-cita`) |
| `cita_fecha_iso` | Fecha ISO asociada a la hora comprometida |
| `cita_hora_confirmada` | Flag `'true'` = commit point TR-92.2 cumplido |
| `STORAGE_CITA_EN_PROGRESO` | Blob con `horaSeleccionada` / `fechaISOSeleccionada` (progreso wizard) |

**TR-92.1 — Purga total por deserción:**
- Nueva rutina `_purgaSeleccionHorario()`: elimina todas las claves anteriores, limpia memoria, quita clases `.time-slot--selected` / `.is-pending` y bloquea `#btn-confirmar-cita`.
- Invocada en: `mostrarPaso()` (2→0/1), `irAtras()` desde paso 2, `seleccionarDoctorParaCita()`, `evaluarEspecialidad()` (médico único y lista múltiple), `gestionarConflicto()`.
- `_liberarSoftLockHorario()` solo libera `reserva_temporal` (p. ej. tras `confirmarCita()` definitivo).

**TR-92.2 — Commit point (`#btn-confirmar-cita` → `avanzarPaso`):**
- `seleccionarHora()` ya no escribe `cita_hora_seleccionada` en storage (solo memoria + soft-lock).
- `_commitHorarioAlAvanzar()` persiste hora, fecha y `cita_hora_confirmada` al avanzar desde paso 2.

**TR-92.3 — Discriminación visual azul vs. gris:**
- `_horaActivaSesion()`: devuelve la hora comprometida o la selección en curso en paso 2.
- `generarCalendario()` y `deshabilitarHorarios()`: slot propio → `time-slot--selected` (azul, sin `disabled` ni `.is-pending`); otros locks → gris.
- `mostrarPaso(2)` al regresar desde pasos 3/4: re-hidrata con `_seleccionarSlotVisual()` + `deshabilitarHorarios()`.

**Validación:** `node -c js/modulos/citas.js` — sin errores de sintaxis.

**Estado:** ✅ CERRADO — Pre-reservas con ciclo de vida completo según TR-92.

---

### TR-93 — Purga del almacenamiento por deserción de ruta (Navbar / Especialistas)

**Archivos:** `js/modulos/citas.js`, `js/main.js` (App Shell)

**Problema:** Si el usuario elegía un horario en `citas.html` sin pulsar `#btn-confirmar-cita` y navegaba a **Especialistas** por el navbar, `reserva_temporal` (y claves afines) permanecían en `sessionStorage`. Al volver al mismo médico, el slot aparecía gris (`is-pending`) e inaccesible.

**Claves purgadas (solo si `cita_hora_confirmada` ≠ `'true'`):**
`reserva_temporal`, `cita_hora_seleccionada`, `cita_fecha_iso`, `cita_hora_confirmada`, campos `horaSeleccionada`/`fechaISOSeleccionada` en `STORAGE_CITA_EN_PROGRESO`, más estado en memoria y clases del grid.

**Solución:**
1. **`purgaHorarioPorDesercionRuta()`** en `citas.js`: delega en `_purgaSeleccionHorario()` salvo que la hora ya esté comprometida (TR-92.2 / commit en `avanzarPaso`).
2. **`iniciarPurgaDesercionRutaTR93()`** en `main.js`: listener global en fase capture sobre `.header__nav-link` (ignora enlaces con `preventDefault`, p. ej. Agendar en la misma vista).
3. **`directorio.inicializar()`**: invoca la purga al cargar `especialistas.html` (`#specialists-directory-grid`).

**Validación:** `node -c js/modulos/citas.js` — OK.

**Estado:** ✅ CERRADO — Sin fuga de soft-lock al abandonar el wizard por ruta externa.

---

### TR-94 — Inicialización limpia del calendario (estado inicial cero)

**Archivo:** `js/modulos/citas.js` (`generarCalendario`, `_horaActivaParaRenderTR94`, `deshabilitarHorarios`)

**Problema:** Tras abrir un médico desde **Agendar Cita** en el directorio, el grid heredaba `reserva_temporal` o selecciones no consolidadas y pintaba slots en gris (`is-pending` + `disabled`) sin ocupación real en Supabase.

**Solución (pinpoint en el renderizador):**
1. **`_horaActivaParaRenderTR94()`**: solo devuelve hora si `cita_hora_confirmada === 'true'` (retorno wizard pasos 3/4) o si hay `horaSeleccionada` en memoria en paso 2 (sesión actual); ignora claves huérfanas del storage.
2. **`generarCalendario()`** inicio: si no hay hora consolidada, `_liberarSoftLockHorario()` antes de pintar.
3. **Bucle de slots**: usa `_horaActivaParaRenderTR94()` para la clase azul; `disabled` solo en `yaPaso` o `estaOcupada` (caché `sanitas_citas_ocupadas`).
4. **Post-render**: `deshabilitarHorarios()` solo si hay hora renderizable; si no, `_bloquearConfirmar()` sin aplicar bloqueo gris.
5. **`deshabilitarHorarios()`**: retorno temprano si no hay hora consolidada ni selección en memoria.

**Validación:** `node -c js/modulos/citas.js` — OK.

**Estado:** ✅ CERRADO — Calendario limpio al agendar desde directorio; azul solo en retorno wizard confirmado o selección activa.

---

### TR-95 — Reseteo absoluto de selección por deserción de ruta (sin fuga azul)

**Archivo:** `js/modulos/citas.js`

**Problema:** Tras elegir hora con el Médico A sin confirmar, ir a **Especialistas** por el navbar y volver a **Agendar Cita** sobre el mismo médico, el slot seguía en azul por `horaSeleccionada` en memoria/blob o por `_horaActivaParaRenderTR94()` (rama paso 2 sin confirmar).

**Solución:**
1. **`ingresarCalendarioDesdeDirectorio(med)`**: punto de entrada del directorio; `_purgaSeleccionHorario()` + `_abrirCalendarioMedico()`.
2. **`iniciarFlujo()`**: purga anticipada si existe `reservaCita_preseleccion` y no hay `cita_hora_confirmada`; el blob solo recupera hora si está confirmada.
3. **`_horaActivaParaRenderTR94()`**: azul en HTML **únicamente** con `cita_hora_confirmada === 'true'`.
4. **`mostrarPaso(2)`**: re-hidratación visual solo con hora confirmada.
5. Refactor **`_abrirCalendarioMedico()`** compartido por `seleccionarDoctorParaCita` e ingreso desde directorio.

**Validación:** `node -c js/modulos/citas.js` — OK.

**Estado:** ✅ CERRADO — Flujo nuevo desde directorio sin preselección azul residual.

**Refuerzo (fuga azul persistente):**
- `purgaHorarioEntradaFresca()` elimina también `STORAGE_CITA_EN_PROGRESO` para impedir que `_recuperarEstadoCita` reabra el paso 2 con hora vieja.
- `_persistirProgresoCita` ya no guarda `horaSeleccionada` en el blob hasta `cita_hora_confirmada === 'true'`.
- `_irAPaso(2)` y `_recuperarEstadoCita` solo restauran hora visual si está confirmada.
- `generarCalendario` anula `horaSeleccionada` en memoria cuando no hay confirmación.
- `preseleccionarDoctor` / `agendarCitaGeneral` en `main.js` invocan `purgaHorarioEntradaFresca()` antes de navegar a `citas.html`.

---

## Implementación de Stepper Radial Responsivo para Dispositivos Móviles (TR-106)

### Fecha: 2026-05-22

### Directiva
Transformar el indicador de progreso de agendamiento `#citas-progress-indicator` de un diseño lineal horizontal a un patrón **Radial/Circular** exclusivo para teléfonos celulares (`max-width: 480px`), sin modificar ninguna lógica de JavaScript en `citas.js`.

---

### Estrategia de Coexistencia DOM

El stepper lineal es generado dinámicamente por `actualizarBarraProgreso()` en `citas.js` mediante `indicator.innerHTML = html`, lo que hace imposible inyectar marcado estático dentro del mismo contenedor. La solución fue:

1. **Agregar un div hermano** `#stepper-radial-mobile` inmediatamente después de `#citas-progress-indicator` en `citas.html`. Ambos coexisten en el DOM.
2. **El control de visibilidad** se delega íntegramente a CSS con `display: none !important` y `display: flex !important` según el breakpoint.
3. **La sincronización de estado** (qué paso está activo, cuántos pasos hay, qué dice cada etiqueta) se realiza mediante un `MutationObserver` declarado en un `<script>` inline al final de `citas.html` — sin tocar `citas.js`.

---

### Archivos Modificados

| Archivo | Tipo de cambio |
|---|---|
| `citas.html` | [MODIFY] Inyección de `#stepper-radial-mobile` (HTML) + `<script>` inline MutationObserver |
| `css/styles.css` | [MODIFY] Sección TR-106 completa: estilos radiales + media queries de control |
| `docs/design_sessions/active-design.md` | [MODIFY] Esta bitácora |

---

### Arquitectura CSS (Diseño Dual Responsivo)

#### Para pantallas ≥481px (tablet/escritorio)
```css
@media (min-width: 481px) {
    #stepper-radial-mobile { display: none !important; }
}
```
El stepper lineal funciona exactamente igual que antes. Sin regresión.

#### Para pantallas ≤480px (móvil)
```css
@media (max-width: 480px) {
    /* Ocultar pasos lineales individuales */
    #citas-progress-indicator .citas-progress-step { display: none !important; }
    /* Ocultar línea de conexión horizontal */
    #citas-progress-indicator.citas-progress-container::before { display: none !important; }
    /* Activar stepper radial */
    #stepper-radial-mobile { display: flex !important; /* ... */ }
}
```

---

### Anillo SVG — Cálculo de Progreso

```
Circunferencia = 2π × r = 2π × 42 ≈ 263.89
stroke-dasharray = 263.89  (longitud total del arco)
stroke-dashoffset = 263.89 × (1 − pasoActual/totalPasos)
```

El arco parte desde las 12 en punto gracias a `transform: rotate(-90deg)` aplicado sobre el `<circle>` con `transform-origin: 50px 50px` (centro del viewBox 100×100). El `stroke-linecap: round` produce las puntas redondeadas del arco visibles en la imagen de referencia.

La transición CSS `stroke-dashoffset 0.45s cubic-bezier(0.4, 0, 0.2, 1)` garantiza que el anillo se anime suavemente en cada cambio de paso.

---

### MutationObserver — Sincronización Sin JS en citas.js

```javascript
new MutationObserver(syncRadial).observe(indicator, {
    childList: true, subtree: true,
    attributes: true, attributeFilter: ['class']
});
```

El observer detecta cualquier cambio en `#citas-progress-indicator` (reescritura de `innerHTML` por JS o cambio de clase `.active`). En cada disparo, `syncRadial()`:
1. Lee todos los `.citas-progress-step` y determina cuál tiene `.active`.
2. Calcula `current / total` y el `stroke-dashoffset` resultante.
3. Actualiza `#radial-counter-text` ("X de Y"), `#radial-arc-path` (geometría), `#radial-step-title` (nombre del paso) y `#radial-step-next` ("Siguiente: NombreSiguiente").

Un **fallback** protege el estado inicial: si ningún paso tiene `.active` aún (primer render), se toma el índice 0.

---

### Fidelidad Visual con Imagen de Referencia

| Elemento | Imagen de referencia | Implementación |
|---|---|---|
| Anillo teal sobre fondo gris claro | `stroke: #0DA99F` sobre track `#d5eeec` | ✅ |
| Texto central «1 de 5» en negrita | `font-weight: 700`, `font-family: Montserrat` | ✅ |
| Título del paso en bold grande | `font-weight: 800`, `1.08rem` | ✅ |
| Etiqueta «Siguiente: Calendario» en gris | `color: #6b7a99`, `0.82rem` | ✅ |
| Fondo del contenedor verde-azulado tenue | `background: linear-gradient(#f0fbfa, #e6f6f5)` | ✅ |
| Layout horizontal anillo + texto | `display: flex; gap: 18px; align-items: center` | ✅ |
| Bordes redondeados del card | `border-radius: 18px` | ✅ |

---

### Garantías de Integridad

- ✅ **`citas.js` intacto:** Cero líneas modificadas. Las funciones `_obtenerFasesBarraProgreso`, `_omitirDatosEnFlujo`, `_mapDomPasoABookingOrdinal` y `actualizarBarraProgreso` permanecen sin cambios.
- ✅ **Sin scripts masivos:** Cambio realizado directamente en `citas.html` y `css/styles.css`.
- ✅ **Stepper lineal sin regresión:** En ≥481px la barra horizontal funciona exactamente igual que antes.
- ✅ **Accesibilidad:** `#stepper-radial-mobile` tiene `role="status"`, `aria-live="polite"` y `aria-atomic="true"`. El SVG lleva `aria-hidden="true"` para no contaminar el árbol de accesibilidad.
- ✅ **WCAG contraste:** Texto `#1a2747` sobre fondo `#f0fbfa` → ratio > 7:1. Texto secundario `#6b7a99` sobre mismo fondo → ratio ≥ 4.5:1.

### Estado: ✅ CERRADO — TR-106 implementado y validado.

---

## Ciclo de Borrado de Errores en Tiempo Real — TR-98

### Fecha: 2026-05-22

### Bug Reportado
En el Paso 3 del flujo de agendamiento (`#form-citas-identificacion`), cuando un campo mostraba un mensaje de error tras perder el foco (`blur`), dicho mensaje **no desaparecía** al volver al campo y empezar a escribir la corrección.

---

### Análisis de Causa Raíz

El listener `input` existente en `configurarValidadores()` tenía la limpieza visual en el orden incorrecto:

```javascript
// Código ANTES del fix (orden incorrecto)
el.addEventListener('input', () => {
    app._sanitizarInput(el, ...);   // ← Si esto lanza, lo siguiente nunca corre
    el.style.borderColor = '#ccc';  // ← Podría no ejecutarse
    errorEl.style.display = 'none'; // ← Podría no ejecutarse
    this.actualizarEstadoBotonSiguiente();
});
```

**Problema 1 — Orden de ejecución:** La limpieza estaba colocada DESPUÉS de `app._sanitizarInput()`. Si el sanitizador lanzaba una excepción (p.ej. `app` no inicializado, `_sanitizarInput` no definido), las líneas de limpieza nunca se ejecutaban y el error persistía visualmente.

**Problema 2 — Clases CSS faltantes:** La limpieza solo usaba `el.style.borderColor = '#ccc'`, sin llamar a `el.classList.remove('input-error', 'input-success')`. Si en algún contexto se añadían estas clases con `border-color: red !important`, el inline style `#ccc` no las sobreescribía por la especificidad CSS.

**Problema 3 — Estado no verdaderamente neutral:** `borderColor = '#ccc'` fijaba un color específico en vez de devolver el control al CSS cascade. `borderColor = ''` (cadena vacía) elimina el override inline y restaura el estado nativo de `.form-control`.

---

### Fix Aplicado (Pinpoint en `configurarValidadores`)

**Archivo:** [`js/modulos/citas.js`](file:///c:/Users/ASUS/Documents/5to%20Semestre/Interacción%20Humano%20Computador/Retos/mejora%20reto%204/CentroMedicoDoctoraVeronicaBarahona/js/modulos/citas.js) — función `configurarValidadores()`.

```diff
 el.addEventListener('input', () => {
+    // TR-98: Limpieza inmediata ANTES de sanitizar
+    el.classList.remove('input-error', 'input-success');
+    el.style.borderColor = '';   // elimina override inline → estado nativo CSS
+    const errorEl = document.getElementById(item.err);
+    if (errorEl) errorEl.style.display = 'none';
+
     if (item.id === 'citas-nombres') {
         app._sanitizarInput(el, REGEX_N, EXTRA_N);
     } else {
         app._sanitizarInput(el, /\D/g);
         if (el.value.length > 10) el.value = el.value.slice(0, 10);
     }
-    // Devolvemos el campo a estado neutral mientras el usuario escribe
-    el.style.borderColor = '#ccc';
-    const errorEl = document.getElementById(item.err);
-    if (errorEl) errorEl.style.display = 'none';
     this.actualizarEstadoBotonSiguiente();
 });
```

---

### Comportamiento Resultante

| Evento | Antes del Fix | Después del Fix |
|---|---|---|
| Usuario escribe en campo con error `blur` | Error persiste | Error desaparece en la 1.ª pulsación |
| `app._sanitizarInput` lanza excepción | Limpieza no ejecutada | Limpieza ya ejecutada (está antes) |
| Campo tiene clase `input-error` | Borde rojo persiste (override `!important`) | Clase removida antes de sanitizar |
| Campo tiene clase `input-success` | Estado verde queda | Clase removida correctamente |
| Borde del campo | Fijado en `#ccc` (arbitrario) | Devuelto al CSS cascade nativo |

---

### Garantías de Integridad

- ✅ **Validaciones `blur` intactas:** `_validarCampoAislado()` y `_setEstadoCampo()` no fueron modificados.
- ✅ **`validarPaso3(true)` intacto:** La validación completa al hacer submit sigue pintando todos los errores sin cambios.
- ✅ **`actualizarEstadoBotonSiguiente()` intacto:** Llama a `validarPaso3(false)` que NO pinta errores (guard en línea 3466).
- ✅ **Sin regresión en sanitización:** `app._sanitizarInput` sigue ejecutándose normalmente, ahora simplemente DESPUÉS de la limpieza.
- ✅ **`node -c js/modulos/citas.js` → 0 errores de sintaxis.**

### Estado: ✅ CERRADO — TR-98 implementado, validado y libre de regresiones.

---

## TR-99 — Ciclo de Vida Reactivo de Errores en `#form-citas-identificacion` (Heurística #9)

### Fecha: 2026-05-22

### Bug Reportado (Stale Error State)

En el Paso 3 (`#form-citas-identificacion`), tras un `blur` inválido (p. ej. celular sin prefijo `09`), el contenedor `#error-celular` permanecía visible aunque el usuario borrara o corrigiera el valor, violando la Heurística #9 de Nielsen.

### Implementación (Pinpoint en `js/modulos/citas.js`)

**Helper dedicado** `_limpiarEstadoVisualInputTR99(input, errorId)` — cumple TR-99.2 y TR-99.3:

- `errorEl.style.display = 'none'` sobre `#error-nombres`, `#error-cedula` o `#error-celular`.
- Elimina clases `input-error`, `input-success`, `input-rechazado` y overrides inline (`border-color`, `background-color`, `box-shadow`) del input.
- `removeProperty('opacity')` en el span para neutralizar residuos del sanitizador global (`main.js` TR-72).

**Listeners `input`** en `configurarValidadores()` para `#citas-nombres`, `#citas-cedula` y `#citas-celular`:

```javascript
el.addEventListener('input', () => {
    this._limpiarEstadoVisualInputTR99(el, item.err);
    // … sanitización app._sanitizarInput …
    this.actualizarEstadoBotonSiguiente();
});
```

La validación semántica sigue exclusivamente en `blur` → `_validarCampoAislado()`.

### Garantías de Integridad

- ✅ **Sin cambios en HTML** (`citas.html` intacto).
- ✅ **`blur` / `_setEstadoCampo` / `validarPaso3` intactos** — la validación diferida no se alteró.
- ✅ **`avanzarPaso()`, Supabase, stepper radial móvil** — no modificados.
- ✅ **`actualizarEstadoBotonSiguiente()`** — solo evalúa `validarPaso3(false)`; la limpieza visual no habilita el botón por sí sola.
- ✅ **`node -c js/modulos/citas.js` → 0 errores de sintaxis.**

### Estado: ✅ CERRADO — TR-99 (formulario identificación) implementado según `docs/technical-requirements.md` § TR-99.

---

## TR-72 / TR-73 — Cierre del tooltip «Carácter no permitido» al escribir (Heurística #9)

### Fecha: 2026-05-22

### Problema

Tras rechazar un carácter, el tooltip flotante «Carácter no permitido» (`.sanitizer-wrapper-zero`) permanecía visible hasta que expiraba el TTL de 2,5 s o el usuario hacía `blur`, aunque ya estuviera corrigiendo el valor. El flash `.input-rechazado` de `_sanitizarInput` podía persistir el mismo tiempo.

### Solución (`js/main.js`)

- **`_obtenerErrorNativoInput(inputEl)`** — resuelve el span nativo vía `aria-describedby` o convención `id$="-error"`.
- **`_limpiarFeedbackSanitizer(inputEl)`** — cancela `_sanitizerTooltipTimer`, elimina el wrapper, `removeProperty('opacity')` en el error nativo y quita `.input-rechazado` + `_rechazadoTimer`.
- Listener **`input` (capture)** — invoca la limpieza al inicio de cada pulsación; si el evento vuelve a rechazar un carácter, recrea el tooltip y programa TTL como fallback.
- Listener **`blur` (capture)** — delega en el mismo helper (sin duplicar lógica).

### Garantías

- ✅ Aplica a **todos** los `INPUT` / `TEXTAREA` del MPA (login, citas, widget invitado, registro, etc.).
- ✅ **Sin cambios en HTML** ni en módulos locales (`citas.js`, `recuperacion.js`).
- ✅ TTL 2,5 s conservado solo si el usuario deja de escribir con foco en el campo.
- ✅ **`node -c js/main.js` → 0 errores de sintaxis.**

### Estado: ✅ CERRADO — Tooltip y flash se ocultan en el primer `input`; TTL solo como red de seguridad.

---

## Implementación del Túnel de Reagendamiento Aislado TR-100

### Fecha: 2026-05-22

### Objetivo

Aislar visual y operativamente la **modificación de citas** del wizard de agendamiento nuevo, cumpliendo TR-100 (`docs/technical-requirements.md`): 3 hitos, bloqueo retroactivo y smart jump preservado.

### Cambios en `js/modulos/citas.js` (pinpoint)

| Pieza | Implementación |
|--------|----------------|
| Contexto | `_leerContextoModificacion()` normaliza `modoModificacion: true` en blobs legacy con `id_cita`. |
| Detección | `_esTunelReagendamientoTR100()`. |
| Stepper | `_obtenerFasesBarraProgreso()` bifurca a **Nuevo Horario → Revisión → Confirmación** (DOM 2, 4, 5). El radial móvil (TR-106) sincroniza vía MutationObserver sin tocar HTML. |
| Ordinal | `_mapDomPasoABookingOrdinal(..., tunelReagendamiento)`. |
| Entrada | `iniciarFlujo()` guard con `modoModificacion` y `historialPasos = []` (sin Especialidad/Médico). |
| Smart Jump | `avanzarPaso()` salta al paso 4 para cualquier `modoModificacion` (invitado y titular). |
| Atrás calendario | En paso 2, `.btn-back-minimalist` → **Cancelar modificación** (`_cancelarModificacionTR100`). |
| `irAtras()` | En túnel: paso 2 u origen 0/1 → cancelar; destino 0/1 prohibido; historial vacío → cancelar. |
| Salida | `_cancelarModificacionTR100()`: limpia storage vía `limpiarSessionFlujoCitas`; `origen === 'widget'` → `index.html` + `STORAGE_AUTO_CONSULTA_INVITADO`; `dashboard` / sesión → `mi-salud.html`. |

### Intacto (blindaje)

- `confirmarCita()`, `updateCitaSupabasePorIdCita`, colisiones, `_verificarLimiteDiario`, validaciones `blur`/TR-99, stepper TR-106 en HTML/CSS.
- Sin `replace.js` ni cambios en `citas.html`.

### Verificación

- `node -c js/modulos/citas.js` → 0 errores.

### Estado: ✅ CERRADO — TR-100 implementado en `citas.js`.

---

## Blindaje de Identidad e Inactivación Proxy en Reagendamiento TR-101

### Fecha: 2026-05-22

### Problema

En el Paso 4 (Resumen), un usuario **con cuenta** en reagendamiento (`modoModificacion`) veía el enlace `#proxy-link-container` («Agendar para un familiar»), aunque la identidad del paciente debe ser inmutable en una modificación.

### Causa

En `_mostrarResumen()`, la visibilidad del proxy solo evaluaba `estaLogueado && !modoProxy`, sin considerar `modoModificacion`.

### Fix (pinpoint en `_mostrarResumen`)

- Detección unificada vía `_leerContextoModificacion()` → `esModSmartJump`.
- `#proxy-link-container`: `display: none` cuando `esModSmartJump` es verdadero.
- El bloque `.smart-jump-banner` y el resumen de solo lectura siguen gobernados por `esModSmartJump` (sin cambios en Supabase ni transiciones del wizard).

```javascript
const modCtxResumen = this._leerContextoModificacion();
const esModSmartJump = !!modCtxResumen?.modoModificacion;
const mostrarProxy = estaLogueado && !this.modoProxy && !esModSmartJump;
proxyLinkContainer.style.display = mostrarProxy ? 'block' : 'none';
```

### Verificación

- `node -c js/modulos/citas.js` → 0 errores.

### Estado: ✅ CERRADO — TR-101 aplicado en `_mostrarResumen`.

---

## Estabilización de Contextos de Revisión y Enrutamiento Compartido TR-102

### Fecha: 2026-05-22

### Regresiones corregidas

**TR-102 — Bifurcación de vistas de resumen**

La unificación previa mezclaba plantillas de agendamiento nuevo y reagendamiento. Se restauró la separación estricta en `_mostrarResumen()`:

| `modoModificacion === true` | `modoModificacion` ausente/falso |
|-----------------------------|----------------------------------|
| `_renderResumenReagendamiento()` — banner `.smart-jump-banner`, datos solo lectura, cita anterior tachada | `_renderResumenAgendamientoNuevo()` — resumen estándar interactivo |
| `#proxy-link-container` oculto (TR-101) | Proxy visible si hay sesión y no es `modoProxy` |

Detección de rama: `_esModoModificacionEstricto()` (flag explícito, sin normalización legacy). El túnel TR-100 sigue usando `_leerContextoModificacion()` para routing.

**TR-103 — Enrutamiento desde widget de consulta**

`prepararModificacion()` en `main.js` navegaba a `citas.html` y dependía de un `setTimeout(mostrarPaso(2))` frágil. Ahora `iniciarFlujo()` intercepta al inicio:

- `_debeEntrarCalendarioModificacion()` — `modoModificacion === true` o `origen === 'widget'` con `id_cita`.
- `_entrarCalendarioModificacionTR103()` — purga `STORAGE_CITA_EN_PROGRESO`, post-login y restore; fija paso 2; hidrata médico desde `cita_modificacion` + `reservaCita_preseleccion`; genera calendario.

### Intacto

- Supabase, colisiones, `confirmarCita()`, transiciones del wizard fuera del guard de entrada.

### Verificación

- `node -c js/modulos/citas.js` → 0 errores.

### Estado: ✅ CERRADO — TR-102 (resumen) y TR-103 (enrutamiento calendario) estabilizados en `citas.js`.

---

## Control de Ciclo de Vida y Hard-Reset de Navegación TR-103

### Fecha: 2026-05-22

### Problema

Al reingresar a «Agendar Cita» o cambiar de sección en la MPA, persistían blobs huérfanos (`STORAGE_CITA_EN_PROGRESO`, hora/slot, paso intermedio) que desviaban al usuario a pantallas incorrectas.

### `hardResetCitas(opts)` — `js/modulos/citas.js`

Resetea estado en memoria (`pasoActual = 0`, historial, médico, hora, `_citaTemporal`, calendario) y purga storage efímero. Opciones:

| Opción | Efecto |
|--------|--------|
| `preserveModificacion: true` | Conserva `cita_modificacion` |
| `preservePreseleccion: true` | Conserva `reservaCita_preseleccion` y `especialidad_seleccionada` |

No elimina `STORAGE_AUTO_CONSULTA_INVITADO` ni `sanitas_abrir_detalle_id`.

### Puntos de vinculación

| Origen | Comportamiento |
|--------|----------------|
| `iniciarFlujo()` | Tras guard de reagendamiento y rutas de recuperación (post-login/blob), ejecuta `hardResetCitas({ preservePreseleccion })` antes del paso 0 |
| `purgaHorarioPorDesercionRuta()` | Delega en `hardResetCitas()` (TR-93 navbar) |
| `main.js` → `agendarCitaGeneral()` | Hard-reset total antes de `navegar('citas')` |
| `main.js` → `preseleccionarDoctor` / `seleccionarEspecialidad` | Reset previo; `iniciarFlujo` preserva tokens de preselección |
| `main.js` → `navegar()` | Si sale de `citas.html`, invoca `hardResetCitas()` |
| `main.js` → `iniciarPurgaDesercionRutaTR93()` | Click en `.header__nav-link` desde citas → reset |

### Intacto

- Túnel de reagendamiento (`_entrarCalendarioModificacionTR103`), Supabase, colisiones, formularios del home.

### Verificación

- `node -c js/modulos/citas.js` y `node -c js/main.js` → 0 errores.

### Estado: ✅ CERRADO — TR-103 hard-reset operativo en MPA y entry point de citas.

---

## Persistencia del Stepper y Ocultamiento Proxy en Confirmación TR-104 / TR-105

### Fecha: 2026-05-22

### Problema

Usuario **con cuenta** en reagendamiento:

1. **TR-104:** En el paso 5 (éxito), `#citas-progress-indicator` volvía al stepper de 6 pasos porque `confirmarCita()` eliminaba `cita_modificacion` antes de `mostrarPaso(5)` y `_esTunelReagendamientoTR100()` quedaba en falso.
2. **TR-105:** En el paso 4 (revisión), `#proxy-link-container` seguía visible si el blob venía de `salud.prepararModificacion` sin `modoModificacion: true` explícito (solo `id_cita`), ya que `_esModoModificacionEstricto()` no normaliza legacy.

### Fix (pinpoint en `js/modulos/citas.js`)

| Requisito | Cambio |
|-----------|--------|
| TR-104 | `_esTunelReagendamientoTR100()` también lee `sessionStorage.modoModificacion === 'true'`. Antes de purgar `cita_modificacion`, `confirmarCita()` persiste ese flag si hubo túnel. `actualizarBarraProgreso()` en paso 5 con túnel marca los 3 hitos como `completed` (último con check de éxito). |
| TR-105 | `_mostrarResumen()` oculta proxy con `_esTunelReagendamientoTR100()` (blob + flag); añade clase `.hidden`. Refuerzo en `confirmarCita()` tras éxito. Plantilla de reagendamiento si hay contexto operativo aunque el flag estricto falte. |
| Paso 5 | Aviso «Identidad Mantenida» usa `_esTunelReagendamientoTR100()` en lugar de `cita_modificacion` crudo. |

### Intacto

- Promesas Supabase, `updateCitaSupabasePorIdCita`, calendario, colisiones, TR-106 radial, estructura del wizard.

### Verificación

- `node -c js/modulos/citas.js` → 0 errores.

### Estado: ✅ CERRADO — TR-104 y TR-105 aplicados en `citas.js`.

---

## Corrección de Visibilidad Estática del Modal en la MPA TR-106

### Fecha: 2026-05-22

### Problema

En páginas secundarias de la MPA, el shell `#modal-consulta-invitado` / `#modal-consulta-invitado-body` quedaba en el flujo del documento sin ocultamiento inline. La clase `.modal-content` (fondo blanco, padding, sombra en `styles.css`) se pintaba debajo del footer antes de que `main.js` inyectara las reglas TR-90 de `.hidden`, contaminando el App Shell.

### Causa

El marcado secundario tenía `class="modal hidden"` pero carecía de `style="display: none;"` que sí usa `index.html` (`style="display:none;"` en el overlay). Sin atributo inline, el hijo `.modal-content` era visible en el layout estático.

### Fix (solo HTML — sin tocar `main.js` ni `citas.js`)

Se alineó el bloque final de cada página secundaria con la sintaxis segura del home:

```html
<div id="modal-consulta-invitado" class="modal hidden" role="dialog" aria-modal="true" style="display: none;">
  <div id="modal-consulta-invitado-body" class="modal-content"></div>
</div>
```

| Archivo | Estado |
|---------|--------|
| `citas.html` | ✅ `style="display: none;"` en contenedor raíz |
| `especialistas.html` | ✅ (equivalente a «especialidades» en el inventario del proyecto) |
| `mi-salud.html` | ✅ |
| `farmacia.html` | ✅ |
| `contacto.html` | ✅ |
| `login.html` | ✅ |
| `registro.html` | ✅ |

Los IDs `#modal-consulta-invitado` y `#modal-consulta-invitado-body` se conservan para `_normalizarShellModalMPA()` y `abrirModalConsulta()`.

### Verificación responsive (inspección estructural)

- Contenedor raíz con `display: none` por defecto → el área bajo el footer no recibe caja `.modal-content` en paint inicial.
- Al abrir desde el header, JS remueve `.hidden` y `display` inline (`abrirModalConsulta`) sin cambios en esta iteración.
- `perfil.html` y `recuperar.html` no incluyen el modal (sin botón de consulta invitado en esas rutas).

### Estado: ✅ CERRADO — TR-106 shell oculto en MPA secundaria.

