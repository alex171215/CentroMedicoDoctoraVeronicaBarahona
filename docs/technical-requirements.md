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

## 6. Estándares de Validación y Eventos
* **Regex Whitelisting (`input` event):** Campos de búsqueda blindados en tiempo real contra XSS/SQLi permitiendo solo caracteres alfabéticos.
* **Feedback Contextual (`blur` event):** La validación de formularios DEBE ejecutarse al perder el foco y proporcionar mensajes granulares (H9). **REGLA CRÍTICA:** La validación NO debe ignorar los campos vacíos. Si el evento `blur` ocurre y el campo está vacío (`""`), debe inyectar el error de "campo obligatorio".
* **Persistencia de Errores:** Una vez que un campo muestra un error, este no debe desaparecer hasta que el usuario corrija el valor.
* **Sanitización en Tiempo Real:** Los campos de búsqueda y nombres deben usar Regex en el evento `input` para impedir físicamente la entrada de caracteres no permitidos (Whitelist).
* **Mensajes Granulares:** No usar mensajes genéricos. El sistema debe distinguir entre "Campo vacío", "Formato incorrecto" y "Valor inválido por lógica de negocio".
* **Aislamiento de Validación (Atomic Blur):** El evento `blur` debe ser atómico. Solo se debe validar y mostrar error en el elemento específico que perdió el foco (`event.target`). Está PROHIBIDO disparar validaciones visuales en campos que el usuario aún no ha visitado o modificado.