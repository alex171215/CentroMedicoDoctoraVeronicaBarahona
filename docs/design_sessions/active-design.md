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