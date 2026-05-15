# Sesión de Diseño Activa: Reparación de Identidad y Envío de Correos

## 1. Objetivo
Garantizar que el sistema siempre use el nombre real del paciente en los correos, arreglar el envío fallido en el registro y eliminar definitivamente el modal de Chrome.

## 2. Instrucciones para Antigravity

### A. Corrección de Saludo en Recuperación (`recuperacion.js`)
* **Localización:** Función `buscarUsuario()` o similar.
* **Acción:** Asegúrate de que el select a Supabase sea: `.select('correo, nombres')`. 
* **Mapeo:** Pasa `data.nombres` a la función `_enviarOTP()`. Borra el fallback `|| 'Usuario'`. Si el nombre no viene, lanza un error de sistema; el usuario no debe recibir correos anónimos.

### B. Reparación del Registro (`main.js`)
* **El Problema del Correo:** Verifica que `emailjs.init()` esté presente al inicio del archivo. 
* **Acción:** En `_emitirOTPAlEntrarPaso3`, captura el nombre directamente del input: `const nombreReal = document.getElementById('reg-nombre1').value;`. Pásalo al payload de EmailJS.
* **El Hack de Chrome:** Asegura este orden: 1. Guardar pass en sessionStorage. 2. `input.value = ''`. 3. `input.type = 'text'`. 4. Cambiar de paso. (Cambiar el tipo a 'text' confunde totalmente a Chrome y evita el modal al 100%).

### C. Temporizador y Variables
* Cambia todos los contadores de reenvío de OTP a **90 segundos**.
* Payload único de EmailJS en ambos archivos: `{ nombre_usuario, correo_destino, codigo_otp }`.