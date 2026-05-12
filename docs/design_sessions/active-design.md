# Sesión de Diseño Activa: Limpieza de Codificación Específica (index.html)

## 1. Objetivo
Eliminar los caracteres corruptos (Mojibake) que quedaron en el HTML estático, mejorando la legibilidad y estética del sistema.

## 2. Instrucciones Técnicas para Antigravity

### A. Limpieza Quirúrgica en index.html
* **Acción:** Buscar y reemplazar EXACTAMENTE estas secuencias en el archivo `index.html` (especialmente en el footer y en cualquier `<select>` u `option`):
  1. `â€“` -> Reemplazar por `-` (guion medio). Ejemplo: "7:00 â€“ 17:00" debe ser "7:00 - 17:00".
  2. `SÍGUENOS Ó` -> Reemplazar por `SÍGUENOS` (Eliminar la Ó huérfana).
  3. `Seleccionaraâ€` -> Reemplazar por `Seleccionar...` o la palabra correcta según el contexto.
  4. Revisar si hay alguna ocurrencia de `â€œ` o `â€` (comillas inglesas rotas) y reemplazarlas por `"` normales.