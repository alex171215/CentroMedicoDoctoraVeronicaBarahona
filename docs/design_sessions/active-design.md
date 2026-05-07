# Sesión de Diseño Activa: Refactorización de UI y Sistema de Diseño

## 1. Objetivo
Realizar una auditoría visual en el frontend (index.html y styles.css) para limpiar inconsistencias, eliminar estilos inline y aplicar el nuevo Sistema de Diseño de 5 niveles, cumpliendo con la Heurística de Consistencia (H4).

## 2. Instrucciones Técnicas para Antigravity

### A. Creación del Sistema de Clases (styles.css)
* Lee la nueva regla de "Jerarquía y Semántica de Botones" en `golden-rules.md`.
* Traduce esos 5 niveles en clases CSS reales dentro de `styles.css`. 
* Elimina cualquier clase de botón vieja que cause redundancia. Asegúrate de usar las variables CSS globales si ya existen.

### B. Auditoría y Reemplazo en DOM (index.html)
Escanea el HTML, limpia los atributos `style="..."` quemados y aplica las nuevas clases:
1. **Botón "Siguiente" (Login/Registro):** Actualmente es gris. Cámbialo a `.btn--accion` (Naranja).
2. **Botón "Imprimir":** Actualmente tiene un color morado extraño (`#6149A3`). Cámbialo a `.btn--secundario`.
3. **Pantalla de Éxito (Comprobante):** - "Volver al Inicio" -> `.btn--primario`.
   - "Descargar PDF" -> `.btn--secundario`.
   - "Imprimir" -> `.btn--secundario`.
4. **Botón "Abandonar reserva":** Cámbialo a `.btn--secundario` y asegúrate de que tenga el padding adecuado para que parezca un botón.
5. **Enlaces Sueltos:** Los textos "Cancelar Registro" y "¿Ya tienes cuenta? Inicia sesión" deben usar la nueva clase `.enlace-accion` para heredar el cursor pointer y el subrayado interactivo.

**Restricción Estricta:** NO modifiques las funciones `onclick`, IDs, ni ninguna lógica de JavaScript. Solo modifica los atributos `class`, elimina clases obsoletas y limpia los estilos inline en el HTML.