# Restricciones Absolutas para Agentes de IA (AI Constraints)

Al actuar sobre este repositorio, el Agente IA debe obedecer incondicionalmente las siguientes reglas operativas:

## 1. Modificación de Código
* **No reescribas código innecesario:** Entrega únicamente los bloques modificados o añadidos.
* **Prohibición de Frameworks:** No inyectes sintaxis de React/JSX, jQuery o clases de Tailwind. Escribe puro Vanilla JS y CSS personalizado utilizando las variables CSS existentes (ej. `var(--action-color)`).
* **Respeto a las Validaciones:** No alteres ni elimines la lógica de validación actual basada en el evento `blur`.

## 2. Rendimiento y Diseño Visual
* **Mobile First Riguroso:** Todo CSS base DEBE escribirse para `320px` en adelante. Usa media queries ascendentes (`min-width: 768px`, `min-width: 1024px`) para adaptar el diseño.
* **Formatos Optimizados:** Cualquier etiqueta `<img>` insertada o modificada debe contemplar el uso de SVG para gráficos/iconos y WebP para fotografías. 
* **Tamaños Fluidos:** Usa porcentajes o `max-width: 100%` para contenedores e imágenes; no uses anchos fijos en píxeles que rompan la vista móvil.

## 3. Entorno de Ejecución
* **No utilices herramientas de navegador automatizadas:** No ejecutes `browser_tools` ni hagas renders de prueba a menos que se te solicite explícitamente, para optimizar el consumo de tokens. Confía en tu análisis estático del código.