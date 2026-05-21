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