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