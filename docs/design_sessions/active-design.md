# Sesión de Diseño Activa: Prevención de Overlap Visual en Errores

## 1. Objetivo
Evitar que el mensaje de "Carácter no permitido" (Tooltip Flotante) se superponga (overlap) con los mensajes de error de validación nativos del sistema al perder el foco, implementando una limpieza estricta en el evento `blur`.

## 2. Instrucciones Técnicas para Gemini (Agente)

### A. Modificación del Sanitizador Actual (`js/main.js`)
Busca el `document.addEventListener('input', ...)` que contiene la lógica de sanitización. En la sección 3 ("Feedback Visual y Textual Cero-Impacto"), añade la lógica para ocultar el error nativo temporalmente:

```javascript
// ... dentro del if (valorOriginal !== val) { ...

        // --- NUEVO: PREVENCIÓN DE OVERLAP VISUAL (Oculta el nativo temporalmente) ---
        let errorNativo = null;
        const ariaId = inputEl.getAttribute('aria-describedby');
        if (ariaId) errorNativo = document.getElementById(ariaId);
        if (!errorNativo) errorNativo = inputEl.parentNode.querySelector('span[id$="-error"], .error-text:not(.temp-error-span)');
        
        if (errorNativo) {
            errorNativo.style.setProperty('opacity', '0', 'important'); 
        }
        // -----------------------------------------------------------------------------

        // (Mantén la Inyección de Tooltip Flotante que ya existe aquí...)
        // let tooltipWrapper = inputEl.parentNode...

        // Modifica el bloque del temporizador para restaurar la opacidad:
        if (!window.sanitizerTimers) window.sanitizerTimers = {};
        if (window.sanitizerTimers[inputEl.id]) clearTimeout(window.sanitizerTimers[inputEl.id]);

        window.sanitizerTimers[inputEl.id] = setTimeout(() => {
            const wrapperToRemove = inputEl.parentNode.querySelector('.sanitizer-wrapper-zero');
            if (wrapperToRemove) wrapperToRemove.remove();
            
            // --- NUEVO: RESTAURA EL ERROR NATIVO ---
            if (errorNativo) errorNativo.style.setProperty('opacity', '1', 'important');
        }, 2500);
```

### B. Creación del "Limpiaparabrisas" Global (`js/main.js`)
Añade este NUEVO listener global justo debajo del listener de `input`. Este código destruirá el mensaje flotante si el usuario da clic afuera del campo antes de que acaben los 2.5 segundos.

```javascript
// NUEVO: Destrucción del Tooltip al perder el foco para dejar espacio a la validación nativa
document.addEventListener('blur', (e) => {
    if (!e.target || !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const inputEl = e.target;

    if (window.sanitizerTimers && window.sanitizerTimers[inputEl.id]) {
        clearTimeout(window.sanitizerTimers[inputEl.id]);
        
        const wrapperToRemove = inputEl.parentNode.querySelector('.sanitizer-wrapper-zero');
        if (wrapperToRemove) wrapperToRemove.remove();

        let errorNativo = null;
        const ariaId = inputEl.getAttribute('aria-describedby');
        if (ariaId) errorNativo = document.getElementById(ariaId);
        if (!errorNativo) errorNativo = inputEl.parentNode.querySelector('span[id$="-error"], .error-text:not(.temp-error-span)');
        
        if (errorNativo) errorNativo.style.setProperty('opacity', '1', 'important');
    }
}, { capture: true });
```