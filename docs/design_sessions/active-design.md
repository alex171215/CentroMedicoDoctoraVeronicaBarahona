# Sesión de Diseño Activa: Sincronización Global de Citas con Supabase

## 1. Objetivo
Refactorizar los mecanismos de lectura de citas médicas en el Widget de Invitados y en el módulo de "Mi Salud" para que realicen consultas asíncronas directas a Supabase, eliminando la dependencia del almacenamiento local y permitiendo la persistencia cruzada entre dispositivos móviles y de escritorio.

## 2. Instrucciones Técnicas para Antigravity

### A. Refactorización del Widget de Consulta de Invitados (`js/main.js`)
* **Localización:** Función encargada de buscar y renderizar una cita cuando un usuario sin cuenta ingresa su cédula y código/fecha en la pantalla principal.
* **Lógica asíncrona:** 1. Interceptar el evento de búsqueda y disparar el spinner visual de carga mediante `conCargaGlobal('Sincronizando datos...')`.
  2. Implementar un bloque `try/catch` para ejecutar una consulta directa a la tabla `citas`:
     `await supabase.from('citas').select('*').eq('cedula_paciente', inputCedula)...` (añadir filtros correspondientes según tu lógica de búsqueda).
  3. Si la base de datos devuelve la cita, procesar y pintar la información en el DOM. Si no existen registros, limpiar el contenedor e inyectar el estado vacío correspondiente.

### B. Refactorización del Panel "Mi Salud" (`js/modulos/salud.js` o `js/main.js`)
* **Localización:** Función encargada de inicializar y listar el historial de citas del usuario registrado (ej. `inicializarHistorial()`, `renderizarCitas()`).
* **Lógica asíncrona:**
  1. Al cargar la vista de "Mi Salud", extraer la cédula del `usuarioActivo` autenticado.
  2. Realizar un `SELECT` directo a Supabase filtrando por la clave foránea correspondiente:
     `await supabase.from('citas').select('*').eq('cedula_paciente', usuarioActivo.cedula);`
  3. **Cruces de Información (JOIN UI):** Tomar el `id_especialista` de cada cita recuperada y buscar su equivalente en el listado estático o dinámico de especialistas de la aplicación para extraer e inyectar el nombre del médico en la tarjeta HTML.
  4. Actualizar la interfaz renderizando las tarjetas dinámicamente en sus respectivas secciones ("Próximas" / "Pasadas") según el valor de la columna `estado`.