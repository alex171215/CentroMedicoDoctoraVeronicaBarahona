# Sesión de Diseño Activa: Router Global History API (Atrás Nativo)

## 1. Objetivo
Lograr que el botón físico "Atrás" del celular permita retroceder entre pasos de un formulario y cerrar modales sin expulsar al usuario a la vista inicial, garantizando el Control y Libertad del Usuario (Heurística 3).

## 2. Instrucciones Técnicas para Antigravity

### A. Modales Globales (Cierre con Atrás)
* **Localización:** Funciones de apertura de modales (ej. `abrirModalDoc`, `abrirModalSexo`, `abrirModalPassword`, y alertas personalizadas).
* **Acción 1:** Al abrir el modal, añade: `history.pushState({ tipo: 'modal', id: 'id-del-modal' }, '', '#modal');`
* **Acción 2:** Modifica tu evento global `popstate` en `main.js`. Si el evento se dispara, lo PRIMERO que debe hacer es cerrar cualquier modal o overlay que esté visible (`display: flex` o `block`).

### B. Formularios Multi-paso (Registro y Citas)
* **Localización:** Función encargada de avanzar pasos (ej. `siguientePaso(paso)` o `_irAPaso(paso)`).
* **Acción 1:** Al avanzar a un nuevo paso, añade: `history.pushState({ tipo: 'formulario', paso: pasoDestino }, '', '#paso-' + pasoDestino);`
* **Acción 2:** En el evento global `popstate`, añade la lógica:
  `if (e.state && e.state.tipo === 'formulario') {`
  `    invocarFuncionVisualDelPaso(e.state.paso); // Retrocede visualmente sin hacer pushState`
  `}`
* **Fallback:** Si `e.state` es nulo (retrocedió hasta el paso 1 original), forzar visualmente el Paso 1.

### C. Refactorización Segura
* Mantén intacta la lógica de `detalleCita` que ya funciona. Solo añade los casos 'modal' y 'formulario' al mismo listener `popstate`.