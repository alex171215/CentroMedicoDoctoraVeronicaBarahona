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