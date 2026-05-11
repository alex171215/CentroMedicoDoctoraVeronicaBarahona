# Requisitos Técnicos y Arquitectura (Technical Requirements)

## 1. Stack Tecnológico Front-end
* **Lenguajes:** HTML5, CSS3, Vanilla JavaScript (ES6+).
* **Restricción de Frameworks:** PROHIBIDO el uso de React, Angular, Vue o librerías UI (Bootstrap/Tailwind).
* **Librerías Permitidas:** Solo `html2pdf.js` para generación de comprobantes.

## 2. Estructura de Archivos
* `/index.html`: Estructura SPA principal, modales y vistas inyectables.
* `/css/styles.css`: Hoja de estilos única.
* `/js/app.js`: Controlador principal (Enrutamiento, UI, validaciones).
* `/js/data.js`: Base de datos simulada y funciones de inicialización.
* `/assets/img/`: Recursos gráficos (SVG y WebP).

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