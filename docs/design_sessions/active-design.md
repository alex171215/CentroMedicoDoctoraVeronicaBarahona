# Sesión de Diseño Activa: Restauración de Vista de Registro y Enrutamiento

## 1. Objetivo
Restaurar la visibilidad del formulario de registro de usuario que desapareció tras la última actualización, asegurando que la navegación sea funcional y que se mantengan los nuevos límites de fecha (18-120 años).

## 2. Instrucciones Técnicas para el Agente (main.js)

### A. Diagnóstico de la Vista de Registro
* **Acción:** Localiza la función de navegación (ej. `app.navegar('registro')`) y el objeto o variable que contiene el HTML del formulario de registro.
* **Problema Probable:** Antigravity pudo haber borrado el bloque `innerHTML` del contenedor de registro o haber dejado el contenedor oculto permanentemente.

### B. Restauración Quirúrgica
* **Acción 1:** Si el template HTML desapareció, reconstrúyelo asegurándote de incluir todos los campos originales: Nombres, Apellidos, Tipo de Documento, Identificación, Email, Password y la **Fecha de Nacimiento**.
* **Acción 2:** Asegúrate de que el input de fecha de nacimiento (`#reg-fecha-nac`) siga recibiendo los límites dinámicos (min: hace 120 años, max: hace 18 años) que implementamos con éxito.

### C. Verificación de Eventos
* Asegúrate de que al cargar la vista de registro, se vuelvan a vincular los Listeners de sanitización y validación en tiempo real para evitar que los campos queden "muertos".