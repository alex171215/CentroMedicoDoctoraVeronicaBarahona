# Sesión de Diseño Activa: Refactorización del Módulo de Farmacia (IHC)

## 1. Objetivo Crítico (Regla de Negocio e IHC)
Eliminar por completo el modelo mental de "E-commerce" (carrito de compras, precios de venta en línea, botones de añadir al carrito) del módulo de Farmacia, ya que no corresponde al caso de uso de un Centro Médico. 
El módulo debe transformarse en un **"Directorio de Disponibilidad de Medicamentos"** meramente informativo.

## 2. Refactorización de Interfaz (`farmacia.html` y `farmacia.js`)
* **Eliminación:** Borrar cualquier rastro del carrito de compras, resúmenes de pago, insignias de cantidad en el menú y botones de "Añadir al carrito".
* **Nueva UI (Directorio):** Las tarjetas de medicamentos solo deben mostrar: Nombre, Gramaje, Laboratorio, si requiere receta (Insignia) y el **Stock Disponible** (ej. "Disponible en centro: 15 unidades" en color verde, o "Agotado" en color rojo).
* **Buscador/Filtros:** Mantener la barra de búsqueda y los filtros por categoría, ya que son útiles para consultar disponibilidad.

## 3. Integración Transversal (`salud.js`)
* **Cruce de Datos (Recetas):** Cuando un paciente visualiza el detalle de una "Receta Médica" en la sección de "Mi Salud", el sistema debe cruzar el nombre del medicamento recetado con el inventario de la farmacia.
* **Retroalimentación Visual (Heurística 1):** Inyectar una etiqueta (badge) junto a cada medicamento en la receta indicando al paciente si lo puede retirar directamente en la farmacia del centro médico o si debe buscarlo por fuera.

## 4. Restricciones de Arquitectura
* Mantener el estándar POUR de accesibilidad (Focus rings, aria-labels, Focus Traps en modales).
* Prohibido usar alerts nativos.
* Si se emplean variables de estado, mantener el uso de `data.js` o `localStorage` sin asincronismos complejos.