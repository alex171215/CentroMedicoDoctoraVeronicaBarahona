# Sesión de Diseño Activa: Acciones de Documento (Patrón de Plantilla Limpia para Recetas)

## 1. Objetivo
Erradicar las impresiones rotas y PDFs ilegibles de las recetas (H4, H8) aplicando el "Patrón de Plantilla Aislada", construyendo el documento desde los datos del objeto y no desde la vista del DOM.

## 2. Instrucciones Técnicas para Antigravity

### A. Lógica de Utilidad (app.js -> app.utilidades)
* **`_generarRecetaHTML(receta)`:** Crea un template string limpio. Debe incluir: Membrete (Logo Sanitas, Médico, Especialidad), Info del Paciente (Nombre, Fecha, Diagnóstico) y una tabla HTML estandarizada con los medicamentos (Nombre, Dosis, Cantidad, Vía).
* **`imprimirReceta(receta)`:** Abre `window.open('', '_blank')`, inyecta el `_generarRecetaHTML` y ejecuta `window.print()`.
* **`descargarPDFReceta(receta)`:** Usa la instancia de `jsPDF` (idéntico a `descargarPDFCita`). 
  * **Regla Crítica de Coordenadas:** Al imprimir la lista de medicamentos del array `receta.medicamentos`, debes inicializar una variable `ejeY` e incrementarla dentro de un bucle `forEach` (ej. `ejeY += 10`) para que cada medicamento se dibuje en una línea nueva sin superponerse.

### B. Funciones Proxy en Salud (app.js -> app.salud)
* Crea `imprimirRecetaActiva(id)` y `descargarRecetaActiva(id)` en `app.salud`.
* Estas funciones deben buscar el objeto en `this._recetas` mediante el ID y pasarlo a las funciones de `app.utilidades`.

### C. Cableado en UI (app.js)
* En `verDetalleReceta`, actualiza los botones `.btn--documento` para que llamen a `app.salud.imprimirRecetaActiva('${idReceta}')` y `app.salud.descargarRecetaActiva('${idReceta}')`.