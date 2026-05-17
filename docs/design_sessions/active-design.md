# Sesión de Diseño Activa: Corrección de History API y Botón "Atrás" Móvil

## 1. Objetivo
Unificar la History API con las funciones de cierre/retroceso existentes del sistema, solucionando el bug donde el botón "Atrás" del celular rompe el flujo dinámico de los formularios o expulsa al usuario de la página.

## 2. Instrucciones Técnicas para Antigravity

### A. Refactorización de la Escucha Global (`js/main.js` o `app.js`)
* **Acción:** Reemplaza el EventListener actual de `popstate` por este patrón de delegación segura:
  ```javascript
  window.addEventListener('popstate', (ev) => {
      const st = ev.state;
      
      // 1. Prioridad: Cerrar Modales Abiertos
      const modalAbierto = document.querySelector('.modal-overlay[style*="display: flex"], .modal-overlay[style*="display: block"]');
      if (modalAbierto) {
          const btnCerrar = modalAbierto.querySelector('.modal-cerrar, .btn-secondary, .reg-cancel-link span');
          if(btnCerrar) btnCerrar.click(); 
          else modalAbierto.style.display = 'none';
          return;
      }

      // 2. Prioridad: Cerrar Detalle de Cita en "Mi Salud"
      const detalleEl = document.getElementById('salud-cita-detalle');
      if (detalleEl?.style.display === 'block') {
          if (typeof app.salud._ocultarDetalleCitas === 'function') app.salud._ocultarDetalleCitas();
          return;
      }

      // 3. Retroceso Inteligente en Citas (Respeta Smart Jumps)
      if (st && st.tipo === 'formulario-citas') {
          app.citas._suppressHistorialPush = true;
          app.citas.irAtras(); 
          app.citas._suppressHistorialPush = false;
          return;
      }

      // 4. Retroceso Inteligente en Registro
      if (st && st.tipo === 'formulario-reg') {
          app.registro._suppressPushState = true;
          if (typeof app.registro.pasoAnterior === 'function') app.registro.pasoAnterior(st.paso + 1); // o la función equivalente
          app.registro._suppressPushState = false;
          return;
      }
  });
  ```

### B. Garantizar los pushState en Aperturas
* **Acción:** Revisa TODAS las funciones que abren modales (ej. `abrirModalDoc`, `abrirModalSexo`, `abrirModalPassword`, modales de error/éxito) y asegúrate de que inyecten `history.pushState({ modal: true }, '', '');` inmediatamente antes de poner `display: flex/block`.

### C. Actualizar Funciones de Retroceso (`citas.js`, `main.js`)
* **Acción:** Verifica que las funciones como `app.citas.irAtras()` NO ejecuten internamente `history.back()` ni `history.pushState()` si la bandera `_suppressHistorialPush` está en `true`, para evitar bucles infinitos de enrutamiento.