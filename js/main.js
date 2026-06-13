import { utilidades } from './modulos/utilidades.js';
import { supabase } from './supabaseClient.js';
import { estado, STORAGE_CITA_EN_PROGRESO, STORAGE_CITA_POST_LOGIN, STORAGE_AUTO_CONSULTA_INVITADO } from './estado.js';
import { createCitas } from './modulos/citas.js';
import { salud } from './modulos/salud.js';
import { farmacia } from './modulos/farmacia.js';
import {
    conCargaGlobal,
    fetchEspecialistasSupabase,
    mergeCarteraEnSanitasFamDb,
    loginPacientePorIdentificadorYPassword,
    mapPacienteAUsuarioActivo,
    insertPacienteSupabase,
    pacienteDesdeRegistroLocal,
    updatePacientePorCedula,
    updateCitaSupabasePorIdCita,
    fetchPacienteRegistroPorCedula,
    registrarPacienteCondicionalTR110,
    correoOcupadoPorOtraCedula,
    fetchCitasMiSaludPorCedula
} from './modulos/supabaseServicio.js';
import { registroOtpControl } from './modulos/registro.js';

// function enviarCorreoOTP(correo, codigo) {}

function escapeHtmlWidget(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** TR-26: catálogo de especialistas ya persistido (cache-first). */
function carteraEspecialistasCacheValida() {
    try {
        const raw = localStorage.getItem('sanitasFam_db');
        if (!raw) return false;
        const db = JSON.parse(raw);
        const arr = db && db.cartera_especialistas;
        return Array.isArray(arr) && arr.length > 0;
    } catch (_) {
        return false;
    }
}

/** Mapa vista lógica → URL física (MPA). */
const MPA_VISTA_URL = {
    home: 'index.html',
    login: 'login.html',
    registro: 'registro.html',
    'registro-1': 'registro.html',
    especialistas: 'especialistas.html',
    citas: 'citas.html',
    'mi-salud': 'mi-salud.html',
    farmacia: 'farmacia.html',
    'editar-perfil': 'perfil.html',
    perfil: 'perfil.html',
    contacto: 'contacto.html',
};

/* Usuarios demo: crear en Supabase (tabla pacientes) para pruebas multi-dispositivo. */


const app = {
    // Variables de estado
    intervaloCarrusel: null,
    tiempoCarrusel: 7000, // 7 segundos exigidos por reglas de usabilidad (IHC)

    abrirModalLogout: function () {
        const modal = document.getElementById('modal-logout');
        if (modal) {
            modal.style.display = 'flex';
            history.pushState({ modal: 'modal-logout' }, '', '#logout');
        }
    },

    cerrarModalLogout: function () {
        const modal = document.getElementById('modal-logout');
        if (modal) {
            modal.style.display = 'none';
            if (history.state && history.state.modal === 'modal-logout') {
                history.back();
            }
        }
    },

    async ejecutarLogout() {
        // Cerrar el modal visualmente SIN llamar history.back() para no navegar
        // accidentalmente a la página anterior del historial del browser (mi-salud.html, etc.)
        const modal = document.getElementById('modal-logout');
        if (modal) modal.style.display = 'none';
        try {
            await conCargaGlobal(async () => {
                return new Promise(resolve => {
                    localStorage.clear();
                    sessionStorage.clear();
                    setTimeout(resolve, 800);
                });
            }, 'Cerrando sesión...');

            window.location.replace('index.html');
        } catch (err) {
            console.error('Error al cerrar sesión:', err);
            window.location.replace('index.html');
        }
    },

    // ------------------------------------------------------------------
    // TR-48: Auto-Scroll y Auto-Focus al primer campo inválido (WCAG 2.2 / H1)
    // Uso: app.enfocarPrimerError(contenedorId?) — pasa el id del paso/panel
    //      opcional para limitar la búsqueda a ese contenedor.
    // ------------------------------------------------------------------
    enfocarPrimerError(contenedorId = null) {
        const raiz = contenedorId
            ? (document.getElementById(contenedorId) ?? document)
            : document;

        // 1. Buscar el primer span de error que esté actualmente visible
        const primerSpanError = raiz.querySelector(
            '.login-field__error[style*="block"], ' +
            '.citas-error-msg[style*="block"], ' +
            '[id$="-error"][style*="block"]'
        );

        if (!primerSpanError) return;

        // 2. Subir al padre .login-field (o contenedor hermano) y buscar el input
        const contenedorCampo = primerSpanError.closest(
            '.login-field, .reg-select-wrap, .citas-form-group, .widget-invitado__field'
        ) ?? primerSpanError.parentElement;

        const campo = contenedorCampo?.querySelector(
            'input:not([type="radio"]):not([type="checkbox"]), select, textarea'
        ) ?? document.getElementById(
            primerSpanError.id?.replace(/-error$/, '') ?? ''
        );

        if (!campo) return;

        // 3. Scroll suave al centro de la pantalla + foco inmediato
        campo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // El foco llega justo después del scroll (requestAnimationFrame evita
        // que el navegador ignore el foco por el scroll en progreso)
        requestAnimationFrame(() => campo.focus({ preventScroll: true }));
    },

    init: async function () {
        try {
            const refrescarUI = () => {
                if (document.getElementById('doctors-carousel')) {
                    this.renderizarEspecialidadesHome();
                }
                if (document.getElementById('specialists-directory-grid')) {
                    this.directorio.inicializar();
                }
                if (
                    document.getElementById('view-citas') &&
                    this.citas &&
                    typeof this.citas.renderizarPasoEspecialidades === 'function'
                ) {
                    try {
                        this.citas.renderizarPasoEspecialidades();
                    } catch (uiErr) {
                        console.warn('[App] No se pudo refrescar la vista de citas tras actualizar especialistas.', uiErr);
                    }
                }
            };

            if (carteraEspecialistasCacheValida()) {
                refrescarUI();
                fetchEspecialistasSupabase().then(lista => {
                    if (lista.length) {
                        mergeCarteraEnSanitasFamDb(lista);
                        refrescarUI();
                    }
                }).catch(err => {
                    console.warn('[Supabase] Refresco de especialistas no disponible.', err);
                });
            } else {
                await conCargaGlobal(async () => {
                    const lista = await fetchEspecialistasSupabase();
                    if (lista.length) {
                        mergeCarteraEnSanitasFamDb(lista);
                        refrescarUI();
                    }
                }, 'Cargando especialistas…');
            }
        } catch (err) {
            console.warn('[Supabase] Especialistas no disponibles; se usa caché local (data.js).', err);
        }

        this.iniciarMenuMovil();
        this._initOfflineDetection();
        this.iniciarPurgaDesercionRutaTR93();

        // TR-72: Sanitizador Global con Floating Tooltips (OWASP / H1 / H4)
        document.addEventListener('input', (e) => {
            if (!e.target || !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

            const inputEl = e.target;
            // Heurística #9: al escribir, ocultar tooltip y flash sin esperar TTL ni blur.
            this._limpiarFeedbackSanitizer(inputEl);

            let val = inputEl.value;
            let valorOriginal = val;
            const id = (inputEl.id || '').toLowerCase();
            const type = inputEl.type;

            // 1. Anti-espacios iniciales
            if (val.startsWith(' ')) { val = val.trimStart(); }

            // 2. Mapeo Estricto por ID
            if (id === 'login-cedula') {
                // TR-128: solo dígitos en login
                val = val.replace(/[^0-9]/g, '');
            }
            else if (id === 'widget-cedula' || id === 'citas-cedula' || id === 'reg-identificacion' || id.includes('codigo') || id.includes('celular') || id.includes('telefono')) {
                val = val.replace(/[^0-9]/g, '');
            }
            else if (id === 'buscador-especialistas' || id.includes('nombre') || id.includes('apellido')) {
                val = val.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g, '');
            }
            else if (type === 'email' || id.includes('correo') || id.includes('identificador')) {
                val = val.replace(/[^a-zA-Z0-9@._-]/g, '');
            }
            else if (type === 'password' || id.includes('password')) {
                val = val.replace(/[<>"'; ]/g, '');
            }
            else {
                val = val.replace(/[<>"';]/g, '');
            }

            // 3. Feedback Visual y Textual Cero-Impacto
            if (valorOriginal !== val) {
                inputEl.value = val;

                // Flash Animation (Nativa)
                try {
                    inputEl.animate([
                        { backgroundColor: '#ffebee', borderColor: '#d32f2f' },
                        { backgroundColor: 'transparent', borderColor: inputEl.style.borderColor || 'transparent' }
                    ], { duration: 400, easing: 'ease-out' });
                } catch (err) { }

                // TR-128: Campos de cédula — mostrar mensaje en el span de error estándar
                // Se usa setTimeout(0) para diferir la inyección del mensaje hasta que todos
                // los handlers síncronos del elemento (que limpian el span) hayan terminado.
                const CAMPOS_CEDULA = ['login-cedula', 'widget-cedula', 'citas-cedula', 'reg-identificacion'];
                if (CAMPOS_CEDULA.includes(id)) {
                    if (inputEl._msgRechazoTimer) {
                        clearTimeout(inputEl._msgRechazoTimer);
                        delete inputEl._msgRechazoTimer;
                    }
                    // Guardar handle del defer para poder cancelarlo si el usuario
                    // escribe un carácter válido antes de que el setTimeout(0) dispare.
                    if (inputEl._msgRechazoDefer) clearTimeout(inputEl._msgRechazoDefer);
                    inputEl._msgRechazoDefer = setTimeout(() => {
                        delete inputEl._msgRechazoDefer;
                        const ariaId = inputEl.getAttribute('aria-describedby');
                        const errorSpan = ariaId ? document.getElementById(ariaId) : null;
                        if (errorSpan) {
                            // Siempre sobrescribir: _limpiarEstadoVisualInputTR99 oculta el span
                            // pero NO limpia textContent, así que la condición anterior
                            // (!trim()) fallaba si había un error de blur previo.
                            errorSpan.textContent = 'Carácter no permitido';
                            errorSpan.style.display = 'block';
                            if (inputEl._msgRechazoTimer) clearTimeout(inputEl._msgRechazoTimer);
                            inputEl._msgRechazoTimer = setTimeout(() => {
                                if (errorSpan.textContent === 'Carácter no permitido') {
                                    errorSpan.textContent = '';
                                    errorSpan.style.display = 'none';
                                }
                                delete inputEl._msgRechazoTimer;
                            }, 1500);
                        }
                    }, 0);
                } else {
                    // Otros campos: tooltip flotante (no afecta layout)
                    // TR-73: Prevención de Overlap — Oculta el error nativo mientras el tooltip flota
                    const errorNativo = this._obtenerErrorNativoInput(inputEl);
                    if (errorNativo) errorNativo.style.setProperty('opacity', '0', 'important');

                    // Inyección de Tooltip Flotante (Evita romper Layouts como la Lupa)
                    let tooltipWrapper = inputEl.parentNode.querySelector('.sanitizer-wrapper-zero');
                    if (!tooltipWrapper) {
                        tooltipWrapper = document.createElement('div');
                        tooltipWrapper.className = 'sanitizer-wrapper-zero';
                        tooltipWrapper.style.cssText = 'position: relative; width: 100%; height: 0; overflow: visible; pointer-events: none; z-index: 9999; display: block !important;';

                        const msgSpan = document.createElement('span');
                        msgSpan.style.cssText = 'position: absolute; left: 0; top: 4px; color: #d32f2f; font-size: 0.875rem; font-weight: 500; font-family: inherit; white-space: nowrap; background: transparent; padding: 0; box-shadow: none;';
                        msgSpan.textContent = 'Carácter no permitido';

                        tooltipWrapper.appendChild(msgSpan);
                        inputEl.insertAdjacentElement('afterend', tooltipWrapper);
                    }

                    // TTL 2.5s — fallback si el usuario deja de escribir sin blur
                    if (inputEl._sanitizerTooltipTimer) clearTimeout(inputEl._sanitizerTooltipTimer);
                    inputEl._sanitizerTooltipTimer = setTimeout(() => {
                        this._limpiarFeedbackSanitizer(inputEl);
                    }, 2500);
                }
            }
        }, { capture: true });

        // TR-73: Limpiaparabrisas — destruye el Tooltip al perder el foco
        document.addEventListener('blur', (e) => {
            if (!e.target || !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            this._limpiarFeedbackSanitizer(e.target);
        }, { capture: true });
        if (document.querySelector('.hero__carousel')) {
            this.iniciarCarrusel();
        }
        if (document.getElementById('doctors-carousel')) {
            this.iniciarCarruselEspecialistas();
            this.renderizarEspecialidadesHome();
        }

        this.iniciarSesionUsuario();

        // TR-85: Inicialización incondicional (el nodo raíz de inyección existe aunque el widget ya no esté)
        if (app.widgetInvitado && typeof app.widgetInvitado.inicializar === 'function') {
            app.widgetInvitado.inicializar();
        }
        if (document.getElementById('login-form')) {
            app.login.inicializar();
        }
        if (document.getElementById('view-registro')) {
            app.registro.inicializar();
        }
        if (document.getElementById('specialists-directory-grid')) {
            app.directorio.inicializar();
        }
        if (document.getElementById('view-farmacia')) {
            app.farmacia.inicializar();
        }
        if (document.getElementById('view-mi-salud')) {
            await app.salud.inicializar();
        }
        if (document.getElementById('view-citas')) {
            await app.citas.iniciarFlujo();
        }
        if (document.getElementById('edit-nombre1')) {
            app.perfil._rellenarFormularioEditarDesdeStorage();
        }

        this._initModalAccessibility();

        // ── Bloque A: Inyectar límites de fecha (hoy → hoy + 2 meses) en todos los date inputs ──
        this._aplicarLimitesFechaGlobal();

        // ── Expiración de borrador al volver a la pestaña ──
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && app.registro) {
                app.registro._verificarExpiracionBorrador();
            }
        });

        this._mpaRedirigirHashLegacy();
        this._mpaEnfocarPaginaActual();
        this.currentView = this._mpaVistaDesdePathname();

        // TR-52/TR-53 (rev2): Router global History API — botón "Atrás" en móvil y navegador.
        // REGLA DE ORO (TR-53): este listener NO calcula pasos matemáticamente.
        // Su única función es ser el "gatillo" que dispara las funciones de cierre/retroceso
        // ya existentes en el sistema (delegación estricta), respetando los Smart Jumps (H3).
        window.addEventListener('popstate', (ev) => {
            const st = ev.state;

            // ── PRIORIDAD 1: Modal overlay visible ──
            // Buscar usando el selector de atributo de estilo para mayor compatibilidad.
            const modalAbierto = document.querySelector(
                '.modal-overlay[style*="display: flex"], .modal-overlay[style*="display: block"]'
            );
            if (modalAbierto) {
                // Intentar activar el botón de cierre propio del modal para que se ejecute
                // su lógica de cleanup (foco, limpieza de estado, etc.).
                const btnCerrar = modalAbierto.querySelector(
                    '.modal-cerrar, [data-reg-cerrar-modal], .btn-cerrar-modal'
                );
                if (btnCerrar) {
                    btnCerrar.click();
                } else {
                    // Fallback: ocultar directamente si no hay botón de cierre
                    modalAbierto.style.display = 'none';
                    // Caso especial: modal-consulta-cita (widget invitado) tiene estado interno
                    if (modalAbierto.id === 'modal-consulta-cita') {
                        app.widgetInvitado?.cerrarModal?.();
                    }
                }
                return;
            }

            // ── PRIORIDAD 2: Detalle de cita en Mi Salud (TR-52) ──
            const detalleEl = document.getElementById('salud-cita-detalle');
            if (detalleEl && detalleEl.style.display === 'block') {
                if (app.salud && typeof app.salud._ocultarDetalleCitas === 'function') {
                    void app.salud._ocultarDetalleCitas();
                }
                return;
            }

            // ── PRIORIDAD 3: Formulario multi-paso de CITAS (Smart Jumps) ──
            // Delegamos a irAtras() que lee historialPasos[] — NO calculamos paso - 1.
            // irAtras() ya gestiona _suppressHistorialPush internamente (sin bucle).
            if (st && st.tipo === 'formulario-citas') {
                if (app.citas && typeof app.citas.irAtras === 'function') {
                    // Activar flag antes por si irAtras llama a mostrarPaso sincrónicamente
                    app.citas._suppressHistorialPush = true;
                    try {
                        app.citas.irAtras();
                    } finally {
                        app.citas._suppressHistorialPush = false;
                    }
                }
                return;
            }

            // ── PRIORIDAD 4: Formulario multi-paso de REGISTRO ──
            // TR-54: Delegamos a irAtras() que lee _pasoActual como fuente de verdad.
            // _suppressPushState ya está activo para bloquear pushState en _irAPaso (sin bucle).
            if (st && st.tipo === 'formulario-reg') {
                if (app.registro && typeof app.registro.irAtras === 'function') {
                    app.registro._suppressPushState = true;
                    try {
                        app.registro.irAtras();
                    } finally {
                        app.registro._suppressPushState = false;
                    }
                }
                return;
            }

            // ── PRIORIDAD 5: Formulario de Recuperación de Contraseña ──
            // TR-54: Delegamos a recuperacion.irAtras() que lee _faseActual como fuente de verdad.
            if (st && st.tipo === 'formulario-recuperar') {
                if (window.recuperacion && typeof window.recuperacion.irAtras === 'function') {
                    window.recuperacion.irAtras();
                }
                return;
            }

            // ── FALLBACK: Verificar si el usuario está en el formulario de citas ──
            // Cuando retrocede al estado base (replaceState del init), ev.state tiene
            // {tipo:'formulario-citas', paso:0}. Si por cualquier razón st es null pero
            // el DOM muestra el formulario de citas activo, también interceptamos.
            const pasoVisible = [0, 1, 2, 3, 4, 5].find(n => {
                const el = document.getElementById(`citas-step-${n}`);
                return el && el.style.display === 'block';
            });
            if (pasoVisible !== undefined && pasoVisible > 0) {
                // El usuario está dentro del formulario multi-paso de citas
                if (app.citas && typeof app.citas.irAtras === 'function') {
                    app.citas._suppressHistorialPush = true;
                    try {
                        app.citas.irAtras();
                    } finally {
                        app.citas._suppressHistorialPush = false;
                    }
                }
                return;
            }

            // Ninguna vista dinámica activa — el navegador navega entre páginas.
        });

        console.log("Sistema del Centro Médico inicializado correctamente.");
    },

    /** Desde index.html con #login, #citas, etc. redirige al HTML físico correspondiente. */
    _mpaRedirigirHashLegacy() {
        const h = window.location.hash.replace(/^#/, '');
        if (!h) return;
        if (h === 'contacto') {
            const file = (window.location.pathname.split('/').pop() || 'index.html').split('?')[0].toLowerCase();
            if (file === 'index.html') {
                window.location.replace(new URL('contacto.html', window.location.href).href);
                return;
            }
            const el = document.getElementById('contacto');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
            return;
        }
        const dest = MPA_VISTA_URL[h];
        if (!dest) return;
        const u = new URL(dest, window.location.href);
        const cur = new URL(window.location.href);
        if (cur.pathname !== u.pathname || (u.hash && cur.hash !== u.hash)) {
            window.location.replace(u.href);
        }
    },

    /** WCAG: foco al h1/h2 principal de la página actual (solo si existe en el DOM). */
    _mpaEnfocarPaginaActual() {
        const file = (window.location.pathname.split('/').pop() || 'index.html').split('?')[0].toLowerCase();
        const map = {
            'index.html': 'home',
            'login.html': 'login',
            'registro.html': 'registro',
            'especialistas.html': 'especialistas',
            'citas.html': 'citas',
            'mi-salud.html': 'mi-salud',
            'farmacia.html': 'farmacia',
            'perfil.html': 'editar-perfil',
            'contacto.html': 'contacto',
        };
        const pseudo = map[file] || 'home';
        this._enfocarEncabezadoVista(pseudo);
    },

    // ── Bloque A: Utilidad de límites de fecha (H5 – Prevención de errores) ──
    obtenerRangosFecha() {
        const hoy = new Date();

        const fechaHoy = hoy.toISOString().split('T')[0];

        const maxCitas = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());
        const en2Meses = maxCitas.toISOString().split('T')[0];

        // TR-13: Titulares de cuenta → mínimo 18 años, máximo 100 años
        // new Date(año, mes, día) maneja años bisiestos de forma nativa.
        const minNac = new Date(hoy.getFullYear() - 100, hoy.getMonth(), hoy.getDate());
        const hace100Anios = minNac.toISOString().split('T')[0];

        const maxNac = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate());
        const hace18Anios = maxNac.toISOString().split('T')[0];

        // Alias de compatibilidad para código anterior que usaba 'hace90Anios'
        const hace90Anios = hace100Anios;
        const hace120Anios = hace100Anios;

        return { hoy: fechaHoy, en2Meses, hace100Anios, hace120Anios, hace90Anios, hace18Anios };
    },

    _aplicarLimitesFechaGlobal() {
        const rangos = this.obtenerRangosFecha();

        // Aplicar a TODOS los inputs date del sistema
        const dateInputs = document.querySelectorAll('input[type="date"]');
        dateInputs.forEach(input => {
            if (input.id === 'reg-fecha-nac' || input.id === 'edit-fecha-nac') {
                // TR-13 – Titular de cuenta: 18 años mínimo, 120 años máximo
                input.setAttribute('min', rangos.hace120Anios);
                input.setAttribute('max', rangos.hace18Anios);
                // UX: abrir el selector por defecto en el año que cumple exactamente 18
                input.setAttribute('value', rangos.hace18Anios);
            } else {
                // Bloque B: Agendamiento y Buscador (hoy a en 2 meses)
                input.setAttribute('min', rangos.hoy);
                input.setAttribute('max', rangos.en2Meses);
            }
        });
    },

    // Resuelve el span de error nativo asociado a un input (aria-describedby o convención id).
    _obtenerErrorNativoInput(inputEl) {
        if (!inputEl) return null;
        const ariaId = inputEl.getAttribute('aria-describedby');
        if (ariaId) {
            const byAria = document.getElementById(ariaId);
            if (byAria) return byAria;
        }
        return inputEl.parentNode?.querySelector(
            'span[id$="-error"], .error-text:not(.temp-error-span)'
        ) || null;
    },

    // TR-72/TR-73: Destruye tooltip "Carácter no permitido", cancela TTL y flash .input-rechazado.
    _limpiarFeedbackSanitizer(inputEl) {
        if (!inputEl) return;

        if (inputEl._sanitizerTooltipTimer) {
            clearTimeout(inputEl._sanitizerTooltipTimer);
            delete inputEl._sanitizerTooltipTimer;
        }

        // TR-128: limpiar mensaje "Carácter no permitido" en el span de error de cédula
        if (inputEl._msgRechazoDefer) {
            clearTimeout(inputEl._msgRechazoDefer);
            delete inputEl._msgRechazoDefer;
        }
        if (inputEl._msgRechazoTimer) {
            clearTimeout(inputEl._msgRechazoTimer);
            delete inputEl._msgRechazoTimer;
            const ariaId = inputEl.getAttribute('aria-describedby');
            const errorSpan = ariaId ? document.getElementById(ariaId) : null;
            if (errorSpan && errorSpan.textContent === 'Carácter no permitido') {
                errorSpan.textContent = '';
                errorSpan.style.display = 'none';
            }
        }
        const legacyId = inputEl.id;
        if (legacyId && window.sanitizerTimers?.[legacyId]) {
            clearTimeout(window.sanitizerTimers[legacyId]);
            delete window.sanitizerTimers[legacyId];
        }

        const wrapper = inputEl.parentNode?.querySelector('.sanitizer-wrapper-zero');
        if (wrapper) wrapper.remove();

        const errorNativo = this._obtenerErrorNativoInput(inputEl);
        if (errorNativo) errorNativo.style.removeProperty('opacity');

        if (inputEl._rechazadoTimer) {
            clearTimeout(inputEl._rechazadoTimer);
            delete inputEl._rechazadoTimer;
        }
        inputEl.classList.remove('input-rechazado');
    },

    // ═══════════════════════════════════════════════════════════════════════
    // SANITIZACIÓN EN TIEMPO REAL — Helper centralizado (OWASP + H1 + H9)
    // ═══════════════════════════════════════════════════════════════════════
    //
    // Problema que resuelve: asignar e.target.value directamente resetea el
    // cursor al final del input cuando el usuario edita en medio del texto.
    // Solución: preservar selectionStart/selectionEnd y restaurarlos tras
    // el reemplazo, usando setSelectionRange().
    //
    // Parámetros:
    //   input   — el elemento HTMLInputElement
    //   regex   — regex de caracteres PERMITIDOS (whitelist), ej. /[^a-zA-Z]/g
    //   extra   — (opcional) función adicional de transformación, ej. valor =>
    //             valor.replace(/\s{2,}/g, ' ').replace(/^\s/, '')
    //
    // Retorna true si hubo caracteres rechazados (para uso en blur/submit).
    // ───────────────────────────────────────────────────────────────────────
    _sanitizarInput(input, regex, extra) {
        const valorOriginal = input.value;

        // 1. Aplicar whitelist regex
        let valorLimpio = valorOriginal.replace(regex, '');

        // 2. Aplicar transformación adicional (doble-espacio, espacio inicial, etc.)
        if (typeof extra === 'function') {
            valorLimpio = extra(valorLimpio);
        }

        // 3. Si no hubo cambio, no hacer nada (evita ciclos innecesarios)
        if (valorOriginal === valorLimpio) return false;

        // 4. Preservar posición del cursor ANTES de modificar el valor
        //    (setSelectionRange solo funciona en inputs de tipo text)
        const pos = input.selectionStart;
        const deletedBefore = valorOriginal.substring(0, pos)
            .replace(regex, '')
            .replace(/\s{2,}/g, ' ')
            .replace(/^\s/, '').length;

        // 5. Asignar el valor sanitizado (el único punto donde se escribe el DOM)
        input.value = valorLimpio;

        // 6. Restaurar cursor a la posición equivalente en el texto sanitizado
        const nuevaPos = Math.min(deletedBefore, valorLimpio.length);
        try {
            input.setSelectionRange(nuevaPos, nuevaPos);
        } catch (_) { /* ignorar en inputs de tipo date/number */ }

        // 7. Feedback visual: añadir clase de rechazo y retirarla tras 300ms
        if (input._rechazadoTimer) clearTimeout(input._rechazadoTimer);
        input.classList.add('input-rechazado');
        input._rechazadoTimer = setTimeout(() => {
            input.classList.remove('input-rechazado');
        }, 300);

        return true; // hubo caracteres rechazados
    },

    // ── Bloque C: Limpieza de privacidad del widget de invitados ──
    _limpiarWidgetInvitado() {
        const inputCedula = document.getElementById('widget-cedula');
        const inputFecha = document.getElementById('widget-fecha-cita');
        const errorCedula = document.getElementById('widget-cedula-error');
        const errorFecha = document.getElementById('widget-fecha-error');

        // Limpiar valores
        if (inputCedula) { inputCedula.value = ''; inputCedula.classList.remove('input-error', 'input-success'); }
        if (inputFecha) { inputFecha.value = ''; inputFecha.classList.remove('input-error', 'input-success'); }

        // Ocultar mensajes de error activos
        if (errorCedula) { errorCedula.textContent = ''; errorCedula.style.display = 'none'; }
        if (errorFecha) { errorFecha.textContent = ''; errorFecha.style.display = 'none'; }
    },


    // ── Utilidad: Sincronizar cancelación entre stores (sanitas_mis_citas ↔ sanitas_citas) ──
    async _sincronizarCancelacion(cita) {
        const id = cita.id_cita || cita.id;
        if (id) {
            try {
                await updateCitaSupabasePorIdCita(String(id), { estado: 'Cancelada' });
            } catch (e) {
                console.error('[Supabase] No se pudo cancelar la cita en la nube:', e);
            }
        }

        const citasPublicas = JSON.parse(localStorage.getItem('sanitas_citas') || '[]');
        const matchPublico = citasPublicas.find(cp => {
            if (cita.id_cita && cp.id_cita === cita.id_cita) return true;
            return cp.cedula === cita.cedula && cp.medico === cita.medico &&
                cp.hora === cita.hora && (cp.fecha === cita.fecha || cp.codigo === cita.codigo);
        });
        if (matchPublico) {
            matchPublico.estado = 'Cancelada';
            localStorage.setItem('sanitas_citas', JSON.stringify(citasPublicas));
        }

        // Sincronizar hacia sanitas_mis_citas (store del dashboard)
        const misCitas = JSON.parse(localStorage.getItem('sanitas_mis_citas') || '[]');
        const matchPrivado = misCitas.find(mc => {
            if (cita.id_cita && (mc.id_cita === cita.id_cita || mc.id === cita.id_cita || mc._id === cita.id_cita)) return true;
            return mc.cedula === cita.cedula && mc.medico === cita.medico &&
                mc.hora === cita.hora && (mc.fecha === cita.fecha || mc.codigo === cita.codigo);
        });
        if (matchPrivado) {
            matchPrivado.estado = 'Cancelada';
            localStorage.setItem('sanitas_mis_citas', JSON.stringify(misCitas));
        }

        // Refrescar citas en memoria (Mi Salud)
        if (estado.citas && estado.citas.length) {
            const saludMatch = estado.citas.find(sc => {
                if (cita.id_cita && (sc.id_cita === cita.id_cita || sc.id === cita.id_cita || sc._id === cita.id_cita)) return true;
                return sc.cedula === cita.cedula && sc.medico === cita.medico &&
                    sc.hora === cita.hora;
            });
            if (saludMatch) {
                saludMatch.estado = 'Cancelada';
            }
        }

        // Fix SSOT: Reconstruir sanitas_citas_ocupadas basado estrictamente en sanitas_citas
        const diasNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        let nuevasOcupadas = [];
        citasPublicas.forEach(c => {
            if (c.estado !== 'Cancelada') {
                let d = new Date(); // fallback
                if (c.fecha && c.fecha.includes('-')) {
                    const [year, month, day] = c.fecha.split('-');
                    d = new Date(year, month - 1, day);
                }
                const diaNombre = diasNombres[d.getDay()];
                const mesNombre = meses[d.getMonth()];
                const fechaHoraFormato = `${diaNombre} ${d.getDate()} de ${mesNombre}, ${c.hora}`;

                nuevasOcupadas.push({
                    medico: c.medico,
                    especialidad: c.especialidad,
                    fecha: c.fecha,
                    hora: c.hora,
                    fechaHora: fechaHoraFormato
                });
            }
        });
        localStorage.setItem('sanitas_citas_ocupadas', JSON.stringify(nuevasOcupadas));
    },


    // ======================================================================
    // 1. NAVEGACIÓN Y MENÚS (Mobile y Escritorio)
    // ======================================================================
    iniciarSesionUsuario: function () {
        const usuarioLogueado = localStorage.getItem('usuarioLogueado');
        const btnAuth = document.getElementById('btn-auth');
        const navMiSalud = document.getElementById('nav-mi-salud');
        const bottomAuthItem = document.getElementById('bottom-auth-item'); // NUEVO

        // Actualizar botón del header (escritorio)
        if (btnAuth) {
            const nuevoBtnAuth = btnAuth.cloneNode(true);
            btnAuth.parentNode.replaceChild(nuevoBtnAuth, btnAuth);

            if (usuarioLogueado === 'true') {
                let nombreMostrar = 'Mi Perfil';
                let inicial = 'U';
                try {
                    const userActivo = JSON.parse(localStorage.getItem('usuarioActivo'));
                    if (userActivo) {
                        const nom1 = (userActivo.nombre1 || userActivo.nombre_1 || (userActivo.nombres || '').split(/\s+/)[0] || '').trim();
                        const ape1 = (userActivo.apellido1 || userActivo.apellido_1 || (userActivo.apellidos || '').split(/\s+/)[0] || '').trim();
                        if (nom1) {
                            nombreMostrar = ape1 ? `${nom1} ${ape1}` : nom1;
                            if (nombreMostrar.length > 22) nombreMostrar = nombreMostrar.substring(0, 20) + '…';
                            inicial = nom1.charAt(0).toUpperCase();
                        }
                    }
                } catch (e) { }

                nuevoBtnAuth.innerHTML = `<i class="fa-regular fa-user" aria-hidden="true"></i> ${nombreMostrar}`;
                nuevoBtnAuth.setAttribute('aria-label', `Ver perfil de ${nombreMostrar}`);
                if (navMiSalud) navMiSalud.style.display = 'list-item';
            } else {
                nuevoBtnAuth.innerHTML = '<i class="fa-regular fa-user" aria-hidden="true"></i> Iniciar Sesión';
                nuevoBtnAuth.setAttribute('aria-label', 'Iniciar Sesión');
                if (navMiSalud) navMiSalud.style.display = 'none';
            }

            const authClickHandler = (e) => {
                e.preventDefault();
                const yaLogueado = localStorage.getItem('usuarioLogueado') === 'true';
                if (yaLogueado) {
                    // Si hay modal de perfil en el DOM, abrirlo; si no, redirigir
                    if (typeof app.perfil?.abrirModal === 'function' &&
                        document.getElementById('modal-perfil')) {
                        app.perfil.abrirModal();
                    } else {
                        window.location.href = 'login.html';
                    }
                } else {
                    // TR-43: enrutamiento absoluto — funciona en cualquier página del MPA
                    if (typeof app.navegar === 'function' &&
                        document.getElementById('login-form')) {
                        // Estamos en login.html: solo actualizar estado
                        app.navegar('login');
                    } else {
                        // Preservar contexto de citas (igual que app.navegar('login')) antes de salir.
                        const vistaActual = app._mpaVistaDesdePathname?.() || '';
                        if (vistaActual === 'citas' && app.citas) {
                            sessionStorage.setItem('vista_origen', 'citas');
                            app.citas._guardarEstadoParaLogin();
                        }
                        window.location.href = 'login.html';
                    }
                }
            };

            nuevoBtnAuth.addEventListener('click', authClickHandler);

            const btnMovil = document.getElementById('btn-auth-mobile');
            if (btnMovil) {
                const nuevoBtnMovil = btnMovil.cloneNode(true);
                btnMovil.parentNode.replaceChild(nuevoBtnMovil, btnMovil);

                if (usuarioLogueado === 'true') {
                    let inicialReal = 'U';
                    try {
                        const userActivo = JSON.parse(localStorage.getItem('usuarioActivo'));
                        inicialReal = userActivo && userActivo.nombre_1 ? userActivo.nombre_1.charAt(0).toUpperCase() : 'U';
                    } catch (e) { }
                    nuevoBtnMovil.textContent = inicialReal;
                } else {
                    nuevoBtnMovil.innerHTML = '<i class="fa-solid fa-user"></i>';
                }
                nuevoBtnMovil.addEventListener('click', authClickHandler);
            }
        }

        // NUEVO: Actualizar botón en barra inferior
        if (bottomAuthItem) {
            if (usuarioLogueado === 'true') {
                let nombreCorto = 'Perfil';
                try {
                    const userActivo = JSON.parse(localStorage.getItem('usuarioActivo'));
                    if (userActivo) {
                        const nom1 = (userActivo.nombre1 || userActivo.nombre_1 || (userActivo.nombres || '').split(/\s+/)[0] || '').trim();
                        const ape1 = (userActivo.apellido1 || userActivo.apellido_1 || (userActivo.apellidos || '').split(/\s+/)[0] || '').trim();
                        if (nom1) {
                            nombreCorto = ape1 ? `${nom1} ${ape1}` : nom1;
                            if (nombreCorto.length > 18) nombreCorto = nombreCorto.substring(0, 16) + '…';
                        }
                    }
                } catch (e) { }

                bottomAuthItem.innerHTML = `<i class="fa-regular fa-user" aria-hidden="true"></i><span>${nombreCorto}</span>`;
                bottomAuthItem.setAttribute('aria-label', `Ver perfil de ${nombreCorto}`);
                bottomAuthItem.onclick = () => app.perfil.abrirModal();
            } else {
                bottomAuthItem.innerHTML = '<i class="fa-regular fa-user" aria-hidden="true"></i><span>Entrar</span>';
                bottomAuthItem.setAttribute('aria-label', 'Iniciar Sesión');
                bottomAuthItem.onclick = () => app.navegar('login');
            }
        }


        // TR-93 / TR-87 / TR-124: Botón "Consultar Cita" en el header — sincronización global MPA.
        // El botón #btn-consultar-cita-header nace visible en el HTML (display:inline-block).
        // TR-124: JavaScript solo lo oculta si hay sesión activa; jamás lo muestra con retraso.
        // Regla de ocultamiento condicional (lectura de localStorage, sin esperar Supabase):
        //   · usuarioLogueado === 'true'  → display: none   (el usuario accede desde Mi Salud)
        //   · cualquier otro valor        → preservar display:inline-block del HTML estático
        const btnConsultarHeader = document.getElementById('btn-consultar-cita-header');
        if (btnConsultarHeader) {
            if (usuarioLogueado === 'true') {
                btnConsultarHeader.style.display = 'none';
            }
            // Si NO está logueado: no tocar el display — el HTML ya lo tiene en inline-block.
            // Esto elimina el lag visual (FOUC) causado por asignar 'inline-block' desde JS.
        }
    },

    /**
     * TR-93: Al salir del flujo de citas vía navbar, purga hora/slot no confirmados
     * (reserva_temporal, cita_hora_*, etc.) antes de la navegación MPA.
     */
    iniciarPurgaDesercionRutaTR93() {
        if (this._tr93NavPurgeBound) return;
        this._tr93NavPurgeBound = true;
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.header__nav-link');
            if (!link) return;
            if (e.defaultPrevented) return;
            const onclick = link.getAttribute('onclick') || '';
            if (/preventDefault/i.test(onclick)) return;
            if (app._mpaVistaDesdePathname() === 'citas' && app.citas) {
                if (typeof app.citas.purgaHorarioPorDesercionRuta === 'function') {
                    app.citas.purgaHorarioPorDesercionRuta();
                } else if (typeof app.citas.hardResetCitas === 'function') {
                    app.citas.hardResetCitas();
                }
            }
        }, true);
    },

    _initOfflineDetection: function () {
        // Crear banner una sola vez e insertarlo al inicio del body
        const BANNER_ID = 'sanitas-offline-banner';
        if (document.getElementById(BANNER_ID)) return;

        const banner = document.createElement('div');
        banner.id = BANNER_ID;
        banner.setAttribute('role', 'alert');
        banner.setAttribute('aria-live', 'assertive');
        banner.innerHTML =
            '<i class="fa-solid fa-wifi offline-icon" aria-hidden="true"></i>' +
            '<span>Sin conexión a internet. Algunas funciones no estarán disponibles hasta que te reconectes.</span>';
        document.body.insertAdjacentElement('afterbegin', banner);

        // Toast "Conexión restaurada"
        const TOAST_ID = 'sanitas-online-toast';
        const toast = document.createElement('div');
        toast.id = TOAST_ID;
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i><span>Conexión restaurada</span>';
        document.body.insertAdjacentElement('beforeend', toast);

        let _toastTimer = null;
        const mostrarToast = () => {
            clearTimeout(_toastTimer);
            toast.classList.add('visible');
            _toastTimer = setTimeout(() => toast.classList.remove('visible'), 3000);
        };

        const mostrar = () => banner.classList.add('visible');
        const ocultar = () => {
            banner.classList.remove('visible');
            mostrarToast();
        };

        // Estado inicial — si arranca sin internet mostrar banner; el toast solo aparece
        // cuando se RECUPERA la conexión, no al cargar la página con internet.
        if (!navigator.onLine) mostrar();

        window.addEventListener('offline', mostrar);
        window.addEventListener('online', ocultar);
    },

    iniciarMenuMovil: function () {
        const menuToggle = document.querySelector('.header__menu-toggle');
        const mainMenu = document.getElementById('main-menu');

        if (menuToggle && mainMenu) {
            // TR-65: asegurar que el header tenga position:relative para el off-canvas
            const headerEl = menuToggle.closest('header');
            if (headerEl) headerEl.style.position = 'relative';

            const cerrarMenu = () => {
                menuToggle.setAttribute('aria-expanded', 'false');
                mainMenu.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                if (icon) icon.classList.replace('fa-xmark', 'fa-bars');
            };

            menuToggle.addEventListener('click', () => {
                const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';

                // Toggle de estado (Accesibilidad ARIA)
                menuToggle.setAttribute('aria-expanded', !isExpanded);
                mainMenu.classList.toggle('active');

                // Cambiar icono visual
                const icon = menuToggle.querySelector('i');
                if (!isExpanded) {
                    icon.classList.replace('fa-bars', 'fa-xmark');
                } else {
                    icon.classList.replace('fa-xmark', 'fa-bars');
                }
            });

            // TR-65 UX: Cerrar menú al hacer clic en un enlace
            mainMenu.querySelectorAll('.header__nav-link').forEach(link => {
                link.addEventListener('click', () => cerrarMenu());
            });

            // TR-65 Accesibilidad: Cerrar con Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && mainMenu.classList.contains('active')) {
                    cerrarMenu();
                    menuToggle.focus();
                }
            });

            // TR-65 UX: Cerrar al hacer clic fuera del header
            document.addEventListener('click', (e) => {
                if (mainMenu.classList.contains('active') &&
                    !mainMenu.contains(e.target) &&
                    !menuToggle.contains(e.target)) {
                    cerrarMenu();
                }
            });
        }

        // Accesibilidad: Navegación por teclado para submenús
        const navLinks = document.querySelectorAll('.header__nav-link[aria-haspopup="true"]');
        navLinks.forEach(link => {
            link.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const isExpanded = link.getAttribute('aria-expanded') === 'true';
                    link.setAttribute('aria-expanded', !isExpanded);
                }
            });
        });
    },

    /** Vista lógica aproximada según el archivo HTML actual (para vista_origen en login). */
    _mpaVistaDesdePathname() {
        const file = (window.location.pathname.split('/').pop() || 'index.html').split('?')[0].toLowerCase();
        const map = {
            'index.html': 'home',
            'login.html': 'login',
            'registro.html': 'registro',
            'especialistas.html': 'especialistas',
            'citas.html': 'citas',
            'mi-salud.html': 'mi-salud',
            'farmacia.html': 'farmacia',
            'perfil.html': 'editar-perfil',
            'contacto.html': 'contacto',
        };
        return map[file] || 'home';
    },

    navegar: function (vistaId, pushState = true, force = false) {
        console.log(`Navegando a la vista: ${vistaId}`);

        if (vistaId === 'login') {
            const vistaActual = this.currentView || this._mpaVistaDesdePathname() || 'home';
            sessionStorage.setItem('vista_origen', vistaActual);
            if (vistaActual === 'citas' && app.citas) {
                app.citas._guardarEstadoParaLogin();
            }
        }

        // No limpiar snapshot de cita confirmada al ir a login: el usuario debe recuperar el paso 5 al volver (TR ticket inmunidad).
        if (vistaId !== 'citas' && vistaId !== 'login') {
            sessionStorage.removeItem('temp_datos_recuperacion');
            if (app.citas) {
                app.citas.modoProxy = false;
                const saliendoDeCitas = this._mpaVistaDesdePathname() === 'citas';
                if (saliendoDeCitas && typeof app.citas.hardResetCitas === 'function') {
                    app.citas.hardResetCitas();
                } else if (typeof app.citas.limpiarSessionFlujoCitas === 'function') {
                    app.citas.limpiarSessionFlujoCitas(true);
                }
            }
        }

        const targetRel = MPA_VISTA_URL[vistaId];
        if (!targetRel) {
            console.warn('[navegar] Vista no mapeada:', vistaId);
            return;
        }

        const destUrl = new URL(targetRel, window.location.href);
        const curUrl = new URL(window.location.href);
        if (!force && curUrl.pathname === destUrl.pathname && (destUrl.hash === '' || curUrl.hash === destUrl.hash)) {
            return;
        }

        window.location.assign(destUrl.href);
    },

    _enfocarEncabezadoVista(vistaId) {
        // Mapa de vistas a sus selectores de encabezado principal
        const selectores = {
            home: '.hero__title',
            citas: '#view-citas h2, #view-citas h3',
            especialistas: '#view-especialistas h2',
            farmacia: '#farmacia-heading',
            contacto: '#contacto-heading',
            login: '#login-heading',
            registro: '#registro-heading',
            'mi-salud': '#mi-salud-heading',
            'editar-perfil': '#editar-perfil-heading',
        };
        const selector = selectores[vistaId];
        if (!selector) return;
        const el = document.querySelector(selector);
        if (!el) return;
        if (!el.getAttribute('tabindex')) {
            el.setAttribute('tabindex', '-1');
        }
        // Diferir para que el DOM sea visible antes de enfocar
        requestAnimationFrame(() => { el.focus({ preventScroll: true }); });
    },

    // ======================================================================
    // WCAG 2.2 — Accesibilidad Global de Modales
    // Escape + clic en overlay cierran cualquier modal abierto,
    // excepto si tiene role="alertdialog".
    // Focus Trap: Tab/Shift+Tab no escapa del modal activo.
    // ======================================================================
    _initModalAccessibility() {
        // ── Selectores focusables válidos dentro de un modal ──
        const FOCUSABLES = [
            'a[href]', 'button:not([disabled])', 'input:not([disabled])',
            'select:not([disabled])', 'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(', ');

        // ── Función: obtener el modal visible más reciente ──
        const _modalActivo = () => {
            const overlays = [
                ...document.querySelectorAll(
                    '.modal-overlay, .perfil-overlay, .reg-modal-overlay'
                )
            ];
            // Devolver el último overlay visible (z-index más alto en el DOM)
            return overlays.reverse().find(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden';
            }) || null;
        };

        // ── Función: cerrar el modal activo (respeta alertdialog) ──
        const _cerrarModal = (modal) => {
            if (!modal) return;
            if (modal.getAttribute('role') === 'alertdialog') return;

            // Estrategia: buscar el botón de cierre explícito del modal
            const closeBtn = modal.querySelector(
                '.modal-close, .perfil-modal__close, .reg-modal__close'
            );
            if (closeBtn) {
                closeBtn.click();
                return;
            }
            // Fallback: si es el modal de consulta, usar su limpieza específica.
            if (modal.id === 'modal-consulta-invitado' && app.widgetInvitado?.cerrarModalConsulta) {
                app.widgetInvitado.cerrarModalConsulta();
                return;
            }
            modal.style.display = 'none';
        };

        // ── 1. Escape cierra el modal activo ──
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const modal = _modalActivo();
            if (modal) {
                e.preventDefault();
                e.stopPropagation();
                _cerrarModal(modal);
            }
        }, true);

        // ── 2. Clic en el fondo/overlay cierra el modal ──
        document.addEventListener('click', (e) => {
            const overlays = document.querySelectorAll(
                '.modal-overlay, .perfil-overlay, .reg-modal-overlay'
            );
            overlays.forEach(overlay => {
                if (e.target === overlay) {
                    _cerrarModal(overlay);
                }
            });
        });

        // ── 3. Focus Trap: Tab/Shift+Tab queda dentro del modal activo ──
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            const modal = _modalActivo();
            if (!modal) return;

            const focusables = Array.from(modal.querySelectorAll(FOCUSABLES))
                .filter(el => {
                    const s = window.getComputedStyle(el);
                    return s.display !== 'none' && s.visibility !== 'hidden' && !el.disabled;
                });
            if (focusables.length === 0) { e.preventDefault(); return; }

            const first = focusables[0];
            const last = focusables[focusables.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first || !modal.contains(document.activeElement)) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last || !modal.contains(document.activeElement)) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });

        // ── 4. Focus Guard (captura): redirige el foco si escapa del modal ──
        // Necesario porque los radio buttons agrupados (mismo `name`) funcionan como
        // un solo Tab stop: el navegador mueve el foco fuera del modal antes de que
        // el listener keydown pueda interceptarlo. focusin en fase capture actúa
        // sobre el nuevo destino inmediatamente después de que el navegador lo fijó.
        document.addEventListener('focusin', (e) => {
            const modal = _modalActivo();
            if (!modal) return;                         // ningún modal activo
            if (modal.contains(e.target)) return;      // foco dentro del modal — OK
            // El foco escapó al exterior: redirigir al primer elemento del modal
            const focusables = Array.from(modal.querySelectorAll(FOCUSABLES))
                .filter(el => {
                    const s = window.getComputedStyle(el);
                    return s.display !== 'none' && s.visibility !== 'hidden' && !el.disabled;
                });
            if (focusables.length) focusables[0].focus();
        }, true); // true = fase capture, intercepta antes que otros focusin handlers
    },

    scrollAlFooter: function () {
        const footer = document.getElementById('site-footer');
        if (footer) {
            footer.scrollIntoView({ behavior: 'smooth' });
        }
    },

    marcarContactoActivo: function (enlace) {
        // Remover clase activa de todos
        const navLinks = document.querySelectorAll('.header__nav-link');
        navLinks.forEach(link => {
            link.classList.remove('header__nav-link--active');
            link.removeAttribute('aria-current');
        });
        const bottomNavItems = document.querySelectorAll('.bottom-nav__item');
        bottomNavItems.forEach(item => {
            item.classList.remove('bottom-nav__item--active');
            item.removeAttribute('aria-current');
        });

        // Agregar clase activa al enlace de contacto
        if (enlace) {
            enlace.classList.add('header__nav-link--active');
            enlace.setAttribute('aria-current', 'page');
        }
    },

    // ======================================================================
    // 2. LÓGICA DEL CARRUSEL (Heurística de Percepción y Atención)
    // ======================================================================
    iniciarCarrusel: function () {
        const slides = document.querySelectorAll('.hero__slide');
        const dots = document.querySelectorAll('.hero__carousel-dot');
        const prevBtn = document.querySelector('.hero__carousel-btn--prev');
        const nextBtn = document.querySelector('.hero__carousel-btn--next');

        if (slides.length === 0) return; // Salida de seguridad si no hay carrusel

        let currentSlide = 0;

        // Función interna para cambiar visualmente el slide
        const goToSlide = (index) => {
            // Manejo de límites (Loop)
            if (index < 0) currentSlide = slides.length - 1;
            else if (index >= slides.length) currentSlide = 0;
            else currentSlide = index;

            // Actualizar clases CSS
            slides.forEach(slide => slide.classList.remove('hero__slide--active'));
            dots.forEach(dot => dot.classList.remove('hero__carousel-dot--active'));

            slides[currentSlide].classList.add('hero__slide--active');
            if (dots.length > 0) dots[currentSlide].classList.add('hero__carousel-dot--active');
        };

        // Función para avanzar (usada por botones y por el temporizador)
        const nextSlide = () => goToSlide(currentSlide + 1);
        const prevSlide = () => goToSlide(currentSlide - 1);

        // Control de botones manuales
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                nextSlide();
                this.reiniciarTemporizadorCarrusel(nextSlide); // Reiniciar conteo al interactuar
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                prevSlide();
                this.reiniciarTemporizadorCarrusel(nextSlide); // Reiniciar conteo al interactuar
            });
        }

        // Control por indicadores (dots)
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                goToSlide(index);
                this.reiniciarTemporizadorCarrusel(nextSlide);
            });
        });

        // Iniciar el temporizador automático (7 segundos)
        this.intervaloCarrusel = setInterval(nextSlide, this.tiempoCarrusel);
    },

    reiniciarTemporizadorCarrusel: function (callbackSiguiente) {
        // Prevenir errores (H5) si el usuario hace muchos clics seguidos
        clearInterval(this.intervaloCarrusel);
        this.intervaloCarrusel = setInterval(callbackSiguiente, this.tiempoCarrusel);
    },

    // ======================================================================
    // 4. CARRUSEL DE ESPECIALISTAS (Control manual)
    // ======================================================================
    iniciarCarruselEspecialistas: function () {
        const grid = document.getElementById('doctors-carousel');
        const prevBtn = document.querySelector('.doctors__nav-btn--prev');
        const nextBtn = document.querySelector('.doctors__nav-btn--next');

        if (!grid || !prevBtn || !nextBtn) return;

        const getScrollAmount = () => {
            const card = grid.querySelector('.doctor-card');
            return card ? card.offsetWidth + 25 : 350;
        };

        // Actualizar visibilidad de flechas según posición del scroll


        // Asegurar que las dimensiones estén listas antes de la primera verificación
        const initUpdate = () => {
            this._actualizarVisibilidadCarruselEspecialistas();

            // Escuchar la carga de imágenes para recalcular si es necesario
            const images = grid.querySelectorAll('img');
            if (images.length > 0) {
                let loadedCount = 0;
                images.forEach(img => {
                    if (img.complete) loadedCount++;
                    else {
                        img.addEventListener('load', () => {
                            loadedCount++;
                            if (loadedCount === images.length) this._actualizarVisibilidadCarruselEspecialistas();
                        }, { once: true });
                    }
                });
            }
        };

        nextBtn.addEventListener('click', () => {
            grid.scrollBy({ left: getScrollAmount(), behavior: 'smooth' });
        });

        prevBtn.addEventListener('click', () => {
            grid.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' });
        });

        grid.addEventListener('scroll', () => this._actualizarVisibilidadCarruselEspecialistas());
        window.addEventListener('resize', () => this._actualizarVisibilidadCarruselEspecialistas());

        // Llamada inicial con un pequeño retraso para que el DOM se haya renderizado
        setTimeout(initUpdate, 100);
    },

    // Nueva función auxiliar para actualizar visibilidad de flechas del carrusel de especialidades
    _actualizarVisibilidadCarruselEspecialistas: function () {
        const grid = document.getElementById('doctors-carousel');
        const prevBtn = document.querySelector('.doctors__nav-btn--prev');
        const nextBtn = document.querySelector('.doctors__nav-btn--next');
        if (!grid) return;

        // Accesibilidad (WCAG 2.4.3 Focus Order): Remover tabindex de tarjetas ocultas
        const cards = grid.querySelectorAll('.doctor-card');
        if (cards.length > 0) {
            const gridRect = grid.getBoundingClientRect();
            cards.forEach(card => {
                const cardRect = card.getBoundingClientRect();
                // Una tarjeta es visible si entra dentro del área horizontal del grid (con un margen de tolerancia de 10px)
                const isVisible = (cardRect.right > gridRect.left + 10) && (cardRect.left < gridRect.right - 10);

                if (isVisible) {
                    card.removeAttribute('tabindex'); // Habilitar foco (vuelve al valor por defecto)
                } else {
                    card.setAttribute('tabindex', '-1'); // Quitar del orden de foco del tabulador
                }
            });
        }

        if (!prevBtn || !nextBtn) return;

        const maxScroll = grid.scrollWidth - grid.clientWidth;
        const tolerance = 2;

        if (maxScroll <= 0) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            return;
        }

        prevBtn.style.display = grid.scrollLeft > tolerance ? 'flex' : 'none';
        nextBtn.style.display = grid.scrollLeft < maxScroll - tolerance ? 'flex' : 'none';
    },

    // ======================================================================
    // 5. RENDERIZADO DINÁMICO DE ESPECIALIDADES (Home)
    // ======================================================================
    renderizarEspecialidadesHome: function () {
        const contenedor = document.getElementById('doctors-carousel');
        if (!contenedor) return;

        // 1. Obtener base de datos
        const dbString = localStorage.getItem('sanitasFam_db');
        if (!dbString) return;
        const db = JSON.parse(dbString);

        const especialistas = db.cartera_especialistas || [];

        // 2. Extraer Especialidades Únicas (Filtrando FARMACIA)
        const especialidadesUnicas = [];
        especialistas.forEach(medico => {
            if (medico.especialidad !== 'FARMACIA' && !especialidadesUnicas.includes(medico.especialidad)) {
                especialidadesUnicas.push(medico.especialidad);
            }
        });

        // TR-123: Mapa de imágenes WebP locales — erradicación de peticiones externas (Pexels/Unsplash).
        // Las imágenes residen en assets/img/carrusel/webp/ y fueron convertidas al 80% de calidad.
        const imagenesEspecialidad = {
            "MEDICINA FAMILIAR":  "assets/img/carrusel/webp/medicina-familiar.webp",
            "MEDICINA GENERAL":   "assets/img/carrusel/webp/medicina-general.webp",
            "RADIODIÁGNOSTICO":   "assets/img/carrusel/webp/radiodiagnostico.webp",
            "DERMATOLOGÍA":       "assets/img/carrusel/webp/dermatologia.webp",
            "OFTALMOLOGÍA":       "assets/img/carrusel/webp/oftalmologia.webp",
            "ENDOCRINOLOGÍA":     "assets/img/carrusel/webp/endocrinologia.webp",
            "TRAUMATOLOGÍA":      "assets/img/carrusel/webp/traumatologia.webp",
            "PSICOLOGÍA":         "assets/img/carrusel/webp/psicologia.webp",
            "ODONTOLOGÍA":        "assets/img/carrusel/webp/odontologia.webp",
            "ENFERMERÍA":         "assets/img/carrusel/webp/enfermeria.webp",
            "LABORATORIO":        "assets/img/carrusel/webp/laboratorio.webp",
            "GINECOLOGÍA":        "assets/img/carrusel/webp/ginecologia.webp"
        };
        const imagenDefault = "assets/img/carrusel/webp/medicina-general.webp";

        // 3. Generar HTML Dinámicamente
        // TR-123: Primera tarjeta → fetchpriority="high" (LCP); siguientes → loading="lazy".
        let html = '';
        especialidadesUnicas.forEach((esp, idx) => {
            const imagen = imagenesEspecialidad[esp] || imagenDefault;
            // Primer elemento visible: carga inmediata con alta prioridad de red (FCP/LCP)
            const prioridad = idx === 0
                ? 'fetchpriority="high"'
                : 'loading="lazy"';

            html += `
                <article class="doctor-card" onclick="app.seleccionarEspecialidad('${esp}')" style="cursor: pointer;" title="Ver especialistas en ${esp}">
                    <div class="doctor-card__img-container" style="position: relative; height: 200px;">
                        <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(59, 73, 163, 0.9), rgba(59, 73, 163, 0.3)); z-index: 1;"></div>
                        <img src="${imagen}" alt="${esp}" ${prioridad} style="width: 100%; height: 100%; object-fit: cover;">
                        <h3 style="position: absolute; bottom: 20px; left: 20px; color: #ffffff; z-index: 2; margin: 0; font-size: 1.2rem; font-weight: 700;">${esp}</h3>
                    </div>
                    <div class="doctor-card__content">
                        <div class="doctor-card__actions" style="margin-top: 15px;">
                            <button type="button" class="btn btn--secundario" aria-label="Ver especialistas en ${esp}">
                                <i class="fa-solid fa-calendar-check" aria-hidden="true"></i> Agendar Cita
                            </button>
                        </div>
                    </div>
                </article>
            `;
        });

        // 4. Inyectar HTML
        contenedor.innerHTML = html;
    },

    // NUEVA FUNCIÓN: Para cuando hacen clic en botones generales del Home
    agendarCitaGeneral: function () {
        if (app.citas && typeof app.citas.hardResetCitas === 'function') {
            app.citas.hardResetCitas();
        }
        // Si ya estamos en citas.html, navegar() es bloqueado por el guard de misma ruta.
        // Llamar iniciarFlujo() directamente para reiniciar al paso 1.
        if (document.getElementById('view-citas')) {
            if (app.citas && typeof app.citas.iniciarFlujo === 'function') {
                app.citas.iniciarFlujo();
            }
        } else {
            this.navegar('citas');
        }
    },

    preseleccionarDoctor: function (id_especialista, especialidad, medico, imagen_url) {
        if (app.citas && typeof app.citas.hardResetCitas === 'function') {
            app.citas.hardResetCitas();
        }
        sessionStorage.setItem('reservaCita_preseleccion', JSON.stringify({
            id_especialista: id_especialista,
            especialidad: especialidad,
            medico: medico,
            imagen_url: imagen_url
        }));
        sessionStorage.setItem('especialidad_seleccionada', especialidad);
        sessionStorage.removeItem(STORAGE_CITA_POST_LOGIN);
        this.navegar('citas');
    },

    // CORRECCIÓN: Para cuando hacen clic en el carrusel de especialidades
    seleccionarEspecialidad: function (especialidad) {
        if (app.citas && typeof app.citas.hardResetCitas === 'function') {
            app.citas.hardResetCitas();
        }
        sessionStorage.removeItem('reservaCita_preseleccion');
        sessionStorage.setItem('especialidad_seleccionada', especialidad);
        this.navegar('citas');
    },

    // ======================================================================
    // 6. LÓGICA DE CITAS (3 Pasos, Validaciones, Módulo 10)
    // ======================================================================,

    directorio: {
        medicosCache: [],

        inicializar() {
            // TR-93: Al cargar el directorio de especialistas, liberar slots preseleccionados no confirmados.
            if (app.citas && typeof app.citas.purgaHorarioPorDesercionRuta === 'function') {
                app.citas.purgaHorarioPorDesercionRuta();
            }

            try {
                const db = JSON.parse(localStorage.getItem('sanitasFam_db'));
                if (db && db.cartera_especialistas) {
                    // Filtrar farmacia
                    this.medicosCache = db.cartera_especialistas.filter(e => e.especialidad.toLowerCase() !== 'farmacia' && e.doctor);
                }
            } catch (e) { }

            const buscador = document.getElementById('buscador-especialistas');
            if (buscador) {
                // Prevenir múltiples listeners si se llama varias veces
                buscador.removeEventListener('input', this.manejarFiltro);
                buscador.addEventListener('input', this.manejarFiltro.bind(this));

                // Bloque A – Sanitización en tiempo real (Regex Whitelist + dobles espacios)
                buscador.addEventListener('input', (e) => {
                    const input = e.target;
                    let val = input.value;
                    const original = val;
                    val = val.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g, '');
                    if (val.startsWith(' ')) val = val.trimStart();
                    val = val.replace(/  +/g, ' ');
                    if (val !== original) {
                        input.value = val;
                        input.classList.add('input-rechazado');
                        clearTimeout(input._flashTimeout);
                        input._flashTimeout = setTimeout(() => input.classList.remove('input-rechazado'), 300);
                    }
                });

                // TR-119: Enter en el buscador ejecuta el filtro explícitamente
                if (!buscador.dataset.tr119Enter) {
                    buscador.dataset.tr119Enter = '1';
                    buscador.addEventListener('keydown', (e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        this.manejarFiltro({ target: buscador });
                    });
                }
            }

            // Modal overlay click (Cerrar)
            if (!this._eventosModalAgregados) {
                const modalOverlay = document.getElementById('modal-especialista');
                if (modalOverlay) {
                    modalOverlay.addEventListener('click', (e) => {
                        if (e.target === modalOverlay) {
                            e.preventDefault();
                            e.stopPropagation();
                            this.cerrarModal();
                        }
                    });
                }

                // Botón X modal
                const closeBtn = document.getElementById('modal-close-btn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.cerrarModal();
                    });
                }

                this._eventosModalAgregados = true;
            }

            this.renderizarTarjetas(this.medicosCache);
        },

        manejarFiltro(e) {
            // Limpieza de entrada en tiempo real (Heurística #7)
            let rawValue = e.target.value;
            let cleanValue = rawValue.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '');
            if (rawValue !== cleanValue) {
                e.target.value = cleanValue;
            }

            const query = cleanValue.trim();
            if (!query) {
                this.renderizarTarjetas(this.medicosCache);
                return;
            }

            // Normalización para comparación (sin tildes, minúsculas)
            const normalizar = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const queryNorm = normalizar(query);

            const filtrados = this.medicosCache.filter(med => {
                const nombreNorm = normalizar(med.doctor?.nombre_completo || '');
                const especialidadNorm = normalizar(med.especialidad || '');
                return nombreNorm.includes(queryNorm) || especialidadNorm.includes(queryNorm);
            });

            this.renderizarTarjetas(filtrados);
        },

        /** TR-111: orden dual Especialidad A-Z → Nombre A-Z. */
        _ordenarMedicosDirectorioTR111(listaMedicos) {
            return [...listaMedicos].sort((a, b) => {
                const espA = (a.especialidad || '').trim();
                const espB = (b.especialidad || '').trim();
                const cmpEsp = espA.localeCompare(espB, 'es', { sensitivity: 'base' });
                if (cmpEsp !== 0) return cmpEsp;
                const nomA = (a.doctor?.nombre_completo || '').trim();
                const nomB = (b.doctor?.nombre_completo || '').trim();
                return nomA.localeCompare(nomB, 'es', { sensitivity: 'base' });
            });
        },

        /**
         * TR-121 — Mapeo dinámico WebP por slug de nombre.
         * Toma el campo nombre_completo que devuelve Supabase y genera
         * el nombre de archivo correspondiente en assets/img/especialistas/webp/.
         *
         * Pasos de transformación:
         *   1. Minúsculas
         *   2. Elimina prefijos médicos: 'dra.', 'dr.', 'psic.', 'lic.', 'odont.'
         *   3. Elimina acentos / diacríticos (NFD + strip combining chars)
         *   4. Reemplaza espacios por guiones medios
         *
         * @param {string} nombreCompleto — Ej: 'Dra. Verónica Del Pilar Barahona Charfuelan'
         * @returns {string}              — Ej: 'veronica-del-pilar-barahona-charfuelan'
         */
        _generarSlugImagen(nombreCompleto) {
            return String(nombreCompleto || '')
                .toLowerCase()
                .replace(/^(dra\.|dr\.|psic\.|lic\.|odont\.)\s+/, '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim()
                .replace(/\s+/g, '-');
        },

        _resolverImagenDirectorio(med, nombreMed) {
            const nombreLower = nombreMed.toLowerCase();
            if (nombreLower.includes('verónica') && nombreLower.includes('barahona')) {
                return 'assets/img/veronica-barahona.jpg';
            }
            const slug = this._generarSlugImagen(nombreMed);
            return 'assets/img/especialistas/webp/' + slug + '.webp';
        },

        /** TR-111: tarjeta con listeners intactos (.directory-card__btn / __link). */
        _crearTarjetaDirectorio(med) {
            const nombreMed = med.doctor?.nombre_completo || '';
            const imagenSrc = this._resolverImagenDirectorio(med, nombreMed);

            // TR-121: slug WebP dinámico desde nombre_completo de Supabase
            const slugImagen = this._generarSlugImagen(med.doctor?.nombre_completo || '');
            const webpSrc = `assets/img/especialistas/webp/${slugImagen}.webp`;

            const card = document.createElement('article');
            card.className = 'directory-card';
            card.innerHTML = `  
                    <img src="${webpSrc}"
                         alt="${nombreMed}"
                         class="directory-card__img"
                         tabindex="0"
                         loading="lazy"
                         onerror="this.onerror=null; this.src='assets/img/especialistas/placeholder-doctor.webp';">
                    <h3 class="directory-card__name">${nombreMed}</h3>
                    <p class="directory-card__specialty">${med.especialidad}</p>
                    <button class="btn btn--secundario directory-card__link" aria-label="Ver perfil de ${nombreMed}">Ver perfil y servicios</button>
                    <button class="btn btn--primario directory-card__btn" style=" color: #fff; font-weight: bold;">
                        <i class="fa-regular fa-calendar-check" style="margin-right: 8px;"></i> Agendar Cita
                    </button>
                `;

            const img = card.querySelector('.directory-card__img');
            const linkVerPerfil = card.querySelector('.directory-card__link');
            const btnAgendar = card.querySelector('.directory-card__btn');

            const abrirModalClick = () => this.abrirModal(med);
            img.addEventListener('click', abrirModalClick);
            img.addEventListener('keydown', (e) => { if (e.key === 'Enter') abrirModalClick(); });
            linkVerPerfil.addEventListener('click', abrirModalClick);

            btnAgendar.addEventListener('click', () => {
                const idEsp = med.id_especialista || med.id;
                app.preseleccionarDoctor(idEsp, med.especialidad, nombreMed, med.imagen_url || imagenSrc);
            });

            return card;
        },

        renderizarTarjetas(listaMedicos) {
            const grid = document.getElementById('specialists-directory-grid');
            if (!grid) return;

            grid.innerHTML = '';

            if (listaMedicos.length === 0) {
                grid.innerHTML = '<p class="directory-empty-msg">No se encontraron médicos con ese criterio.</p>';
                return;
            }

            const ordenados = this._ordenarMedicosDirectorioTR111(listaMedicos);
            const fragment = document.createDocumentFragment();
            let especialidadActual = null;
            let grupoActual = null;

            ordenados.forEach(med => {
                const esp = (med.especialidad || '').trim() || 'Sin especialidad';
                if (esp !== especialidadActual) {
                    especialidadActual = esp;
                    const titulo = document.createElement('h3');
                    titulo.className = 'directory-specialty-title';
                    titulo.textContent = esp;
                    fragment.appendChild(titulo);

                    grupoActual = document.createElement('div');
                    grupoActual.className = 'directory-specialty-group';
                    fragment.appendChild(grupoActual);
                }
                grupoActual.appendChild(this._crearTarjetaDirectorio(med));
            });

            grid.appendChild(fragment);
        },

        abrirModal(medico) {
            document.getElementById('modal-doc-name').textContent = medico.doctor.nombre_completo || 'Médico';
            document.getElementById('modal-doc-specialty').textContent = medico.especialidad || '';

            // Imagen del Modal — thumbnails 200×200 de alta calidad
            const nombreMed = medico.doctor.nombre_completo || '';
            const imgModal = document.getElementById('modal-doc-img');
            if (imgModal) {
                const slugModal = this._generarSlugImagen(nombreMed);
                imgModal.loading = 'lazy';
                imgModal.style.objectPosition = '50% 20%';
                imgModal.src = 'assets/img/especialistas/thumbs/' + slugModal + '.webp';
                imgModal.onerror = function () {
                    this.onerror = null;
                    this.style.objectPosition = '50% 50%';
                    this.src = 'assets/img/especialistas/thumbs/placeholder-doctor.webp';
                };
            }

            const list = document.getElementById('modal-doc-activities');
            list.innerHTML = '';

            const actividades = medico.actividades || [];
            if (actividades.length === 0) {
                list.innerHTML = '<li>No hay servicios detallados disponibles.</li>';
            } else {
                actividades.forEach(act => {
                    const li = document.createElement('li');
                    li.textContent = act;
                    list.appendChild(li);
                });
            }

            const modal = document.getElementById('modal-especialista');
            // TR-53: ancla en historial para que Atrás nativo cierre este modal
            history.pushState({ vista: 'modal', id: 'modal-especialista' }, '', '');
            modal.style.display = 'flex';

            // Trap focus simple
            setTimeout(() => document.getElementById('modal-close-btn').focus(), 100);
        },

        cerrarModal() {
            const modal = document.getElementById('modal-especialista');
            if (modal) {
                modal.style.display = 'none';
                // TR-53: limpiar ancla del historial al cerrar con botón visual
                if (history.state && history.state.id === 'modal-especialista') history.back();
            }
        }
    },

    farmacia,

    // ======================================================================
    // 9. MÓDULO LOGIN (Validación Inteligente e IHC)
    // ======================================================================
    login: {
        inicializar() {
            const inputCedula = document.getElementById('login-cedula');
            if (inputCedula) {
                // TR-128: solo dígitos — bloquea letras, espacios y cualquier carácter no numérico.
                inputCedula.addEventListener('input', (e) => {
                    const antes = e.target.value;
                    const despues = antes.replace(/[^0-9]/g, '');
                    if (antes !== despues) {
                        const pos = e.target.selectionStart;
                        e.target.value = despues;
                        try { e.target.setSelectionRange(pos - 1, pos - 1); } catch (_) { }
                    }
                });

                // TR-128: Validación Módulo 10 en blur (feedback inmediato al salir del campo)
                inputCedula.addEventListener('blur', () => {
                    const val = inputCedula.value.trim();
                    if (val.length === 0) return;
                    if (val.length !== 10 || !utilidades.validarCedulaEcuatoriana(val)) {
                        this._mostrarError('login-cedula', 'Por favor, ingrese una Cédula de Identidad válida.');
                    } else {
                        this._limpiarError('login-cedula');
                    }
                });
            }

            // TR-119: Enter en credenciales ejecuta inicio de sesión (sin recarga MPA).
            ['login-cedula', 'login-password'].forEach(id => {
                const el = document.getElementById(id);
                if (!el || el.dataset.tr119Enter === '1') return;
                el.dataset.tr119Enter = '1';
                el.addEventListener('keydown', (e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const submitBtn = document.getElementById('login-submit-btn');
                    if (submitBtn) { submitBtn.focus(); submitBtn.click(); }
                });
            });

            // ── NUEVO: Asociar botón de login ──
            const submitBtn = document.getElementById('login-submit-btn');
            if (submitBtn) {
                submitBtn.addEventListener('click', (e) => {
                    void this.enviar(e);
                });
            }

            // ── Prevenir recarga del formulario oculto ──
            const hiddenForm = document.getElementById('hidden-login-form');
            if (hiddenForm) {
                hiddenForm.addEventListener('submit', (e) => e.preventDefault());
            }
        },

        // IHC PARCHE SEGURIDAD: Vaciar campos al navegar fuera (Heurística #10/5)
        resetearFormulario() {
            const inputCedula = document.getElementById('login-cedula');
            const inputPassword = document.getElementById('login-password');

            if (inputCedula) inputCedula.value = '';
            if (inputPassword) {
                inputPassword.value = '';
                inputPassword.classList.add('input-password-masked');
            }

            // Restablecer icono de ojo
            const icon = document.getElementById('login-eye-icon');
            if (icon) icon.classList.replace('fa-eye-slash', 'fa-eye');

            // Limpiar mensajes de error
            this._limpiarError('login-cedula');
            this._limpiarError('login-password');
        },

        togglePassword() {
            const input = document.getElementById('login-password');
            const icon = document.getElementById('login-eye-icon');
            if (!input) return;

            if (input.classList.contains('input-password-masked')) {
                input.classList.remove('input-password-masked');
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.classList.add('input-password-masked');
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        },

        _mostrarError(campoId, mensaje) {
            const span = document.getElementById(`${campoId}-error`);
            const input = document.getElementById(campoId);
            if (span) { span.textContent = mensaje; span.style.display = 'block'; }
            if (input) { input.style.borderColor = '#c0392b'; }
        },

        _limpiarError(campoId) {
            const span = document.getElementById(`${campoId}-error`);
            const input = document.getElementById(campoId);
            if (span) { span.textContent = ''; span.style.display = 'none'; }
            if (input) { input.style.borderColor = ''; }
        },

        _intentosFallidos: 0,
        _bloqueadoHasta: 0,
        _bloqueoInterval: null,

        _activarBloqueo(segundos) {
            const self = this;
            self._bloqueadoHasta = Date.now() + segundos * 1000;
            clearInterval(self._bloqueoInterval);
            const btn = document.getElementById('login-submit-btn');
            if (btn) {
                btn.disabled = true;
                btn.dataset.originalHtml = btn.dataset.originalHtml || btn.innerHTML;
            }
            const tick = () => {
                const restante = Math.ceil((self._bloqueadoHasta - Date.now()) / 1000);
                const spanPwd = document.getElementById('login-password-error');
                if (spanPwd) {
                    spanPwd.textContent = `Demasiados intentos. Espera ${restante} segundo${restante !== 1 ? 's' : ''} para continuar.`;
                    spanPwd.style.display = 'block';
                }
                if (btn) btn.innerHTML = `<i class="fa-solid fa-clock" aria-hidden="true"></i> Espera ${restante}s…`;
                if (restante <= 0) {
                    clearInterval(self._bloqueoInterval);
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = btn.dataset.originalHtml || 'Iniciar sesión';
                    }
                    const span2 = document.getElementById('login-password-error');
                    if (span2) { span2.textContent = ''; span2.style.display = 'none'; }
                }
            };
            tick();
            self._bloqueoInterval = setInterval(tick, 1000);
        },

        async enviar(e) {
            e?.preventDefault?.();

            // Verificar bloqueo temporal por intentos fallidos
            if (Date.now() < this._bloqueadoHasta) return;

            const identificacion = (document.getElementById('login-cedula')?.value || '').trim();
            const password = (document.getElementById('login-password')?.value || '').trim();
            let valido = true;

            this._limpiarError('login-cedula');
            this._limpiarError('login-password');

            // TR-128: Solo Cédula de Identidad ecuatoriana con Módulo 10.
            if (identificacion.length === 0) {
                this._mostrarError('login-cedula', 'Ingresa tu número de identificación.');
                valido = false;
            } else if (identificacion.length !== 10 || !/^\d{10}$/.test(identificacion) ||
                       !utilidades.validarCedulaEcuatoriana(identificacion)) {
                this._mostrarError('login-cedula', 'Por favor, ingrese una Cédula de Identidad válida.');
                valido = false;
            }

            if (password.length === 0) {
                this._mostrarError('login-password', 'La contraseña es requerida.');
                valido = false;
            }

            if (!valido) {
                // TR-48: Scroll suave + foco al primer campo inválido del login
                app.enfocarPrimerError('login-form');
                return;
            }

            let fila = null;
            try {
                fila = await conCargaGlobal(
                    () => loginPacientePorIdentificadorYPassword(identificacion, password),
                    'Iniciando sesión…'
                );
            } catch (err) {
                console.error('[Supabase] Login:', err);
                this._mostrarError('login-password', 'No se pudo conectar. Intenta de nuevo.');
                return;
            }

            if (!fila) {
                // TR-42 §2: Anti-Enumeración OWASP
                // Ambos inputs reciben borde rojo al mismo tiempo.
                // Un solo mensaje genérico: no revela si falló usuario o contraseña.
                const inputCed = document.getElementById('login-cedula');
                const inputPwd = document.getElementById('login-password');
                const spanPwd = document.getElementById('login-password-error');

                this._intentosFallidos++;

                if (this._intentosFallidos >= 3) {
                    this._intentosFallidos = 0;
                    if (inputCed) inputCed.style.borderColor = '#c0392b';
                    if (inputPwd) inputPwd.style.borderColor = '#c0392b';
                    this._activarBloqueo(30);
                } else {
                    if (inputCed) inputCed.style.borderColor = '#c0392b';
                    if (inputPwd) inputPwd.style.borderColor = '#c0392b';
                    if (spanPwd) {
                        spanPwd.textContent = `Número de identificación o contraseña incorrectos. Intento ${this._intentosFallidos} de 3.`;
                        spanPwd.style.display = 'block';
                    }
                }

                return;
            }

            // Inicio de sesión exitoso — reiniciar contador de intentos
            this._intentosFallidos = 0;

            const usuarioEncontrado = mapPacienteAUsuarioActivo(fila);

            const hiddenUsername = document.getElementById('hidden-username');
            const hiddenPassword = document.getElementById('hidden-password');
            if (hiddenUsername && hiddenPassword) {
                hiddenUsername.value = identificacion;
                hiddenPassword.value = password;
                const hiddenForm = document.getElementById('hidden-login-form');
                const submitHidden = hiddenForm?.querySelector('button[type="submit"]');
                if (submitHidden) submitHidden.click();
            }

            this.resetearFormulario();
            localStorage.setItem('usuarioLogueado', 'true');
            localStorage.setItem('usuarioActivo', JSON.stringify(usuarioEncontrado));

            app.iniciarSesionUsuario();

            const vistaOrigen = sessionStorage.getItem('vista_origen');
            sessionStorage.removeItem('vista_origen');

            if (!vistaOrigen || vistaOrigen === 'registro') {
                app.navegar('home');
            } else if (vistaOrigen === 'citas') {
                sessionStorage.setItem(STORAGE_CITA_POST_LOGIN, '1');
                app.navegar('citas');
            } else {
                app.navegar(vistaOrigen);
            }
        }
    },

    // ======================================================================
    // 10. MÓDULO REGISTRO — Step Manager de 3 Pasos
    // ======================================================================
    registro: {

        _pasoActual: 1,
        _tipoDoc: 'Cédula',   // TR-128: siempre Cédula de Identidad
        _sexo: '',
        _codigoOTPGenerado: '',
        _countdownInterval: null,
        _reenvioFeedbackTimer: null,
        _otpToastTimer: null,
        _regexNombre: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,
        ...registroOtpControl,

        /* TR-112 (simplificado): Las funciones _neutralizar, _preparar, _onPasswordFocus,
           _asegurarPasswordFuera y _activarCredencialesCommit han sido eliminadas.
           Ahora se usa CSS Masking (.input-password-masked) en un input type="text". */

        // ------------------------------------------------------------------
        // 10.1 Inicialización: bloqueos de input + on-blur + fecha max
        // ------------------------------------------------------------------
        inicializar() {
            this._cerrarModalCuentaExistenteRegistro();
            // Los límites de fecha (min: 120 años, max: 18 años) son aplicados por
            // app._aplicarLimitesFechaGlobal() que se ejecuta en app.inicializar().
            // No es necesario establecer atributos de fecha aquí.

            // TR-128: el campo de cédula siempre habilitado — no requiere selección previa de tipo de doc.

            // ── Sanitización en tiempo real + ON-BLUR (valida) ──
            // Reglas OWASP por tipo de campo:
            //   Nombres/Apellidos → solo letras (con tildes y ñ) + un espacio simple
            //   Email/Password    → sin espacios
            //   Cédula/Teléfono   → solo dígitos (manejados antes de este bloque)
            //
            // El helper app._sanitizarInput() aplica la regex, preserva el cursor
            // y dispara la clase .input-rechazado si hubo rechazo.

            // — Teléfonos: solo dígitos —
            ['reg-celular', 'reg-fijo'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.removeEventListener('input', el._inputHandler);
                el._inputHandler = () => {
                    app._sanitizarInput(el, /\D/g);
                    this._limpiarError(id);
                };
                el.addEventListener('input', el._inputHandler);

                el.removeEventListener('blur', el._blurHandler);
                el._blurHandler = () => this._validarCampo(id);
                el.addEventListener('blur', el._blurHandler);
            });

            // — Identificación: TR-128 solo dígitos (Cédula de Identidad ecuatoriana) —
            const regIdent = document.getElementById('reg-identificacion');
            if (regIdent) {
                regIdent.removeEventListener('input', regIdent._inputHandler);
                regIdent._inputHandler = () => {
                    app._sanitizarInput(regIdent, /[^0-9]/g);
                    this._limpiarError('reg-ident');
                };
                regIdent.addEventListener('input', regIdent._inputHandler);

                regIdent.removeEventListener('blur', regIdent._blurHandler);
                regIdent._blurHandler = () => this._validarCampo('reg-identificacion');
                regIdent.addEventListener('blur', regIdent._blurHandler);
            }

            // — Campos de texto del paso 1: nombres, apellidos —
            // Regex de nombres: solo letras latinas (con tildes/ñ) y UNO espacio.
            // La función 'extra' elimina dobles-espacios y espacio inicial.
            const REGEX_NOMBRE = /[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g;
            const EXTRA_NOMBRE = v => v.replace(/\s{2,}/g, ' ').replace(/^\s/, '');

            ['reg-nombre1', 'reg-nombre2', 'reg-apellido1', 'reg-apellido2'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;

                el.removeEventListener('input', el._inputHandler);
                el._inputHandler = () => {
                    app._sanitizarInput(el, REGEX_NOMBRE, EXTRA_NOMBRE);
                    this._limpiarError(id);
                };
                el.addEventListener('input', el._inputHandler);

                el.removeEventListener('blur', el._blurHandler);
                el._blurHandler = () => this._validarCampo(id);
                el.addEventListener('blur', el._blurHandler);
            });

            // — Email: sin espacios —
            const regEmail = document.getElementById('reg-email');
            if (regEmail) {
                regEmail.removeEventListener('input', regEmail._inputHandler);
                regEmail._inputHandler = () => {
                    app._sanitizarInput(regEmail, /\s/g);
                    this._limpiarError('reg-email');
                };
                regEmail.addEventListener('input', regEmail._inputHandler);

                regEmail.removeEventListener('blur', regEmail._blurHandler);
                regEmail._blurHandler = () => this._validarCampo('reg-email');
                regEmail.addEventListener('blur', regEmail._blurHandler);
            }

            // — Password: sin espacios —
            const regPwd = document.getElementById('reg-password');
            if (regPwd) {
                regPwd.removeEventListener('input', regPwd._inputHandler);
                regPwd._inputHandler = () => {
                    app._sanitizarInput(regPwd, /\s/g);
                    this._limpiarError('reg-password');
                };
                regPwd.addEventListener('input', regPwd._inputHandler);

                regPwd.removeEventListener('blur', regPwd._blurHandler);
                regPwd._blurHandler = () => this._validarCampo('reg-password');
                regPwd.addEventListener('blur', regPwd._blurHandler);

                // Indicador de fortaleza de contraseña
                const regPwdBar = document.getElementById('reg-pass-strength');
                if (regPwdBar && !regPwd.dataset.strengthBound) {
                    regPwd.dataset.strengthBound = '1';
                    regPwd.addEventListener('input', () => {
                        const v = regPwd.value;
                        if (!v) { regPwdBar.style.display = 'none'; return; }
                        regPwdBar.style.display = 'flex';
                        const tipos = [/[A-Z]/.test(v), /[a-z]/.test(v), /[0-9]/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
                        let nivel, etiqueta, color;
                        if (v.length < 6 || tipos < 2) { nivel = 1; etiqueta = 'Débil'; color = '#e74c3c'; }
                        else if (v.length < 8 || tipos < 3) { nivel = 2; etiqueta = 'Media'; color = '#e67e22'; }
                        else { nivel = 3; etiqueta = 'Fuerte'; color = '#27ae60'; }
                        regPwdBar.querySelector('.pass-strength__label').textContent = etiqueta;
                        regPwdBar.querySelectorAll('.pass-strength__seg').forEach((s, i) => {
                            s.style.background = i < nivel ? color : '#e0e0e0';
                        });
                    });
                }

            }

            // — Fecha de nacimiento: solo 'change' (no input en todos los browsers) —
            const regFecha = document.getElementById('reg-fecha-nac');
            if (regFecha) {
                regFecha.removeEventListener('change', regFecha._changeHandler);
                regFecha._changeHandler = () => this._limpiarError('reg-fecha');
                regFecha.addEventListener('change', regFecha._changeHandler);

                regFecha.removeEventListener('blur', regFecha._blurHandler);
                regFecha._blurHandler = () => this._validarCampo('reg-fecha-nac');
                regFecha.addEventListener('blur', regFecha._blurHandler);
            }

            // ── Restaurar borrador si existe ──
            this._cargarBorrador();

            // ── Auto-guardado en cada cambio ──
            const contenedorRegistro = document.getElementById('view-registro');
            if (contenedorRegistro) {
                contenedorRegistro.addEventListener('input', () => this._guardarBorrador());
                contenedorRegistro.addEventListener('change', () => this._guardarBorrador()); // para selects y date
            }
            // ── TR-119: Enter en campos de registro avanza al siguiente paso ─
            (function () {
                function _enlazarEnterReg(ids, btnId) {
                    ids.forEach(id => {
                        const el = document.getElementById(id);
                        if (!el || el.dataset.tr119Enter === '1') return;
                        el.dataset.tr119Enter = '1';
                        el.addEventListener('keydown', (e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            const btn = document.getElementById(btnId);
                            if (btn) { btn.focus(); btn.click(); }
                        });
                    });
                }
                _enlazarEnterReg(['reg-identificacion', 'reg-nombre1', 'reg-nombre2', 'reg-apellido1', 'reg-apellido2'], 'reg-btn-paso1');
                _enlazarEnterReg(['reg-celular', 'reg-email', 'reg-password'], 'reg-btn-paso2');
                _enlazarEnterReg(['reg-codigo'], 'reg-validar-btn');
            })();

            // Reiniciar al paso 1
            this._irAPaso(1);
        },

        // Guarda todos los campos visibles y ocultos del registro en sessionStorage
        _guardarBorrador() {
            const campos = [
                'reg-tipo-doc', 'reg-identificacion',
                'reg-nombre1', 'reg-nombre2',
                'reg-apellido1', 'reg-apellido2',
                'reg-fecha-nac',
                'reg-sexo',
                'reg-celular', 'reg-fijo',
                'reg-email', 'reg-password',
                'reg-codigo'
            ];
            const borrador = {};
            campos.forEach(id => {
                const el = document.getElementById(id);
                if (el) borrador[id] = el.value;
            });
            borrador._tipoDoc = this._tipoDoc;
            borrador._sexo = this._sexo;
            borrador.timestamp = Date.now();
            sessionStorage.setItem('sanitas_borrador_registro', JSON.stringify(borrador));
        },

        // Carga el borrador y lo aplica a los inputs
        _cargarBorrador() {
            this._verificarExpiracionBorrador();
            const raw = sessionStorage.getItem('sanitas_borrador_registro');
            if (!raw) return;
            let borrador;
            try { borrador = JSON.parse(raw); } catch (e) { return; }

            Object.keys(borrador).forEach(id => {
                if (id.startsWith('_')) return;
                const el = document.getElementById(id);
                if (el) el.value = borrador[id] || '';
            });

            // TR-128: _tipoDoc siempre es 'Cédula'; ignorar cualquier valor del borrador
            if (borrador._sexo) this._sexo = borrador._sexo;
        },

        // Verifica si el borrador ha expirado (>3 min) y lo elimina limpiando además los inputs
        _verificarExpiracionBorrador() {
            const raw = sessionStorage.getItem('sanitas_borrador_registro');
            if (!raw) return;
            let data;
            try { data = JSON.parse(raw); } catch (e) { return; }

            // Si no tiene timestamp o ya expiró (>3 min)
            if (!data.timestamp || (Date.now() - data.timestamp > 3 * 60 * 1000)) {
                sessionStorage.removeItem('sanitas_borrador_registro');

                // Limpiar todos los campos de texto y desmarcar radios
                const campos = [
                    'reg-tipo-doc', 'reg-identificacion',
                    'reg-nombre1', 'reg-nombre2',
                    'reg-apellido1', 'reg-apellido2',
                    'reg-fecha-nac',
                    'reg-sexo',
                    'reg-celular', 'reg-fijo',
                    'reg-email', 'reg-password',
                    'reg-codigo'
                ];
                campos.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });

                // Desmarcar los radio buttons de los modales
                document.querySelectorAll('.reg-modal-overlay input[type="radio"]').forEach(r => {
                    r.checked = false;
                });

                // Restablecer estados internos
                this._tipoDoc = 'Cédula';
                this._sexo = '';
                this._codigoOTPGenerado = '';
            }
        },

        _emitirOTPAlEntrarPaso3() {
            const emailVal = (document.getElementById('reg-email')?.value || '').trim();
            const emailEl = document.getElementById('reg-email-show');
            if (emailEl) emailEl.textContent = emailVal;

            const codigo = String(Math.floor(100000 + Math.random() * 900000));
            this._codigoOTPGenerado = codigo;

            // ── TR-40 + TR-41: OTP por EmailJS con nombre real (sin fallback genérico) ──
            const EMAILJS_PUBLIC_KEY = 'kk20Q6x-B6giGcqcU';
            const EMAILJS_SERVICE_ID = 'service_y7c5ugc';
            const EMAILJS_TEMPLATE_ID = 'template_kf8kpt8';

            // TR-41: Capturar el nombre real del DOM (el usuario lo escribió en el Paso 1).
            // No se permite sustituir con 'Usuario' si el campo existe y tiene contenido.
            const nombreReal = (document.getElementById('reg-nombre1')?.value || '').trim();
            if (!nombreReal) console.warn('[TR-41] #reg-nombre1 vacío al emitir OTP.');

            console.log('[QA OTP Registro] Código:', codigo, '| correo:', emailVal, '| nombre:', nombreReal);

            if (typeof emailjs !== 'undefined') {
                emailjs.init(EMAILJS_PUBLIC_KEY);
                emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                    nombre_usuario: nombreReal,
                    correo_destino: emailVal,
                    codigo_otp: codigo
                }).then(() => {
                    console.log('[EmailJS] OTP de registro enviado a', emailVal);
                }).catch(err => {
                    console.error('[EmailJS] Error al enviar OTP de registro:', err);
                });
            } else {
                console.warn('[EmailJS] SDK no disponible. Código en consola (arriba).');
            }

            this._iniciarCountdown(90);
        },

        // ------------------------------------------------------------------
        // 10.2 Navegación de Pasos
        // ------------------------------------------------------------------
        _irAPaso(n) {
            for (let i = 1; i <= 3; i++) {
                const el = document.getElementById(`reg-step-${i}`);
                if (el) el.style.display = (i === n) ? 'flex' : 'none';
            }
            this._pasoActual = n;
            if (n === 3) {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => this._emitirOTPAlEntrarPaso3());
                });
            }
            // TR-29 / TR-12: scroll al inicio al cambiar de paso en el registro.
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // TR-53: Registrar paso en historial SOLO si no venimos del popstate
            // (_suppressPushState evita el bucle pushState → popstate → pushState).
            if (!this._suppressPushState) {
                history.pushState(
                    { tipo: 'formulario-reg', paso: n },
                    '',
                    `#reg-paso-${n}`
                );
            }
        },

        /** TR-30: cierra el modal de cuenta duplicada si está abierto. */
        _cerrarModalCuentaExistenteRegistro() {
            const el = document.getElementById('reg-modal-cuenta-existente');
            if (el) el.remove();
        },

        /**
         * TR-30: modal de recuperación (Heurística #9) — evita callejón sin salida.
         * @param {{ titulo: string, mensaje: string }} opts
         */
        _mostrarModalCuentaExistenteRegistro(opts) {
            this._cerrarModalCuentaExistenteRegistro();
            const titulo = escapeHtmlWidget(opts.titulo || 'Cuenta existente');
            const mensaje = escapeHtmlWidget(opts.mensaje || 'Ya existe una cuenta con estos datos.');
            const modal = document.createElement('div');
            modal.id = 'reg-modal-cuenta-existente';
            modal.className = 'modal-overlay';
            modal.setAttribute('role', 'alertdialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'reg-modal-cuenta-existente-title');
            // TR-53: ancla en historial para que Atrás nativo cierre este modal
            history.pushState({ vista: 'modal', id: 'reg-modal-cuenta-existente' }, '', '');
            modal.style.display = 'flex';
            modal.innerHTML =
                '<div class="modal-content">' +
                '<div class="modal-header">' +
                `<h2 id="reg-modal-cuenta-existente-title" class="modal-header__title">${titulo}</h2>` +
                '</div>' +
                '<div class="modal-body">' +
                `<p>${mensaje}</p>` +
                '</div>' +
                '<div class="modal-actions">' +
                '<button type="button" class="btn btn--primario" onclick="app.navegar(\'login\')">Ir a Iniciar Sesión</button>' +
                '<button type="button" class="btn btn--secundario" data-reg-cerrar-modal>Cerrar</button>' +
                '</div>' +
                '</div>';
            const cerrar = modal.querySelector('[data-reg-cerrar-modal]');
            if (cerrar) cerrar.onclick = () => this._cerrarModalCuentaExistenteRegistro();
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this._cerrarModalCuentaExistenteRegistro();
            });
            document.body.appendChild(modal);
        },

        /** Detecta violación de unicidad / duplicado en insert pacientes (Postgres / PostgREST). */
        _esErrorDuplicadoPaciente(err) {
            const code = err?.code ?? err?.cause?.code;
            if (code === '23505') return true;
            const msg = String(err?.message || err?.details || err?.hint || '').toLowerCase();
            return msg.includes('duplicate') || msg.includes('unique') || msg.includes('already exists');
        },

        async siguientePaso(pasoActual) {
            if (!this._validarPaso(pasoActual)) {
                // TR-48: Scroll suave + foco al primer campo inválido del paso actual
                app.enfocarPrimerError(`reg-step-${pasoActual}`);
                return;
            }

            if (pasoActual === 1) {
                const ident = (document.getElementById('reg-identificacion')?.value || '').trim();
                if (ident) {
                    try {
                        const pacientePrevio = await conCargaGlobal(
                            () => fetchPacienteRegistroPorCedula(ident),
                            'Verificando datos…'
                        );
                        if (pacientePrevio && pacientePrevio.es_invitado !== true) {
                            this._mostrarModalCuentaExistenteRegistro({
                                titulo: 'Cédula ya registrada',
                                mensaje: 'Esta cédula ya está vinculada a una cuenta registrada.'
                            });
                            return;
                        }
                    } catch (e) {
                        console.error('[Supabase] Comprobación cédula registro:', e);
                        alert('No se pudo verificar la cédula. Comprueba tu conexión e inténtalo de nuevo.');
                        return;
                    }
                }
            }

            if (pasoActual === 2) {
                const correoVal = (document.getElementById('reg-email')?.value || '').trim();
                const cedulaReg = (document.getElementById('reg-identificacion')?.value || '').trim();
                if (correoVal) {
                    try {
                        const correoEnOtro = await conCargaGlobal(
                            () => correoOcupadoPorOtraCedula(correoVal, cedulaReg),
                            'Verificando datos…'
                        );
                        if (correoEnOtro) {
                            this._mostrarModalCuentaExistenteRegistro({
                                titulo: 'Correo ya registrado',
                                mensaje: 'Ya existe una cuenta con este correo electrónico.'
                            });
                            return;
                        }
                    } catch (e) {
                        console.error('[Supabase] Comprobación correo registro:', e);
                        alert('No se pudo verificar el correo. Comprueba tu conexión e inténtalo de nuevo.');
                        return;
                    }
                }

            }

            this._irAPaso(pasoActual + 1);
        },

        pasoAnterior(pasoActual) {
            if (pasoActual > 1) this._irAPaso(pasoActual - 1);
        },

        // TR-54: Función de retroceso delegada por el router popstate global.
        // Lee _pasoActual como fuente de verdad (no depende del estado del navegador).
        // _suppressPushState ya está activo cuando el popstate la invoca, por lo que
        // _irAPaso() no generará un pushState accidental (anti-bucle garantizado).
        irAtras() {
            if (this._pasoActual > 1) {
                this._suppressPushState = true;
                try {
                    this._irAPaso(this._pasoActual - 1);
                } finally {
                    this._suppressPushState = false;
                }
            }
        },

        // ------------------------------------------------------------------
        // 10.3 Ayudas de error/éxito
        // ------------------------------------------------------------------
        _mostrarError(campoId, msg) {
            const span = document.getElementById(`${campoId}-error`);
            const input = document.getElementById(campoId);
            if (span) { span.textContent = msg; span.style.display = 'block'; }
            if (input) { input.style.borderColor = '#c0392b'; }
        },

        _limpiarError(campoId) {
            const span = document.getElementById(`${campoId}-error`);
            const input = document.getElementById(campoId);
            if (span) { span.textContent = ''; span.style.display = 'none'; }
            if (input) { input.style.borderColor = ''; }
        },

        _marcarExito(campoId) {
            const input = document.getElementById(campoId);
            if (input) input.style.borderColor = 'var(--action-color)';
        },

        // ------------------------------------------------------------------
        // 10.4 _validarCampo — valida UN campo y retorna true/false
        //      Mensajes constructivos (Heurística #9 Nielsen)
        // ------------------------------------------------------------------
        _validarCampo(id) {
            this._limpiarError(id);

            switch (id) {

                /* ── IDENTIFICACIÓN ── */
                case 'reg-identificacion': {
                    // TR-128: solo Cédula de Identidad con Módulo 10
                    const ident = (document.getElementById(id)?.value || '').trim();
                    if (ident.length === 0) {
                        this._mostrarError('reg-ident',
                            'Por favor, ingresa tu Cédula de Identidad antes de continuar.');
                        return false;
                    }
                    if (!/^\d{10}$/.test(ident) || !utilidades.validarCedulaEcuatoriana(ident)) {
                        this._mostrarError('reg-ident',
                            'Por favor, ingrese una Cédula de Identidad válida.');
                        return false;
                    }
                    this._marcarExito('reg-identificacion');
                    return true;
                }

                /* ── NOMBRE 1 ── */
                case 'reg-nombre1': {
                    const val = (document.getElementById(id)?.value || '').trim();
                    if (!val) {
                        this._mostrarError(id,
                            'El primer nombre es obligatorio. Por favor, escríbelo antes de continuar.');
                        return false;
                    }
                    if (!this._regexNombre.test(val)) {
                        this._mostrarError(id,
                            'Por favor, ingresa tu nombre usando solo letras (Ej: Juan). ' +
                            'Revisa si no hay números o símbolos.');
                        return false;
                    }
                    this._marcarExito(id);
                    return true;
                }

                /* ── NOMBRE 2 (opcional) ── */
                case 'reg-nombre2': {
                    const val = (document.getElementById(id)?.value || '').trim();
                    // Campo opcional: solo se valida si tiene contenido
                    if (val && !this._regexNombre.test(val)) {
                        this._mostrarError(id,
                            'Por favor, ingresa el nombre usando solo letras (Ej: Andrés). ' +
                            'Evita números o símbolos.');
                        return false;
                    }
                    this._marcarExito(id);
                    return true;
                }

                /* ── APELLIDO 1 ── */
                case 'reg-apellido1': {
                    const val = (document.getElementById(id)?.value || '').trim();
                    if (!val) {
                        this._mostrarError(id,
                            'El primer apellido es obligatorio. Por favor, escríbelo antes de continuar.');
                        return false;
                    }
                    if (!this._regexNombre.test(val)) {
                        this._mostrarError(id,
                            'Por favor, ingresa tu apellido usando solo letras (Ej: García). ' +
                            'Elimina números o símbolos.');
                        return false;
                    }
                    this._marcarExito(id);
                    return true;
                }

                /* ── APELLIDO 2 (opcional) ── */
                case 'reg-apellido2': {
                    const val = (document.getElementById(id)?.value || '').trim();
                    // Campo opcional: solo se valida si tiene contenido
                    if (val && !this._regexNombre.test(val)) {
                        this._mostrarError(id,
                            'Por favor, ingresa el apellido usando solo letras (Ej: Pérez). ' +
                            'Evita números o símbolos.');
                        return false;
                    }
                    this._marcarExito(id);
                    return true;
                }

                /* ── FECHA DE NACIMIENTO ── */
                case 'reg-fecha-nac': {
                    const val = document.getElementById(id)?.value || '';
                    if (!val) {
                        this._mostrarError('reg-fecha',
                            'Por favor, selecciona tu fecha de nacimiento. ' +
                            'Es necesaria para verificar tu edad.');
                        return false;
                    }
                    // Capa 2 anti-hack (TR-13): validación JS independiente del HTML.
                    // Previene que alguien elimine el atributo min/max desde DevTools.
                    const rangos = app.obtenerRangosFecha();
                    if (val > rangos.hace18Anios) {
                        this._mostrarError('reg-fecha',
                            'Debes tener al menos 18 años para crear una cuenta principal.');
                        return false;
                    }
                    if (val < rangos.hace120Anios) {
                        this._mostrarError('reg-fecha',
                            'La fecha de nacimiento no puede ser hace más de 120 años.');
                        return false;
                    }
                    this._marcarExito(id);
                    return true;
                }

                /* ── TELÉFONO CELULAR ── */
                // Validación contextual en cascada (H9) – delegada a utilidades.validarCelular()
                case 'reg-celular': {
                    const val = (document.getElementById(id)?.value || '').trim();
                    const errorCelular = utilidades.validarCelular(val);
                    if (errorCelular) {
                        this._mostrarError(id, errorCelular);
                        return false;
                    }
                    this._marcarExito(id);
                    return true;
                }

                /* ── EMAIL ── */
                case 'reg-email': {
                    const val = (document.getElementById(id)?.value || '').trim();
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                        this._mostrarError(id,
                            'El formato del correo no es válido. Asegúrate de incluir el símbolo "@" ' +
                            'y un dominio (Ej: correo@ejemplo.com).');
                        return false;
                    }
                    this._marcarExito(id);
                    return true;
                }

                /* ── CONTRASEÑA ── */
                case 'reg-password': {
                    const val = document.getElementById(id)?.value || '';
                    if (val.length < 6) {
                        this._mostrarError(id,
                            'Tu contraseña es muy corta. Debe tener al menos 6 caracteres ' +
                            'para ser segura (Ej: combina letras y números).');
                        return false;
                    }
                    this._marcarExito(id);
                    return true;
                }

                default:
                    return true;
            }
        },

        // ------------------------------------------------------------------
        // 10.5 _validarPaso — delega en _validarCampo por cada campo del paso
        // ------------------------------------------------------------------
        _validarPaso(paso) {
            let ok = true;

            if (paso === 1) {
                // TR-128: tipo de documento fijo en 'Cédula' — no se valida selector
                if (!this._validarCampo('reg-identificacion')) ok = false;

                // Nombres y Apellidos
                ['reg-nombre1', 'reg-nombre2', 'reg-apellido1', 'reg-apellido2'].forEach(id => {
                    if (!this._validarCampo(id)) ok = false;
                });

                // Fecha
                if (!this._validarCampo('reg-fecha-nac')) ok = false;

                // Sexo
                this._limpiarError('reg-sexo');
                if (!this._sexo) {
                    this._mostrarError('reg-sexo',
                        'Por favor, selecciona tu sexo para continuar con el registro.');
                    ok = false;
                }
            }

            if (paso === 2) {
                if (!this._validarCampo('reg-celular')) ok = false;
                if (!this._validarCampo('reg-email')) ok = false;
                if (!this._validarCampo('reg-password')) ok = false;
            }

            return ok;
        },

        // ------------------------------------------------------------------
        // 10.6 Contador de reenvío — TR-118: js/modulos/registro.js (registroOtpControl)
        // ------------------------------------------------------------------

        // ------------------------------------------------------------------
        // 10.7 Validación del Código (Paso 3)
        // ------------------------------------------------------------------
        async validarCodigo() {
            this._limpiarError('reg-codigo');
            const codigo = (document.getElementById('reg-codigo')?.value || '').trim();

            if (codigo.length !== 6) {
                this._mostrarError('reg-codigo',
                    'El código de verificación debe tener exactamente 6 dígitos. ' +
                    'Revisa el correo que enviamos y cópialo aquí.');
                return;
            }
            if (codigo !== this._codigoOTPGenerado) {
                this._mostrarError('reg-codigo',
                    'El código ingresado no coincide. Verifica que lo hayas escrito correctamente ' +
                    'o solicita uno nuevo cuando el contador llegue a cero.');
                return;
            }

            // Leer la contraseña directamente del input (type="text" con CSS masking).
            const finalPass = (document.getElementById('reg-password')?.value || '').trim();

            const nuevoUsuario = {
                tipoDoc: this._tipoDoc,
                identificacion: (document.getElementById('reg-identificacion')?.value || '').trim(),
                nombre1: (document.getElementById('reg-nombre1')?.value || '').trim(),
                nombre2: (document.getElementById('reg-nombre2')?.value || '').trim(),
                apellido1: (document.getElementById('reg-apellido1')?.value || '').trim(),
                apellido2: (document.getElementById('reg-apellido2')?.value || '').trim(),
                fechaNac: document.getElementById('reg-fecha-nac')?.value || '',
                sexo: this._sexo,
                celular: (document.getElementById('reg-celular')?.value || '').trim(),
                fijo: (document.getElementById('reg-fijo')?.value || '').trim(),
                correo: (document.getElementById('reg-email')?.value || '').trim(),
                email: (document.getElementById('reg-email')?.value || '').trim(),
                password: finalPass
            };

            const filaPacienteSupabase = pacienteDesdeRegistroLocal(nuevoUsuario);

            let filaInsertada;
            try {
                filaInsertada = await conCargaGlobal(
                    () => registrarPacienteCondicionalTR110(filaPacienteSupabase),
                    'Creando tu cuenta…'
                );
            } catch (err) {
                console.error('[Supabase] Registro:', err);
                if (err?.code === 'TR110_CUENTA_REGISTRADA') {
                    this._limpiarError('reg-codigo');
                    this._mostrarModalCuentaExistenteRegistro({
                        titulo: 'Cédula ya registrada',
                        mensaje: err.message || 'Esta cédula ya está vinculada a una cuenta registrada.'
                    });
                    return;
                }
                if (this._esErrorDuplicadoPaciente(err)) {
                    this._limpiarError('reg-codigo');
                    this._mostrarModalCuentaExistenteRegistro({
                        titulo: 'No se pudo crear la cuenta',
                        mensaje: 'Los datos coinciden con una cuenta que ya existe. Puedes iniciar sesión con tu cédula o correo y tu contraseña.'
                    });
                    return;
                }
                this._mostrarError('reg-codigo',
                    'No se pudo guardar el registro en el servidor. Revisa los datos o intenta más tarde.');
                return;
            }

            const usuarioActivo = mapPacienteAUsuarioActivo(filaInsertada || filaPacienteSupabase);
            localStorage.setItem('usuarioLogueado', 'true');
            localStorage.setItem('usuarioActivo', JSON.stringify(usuarioActivo));

            // Ghost Form eliminado — ya no se necesita con CSS Masking.

            clearInterval(this._countdownInterval);
            app.iniciarSesionUsuario();
            sessionStorage.removeItem('sanitas_borrador_registro');
            const campos = [
                'reg-tipo-doc', 'reg-identificacion',
                'reg-nombre1', 'reg-nombre2',
                'reg-apellido1', 'reg-apellido2',
                'reg-fecha-nac',
                'reg-sexo',
                'reg-celular', 'reg-fijo',
                'reg-email', 'reg-password',
                'reg-codigo'
            ];
            campos.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            this._tipoDoc = 'Cédula';
            this._sexo = '';
            this._codigoOTPGenerado = '';

            const contenedorRegistro = document.getElementById('view-registro');
            if (contenedorRegistro) {
                contenedorRegistro.innerHTML = `
                    <div class="pantalla-exito-registro">
                        <i class="fa-solid fa-circle-check icono-exito-grande"></i>
                        <h2>¡Cuenta creada con éxito!</h2>
                        <p>Bienvenido al sistema. Ahora puedes gestionar tus citas médicas y revisar tu historial en Mi Salud.</p>
                        <button class="btn btn--primario" onclick="app.navegar('home')">
                            Continuar al Inicio
                        </button>
                    </div>
                `;
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    });
                });
            } else {
                app.navegar('home');
            }
        },

        // TR-128: modal de tipo de documento eliminado — funciones conservadas como no-ops
        // para compatibilidad con cualquier código externo que aún las invoque.
        abrirModalDoc() { /* no-op TR-128 */ },
        cerrarModalDoc() { /* no-op TR-128 */ },
        seleccionarDoc() { /* no-op TR-128 */ },

        // _renovarOTP — TR-118: js/modulos/registro.js (registroOtpControl)

        // ------------------------------------------------------------------
        // 10.9 Modales — Sexo
        // ------------------------------------------------------------------
        abrirModalSexo() {
            const m = document.getElementById('modal-sexo');
            if (!m) return;
            m.style.display = 'flex';
            // TR-53: ancla en historial para que Atrás nativo cierre el modal
            history.pushState({ tipo: 'modal', id: 'modal-sexo' }, '', '#modal');

            // TR-132: Patrón Centinela (Sentinel Node) ─────────────────────────
            // Los radio buttons con el mismo `name` son UN SOLO Tab-stop. Sin
            // centinelas, Tab desde el grupo salta directamente fuera del modal
            // y los listeners keydown/focusin no lo alcanzan a tiempo.
            //
            // Se inyectan dos nodos invisibles en los extremos del .reg-modal:
            //   sentTop    → intercepta Shift+Tab desde el primer elemento real
            //   sentBottom → intercepta Tab desde el grupo de radios (último stop)
            //
            // Al recibir foco redirigen inmediatamente dentro del modal.
            const inner    = m.querySelector('.reg-modal');
            const closeBtn = m.querySelector('.reg-modal__close');

            const _mkSentinel = () => {
                const s = document.createElement('span');
                s.tabIndex = 0;
                s.setAttribute('aria-hidden', 'true');
                s.style.cssText = [
                    'position:absolute', 'width:1px', 'height:1px',
                    'overflow:hidden', 'opacity:0', 'outline:none',
                    'border:none', 'padding:0', 'margin:0'
                ].join(';');
                return s;
            };

            // Centinela SUPERIOR ─────────────────────────────────────────────
            // Activado por: Shift+Tab desde el botón Cerrar (primer elemento real).
            // Acción: lleva el foco al último <label> del modal (Mujer).
            // Los <label> tienen tabindex=0 y son los Tab-stops individuales;
            // los <input type="radio"> tienen tabindex=-1 (fuera del Tab order).
            const sentTop = _mkSentinel();
            sentTop.addEventListener('focus', () => {
                const options = m.querySelectorAll('.reg-modal__option[tabindex="0"]');
                (options.length ? options[options.length - 1] : closeBtn).focus();
            });

            // Centinela INFERIOR ─────────────────────────────────────────────
            // Activado por: Tab desde el grupo de radios (único Tab-stop del grupo).
            // Acción: lleva el foco de regreso al botón Cerrar.
            const sentBottom = _mkSentinel();
            sentBottom.addEventListener('focus', () => {
                (closeBtn || m.querySelector('button')).focus();
            });

            if (inner) {
                inner.insertBefore(sentTop, inner.firstChild);
                inner.appendChild(sentBottom);
            }
            this._focusSentinels  = [sentTop, sentBottom];
            this._triggerModalSexo = document.getElementById('reg-sexo');

            // Auto-enfocar el botón Cerrar al abrir (primer elemento real del modal)
            requestAnimationFrame(() => { if (closeBtn) closeBtn.focus(); });
        },
        cerrarModalSexo() {
            const m = document.getElementById('modal-sexo');
            if (m) m.style.display = 'none';
            // TR-132: eliminar centinelas inyectados
            if (this._focusSentinels) {
                this._focusSentinels.forEach(s => { if (s.parentNode) s.remove(); });
                this._focusSentinels = null;
            }
            // TR-132: retornar foco al campo que abrió el modal
            if (this._triggerModalSexo && typeof this._triggerModalSexo.focus === 'function') {
                this._triggerModalSexo.focus();
            }
            this._triggerModalSexo = null;
        },
        seleccionarSexo(sexo) {
            this._sexo = sexo;

            // Actualizar input visible
            const input = document.getElementById('reg-sexo');
            if (input) input.value = sexo;

            // Forzar checked en el radio del modal (reactividad aunque repita opción)
            const radio = document.querySelector(`#modal-sexo input[type="radio"][value="${sexo}"]`);
            if (radio) radio.checked = true;

            this.cerrarModalSexo();
            this._limpiarError('reg-sexo');
        },

        // ------------------------------------------------------------------
        // 10.10 Toggle contraseña (paso 2)
        // ------------------------------------------------------------------
        togglePasswordReg() {
            const input = document.getElementById('reg-password');
            const icon = document.getElementById('reg-eye-icon');
            if (!input || this._pasoActual !== 2) return;

            if (input.classList.contains('input-password-masked')) {
                input.classList.remove('input-password-masked');
                icon?.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.classList.add('input-password-masked');
                icon?.classList.replace('fa-eye-slash', 'fa-eye');
            }
        },

        // ------------------------------------------------------------------
        // 10.11 Cancelar Registro — limpia formulario y redirige al login
        // ------------------------------------------------------------------
        cancelarRegistro() {
            this._cerrarModalCuentaExistenteRegistro();
            // 1. Vaciar todos los inputs de texto del formulario
            const camposTexto = [
                'reg-tipo-doc', 'reg-identificacion',
                'reg-nombre1', 'reg-nombre2',
                'reg-apellido1', 'reg-apellido2',
                'reg-fecha-nac',
                'reg-sexo',
                'reg-celular', 'reg-fijo',
                'reg-email', 'reg-password',
                'reg-codigo'
            ];
            camposTexto.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.value = '';
                    el.style.borderColor = '';   // quitar borde rojo/verde
                }
            });

            // 2. Deseleccionar todos los radio buttons de los modales (que están fuera de view-registro)
            document.querySelectorAll('.reg-modal-overlay input[type="radio"]').forEach(r => {
                r.checked = false;
            });

            // 3. Limpiar todos los spans de error
            const errores = [
                'reg-tipo-doc', 'reg-ident',
                'reg-nombre1', 'reg-nombre2',
                'reg-apellido1', 'reg-apellido2',
                'reg-fecha', 'reg-sexo',
                'reg-celular', 'reg-email',
                'reg-password', 'reg-codigo'
            ];
            errores.forEach(id => this._limpiarError(id));

            // 4. Restablecer estado interno (valores por defecto del objeto)
            this._tipoDoc = 'Cédula';
            this._sexo = '';
            this._codigoOTPGenerado = '';
            this._pasoActual = 1;
            clearInterval(this._countdownInterval);

            // Limpiar borrador del sessionStorage (la cuenta aún no es oficial hasta verificar el código).
            // La pantalla de éxito se muestra después de la verificación en validarCodigo().
            sessionStorage.removeItem('sanitas_borrador_registro');

            // 5. Redirigir al login (página física)
            app.navegar('login');
        }
    },

    // ======================================================================
    // 11. MÓDULO PERFIL — Modal de Usuario Autenticado
    // ======================================================================
    perfil: {

        // ------------------------------------------------------------------
        // 11.1 Abrir modal e inyectar datos del usuario activo
        // ------------------------------------------------------------------
        abrirModal() {
            const raw = localStorage.getItem('usuarioActivo');
            if (!raw) {
                alert('No hay sesión activa. Por favor, inicia sesión.');
                app.navegar('login');
                return;
            }

            const u = JSON.parse(raw);

            // Construir nombre completo (soporta claves del usuario demo y del registro)
            const nombre1 = u.nombre1 || u.nombre_1 || (u.nombres || '').split(/\s+/)[0] || '';
            const nombre2 = u.nombre2 || u.nombre_2 || (u.nombres || '').split(/\s+/).slice(1).join(' ') || '';
            const apellido1 = u.apellido1 || u.apellido_1 || (u.apellidos || '').split(/\s+/)[0] || '';
            const apellido2 = u.apellido2 || u.apellido_2 || (u.apellidos || '').split(/\s+/).slice(1).join(' ') || '';
            const nombreCompleto = [nombre1, nombre2, apellido1, apellido2]
                .filter(Boolean).join(' ')
                || [u.nombres, u.apellidos].filter(Boolean).join(' ').trim()
                || '—';
            const celular = u.celular || '—';

            // Inyectar en el DOM
            const elNombre = document.getElementById('perfil-nombre-completo');
            if (elNombre) elNombre.textContent = nombreCompleto || '—';

            const elCelular = document.getElementById('perfil-celular');
            if (elCelular) elCelular.textContent = celular;

            // Avatar: mostrar inicial del primer nombre
            const elAvatar = document.getElementById('perfil-avatar-iniciales');
            if (elAvatar) {
                const inicial = (nombre1 || (u.nombres || '').trim().charAt(0) || '').toUpperCase();
                if (inicial) {
                    elAvatar.textContent = inicial;
                } else {
                    elAvatar.innerHTML = '<i class="fa-solid fa-user"></i>';
                }
            }

            // Mostrar overlay
            const modal = document.getElementById('modal-perfil');
            if (modal) {
                // TR-53: ancla en historial para que Atrás nativo cierre este modal
                history.pushState({ vista: 'modal', id: 'modal-perfil' }, '', '');
                modal.style.display = 'flex';
            }
        },

        // ------------------------------------------------------------------
        // 11.2 Cerrar modal
        // ------------------------------------------------------------------
        cerrarModal() {
            const modal = document.getElementById('modal-perfil');
            if (modal) {
                modal.style.display = 'none';
                // TR-53: limpiar ancla del historial al cerrar con botón visual
                if (history.state && history.state.id === 'modal-perfil') history.back();
            }
        },

        // ------------------------------------------------------------------
        // 11.3 Cerrar sesión
        // ------------------------------------------------------------------
        cerrarSesion() {
            app.abrirModalLogout();
        },

        // ------------------------------------------------------------------
        // Navegar a Mi Salud desde el modal
        // ------------------------------------------------------------------
        irAMiSalud() {
            this.cerrarModal();
            app.navegar('mi-salud');
        },

        // ------------------------------------------------------------------
        // 11.4 Rellenar formulario editar perfil desde usuarioActivo (MPA)
        // ------------------------------------------------------------------
        _rellenarFormularioEditarDesdeStorage() {
            const raw = localStorage.getItem('usuarioActivo');
            if (!raw) return;

            const u = JSON.parse(raw);

            const set = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val || '';
            };

            set('edit-nombre1', u.nombre1 || u.nombre_1 || (u.nombres || '').split(/\s+/)[0] || '');
            set('edit-nombre2', u.nombre2 || u.nombre_2 || (u.nombres || '').split(/\s+/).slice(1).join(' ') || '');
            set('edit-apellido1', u.apellido1 || u.apellido_1 || (u.apellidos || '').split(/\s+/)[0] || '');
            set('edit-apellido2', u.apellido2 || u.apellido_2 || (u.apellidos || '').split(/\s+/).slice(1).join(' ') || '');
            set('edit-celular', u.celular || '');
            set('edit-email', u.email || '');
            // H3 (Control y Libertad): cargar fecha de nacimiento para permitir corrección
            set('edit-fecha-nac', u.fecha_nacimiento || '');

            // Aplicar límites dinámicos al input de fecha del perfil (TR-13)
            app._aplicarLimitesFechaGlobal();

            const msg = document.getElementById('edit-success-msg');
            if (msg) msg.style.display = 'none';

            ['edit-nombre1', 'edit-nombre2', 'edit-apellido1', 'edit-apellido2',
                'edit-celular', 'edit-email', 'edit-fecha-nac'].forEach(id => {
                    const el = document.getElementById(id);
                    const sp = document.getElementById(`${id}-error`);
                    if (el) el.style.borderColor = '';
                    if (sp) { sp.textContent = ''; sp.style.display = 'none'; }
                });

            // Sanitización en tiempo real: bloquea espacios al inicio y dobles espacios en campos de texto.
            // Usa la misma clase .input-rechazado del sistema para el feedback visual de parpadeo.
            ['edit-nombre1', 'edit-nombre2', 'edit-apellido1', 'edit-apellido2'].forEach(id => {
                const el = document.getElementById(id);
                if (!el || el.dataset.sanitizadorActivo) return;
                el.dataset.sanitizadorActivo = '1';

                const _flashRechazado = (inputEl) => {
                    if (inputEl._rechazadoTimer) clearTimeout(inputEl._rechazadoTimer);
                    inputEl.classList.add('input-rechazado');
                    inputEl._rechazadoTimer = setTimeout(() => inputEl.classList.remove('input-rechazado'), 300);
                };

                // Bloquea espacios al inicio y colapsa dobles espacios → parpadeo si hubo cambio
                el.addEventListener('input', function () {
                    const original = this.value;
                    const sanitizado = original.replace(/^ +/, '').replace(/ {2,}/g, ' ');
                    if (sanitizado !== original) {
                        const pos = this.selectionStart;
                        this.value = sanitizado;
                        const diff = original.length - sanitizado.length;
                        this.setSelectionRange(Math.max(0, pos - diff), Math.max(0, pos - diff));
                        _flashRechazado(this);
                    }
                });

                // Parpadeo al intentar escribir cuando ya se alcanzó el maxlength
                el.addEventListener('keydown', function (e) {
                    const max = parseInt(this.getAttribute('maxlength') || '0', 10);
                    if (max && this.value.length >= max && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        _flashRechazado(this);
                    }
                });
            });

            // ── TR-119: Enter en campos de edición guarda los cambios ────────
            ['edit-nombre1', 'edit-nombre2', 'edit-apellido1', 'edit-apellido2',
                'edit-celular', 'edit-email'].forEach(id => {
                const el = document.getElementById(id);
                if (!el || el.dataset.tr119Enter === '1') return;
                el.dataset.tr119Enter = '1';
                el.addEventListener('keydown', (e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const btn = document.getElementById('btn-guardar-perfil');
                    if (btn) { btn.focus(); btn.click(); }
                });
            });
        },

        // ------------------------------------------------------------------
        // 11.5 Ir a la vista de edición: carga datos y navega
        // ------------------------------------------------------------------
        irAEditar() {
            const raw = localStorage.getItem('usuarioActivo');
            if (!raw) { app.navegar('login'); return; }

            this.cerrarModal();
            app.navegar('editar-perfil');
        },

        // ------------------------------------------------------------------
        // 11.5 Helpers de validación (reutilizan patrones del registro)
        // ------------------------------------------------------------------
        _mostrarErrorEdit(id, msg) {
            const span = document.getElementById(`${id}-error`);
            const input = document.getElementById(id);
            if (span) { span.textContent = msg; span.style.display = 'block'; }
            if (input) input.style.borderColor = '#c0392b';
        },

        _limpiarErrorEdit(id) {
            const span = document.getElementById(`${id}-error`);
            const input = document.getElementById(id);
            if (span) { span.textContent = ''; span.style.display = 'none'; }
            if (input) input.style.borderColor = '';
        },

        _validarCamposEdit() {
            let ok = true;
            const soloLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;

            const nombre1 = document.getElementById('edit-nombre1')?.value.trim() || '';
            if (!nombre1) {
                this._mostrarErrorEdit('edit-nombre1',
                    'El primer nombre es obligatorio. Por favor, ingrésalo usando solo letras.');
                ok = false;
            } else if (!soloLetras.test(nombre1)) {
                this._mostrarErrorEdit('edit-nombre1',
                    'Por favor, ingresa el nombre usando solo letras (Ej: Paúl). Evita números o símbolos.');
                ok = false;
            } else { this._limpiarErrorEdit('edit-nombre1'); }

            const nombre2 = document.getElementById('edit-nombre2')?.value.trim() || '';
            if (nombre2 && !soloLetras.test(nombre2)) {
                this._mostrarErrorEdit('edit-nombre2',
                    'Por favor, ingresa el nombre usando solo letras (Ej: Andrés). Evita números o símbolos.');
                ok = false;
            } else { this._limpiarErrorEdit('edit-nombre2'); }

            const apellido1 = document.getElementById('edit-apellido1')?.value.trim() || '';
            if (!apellido1) {
                this._mostrarErrorEdit('edit-apellido1',
                    'El primer apellido es obligatorio. Por favor, ingrésalo usando solo letras.');
                ok = false;
            } else if (!soloLetras.test(apellido1)) {
                this._mostrarErrorEdit('edit-apellido1',
                    'Por favor, ingresa el apellido usando solo letras (Ej: Rosero). Evita números o símbolos.');
                ok = false;
            } else { this._limpiarErrorEdit('edit-apellido1'); }

            const apellido2 = document.getElementById('edit-apellido2')?.value.trim() || '';
            if (apellido2 && !soloLetras.test(apellido2)) {
                this._mostrarErrorEdit('edit-apellido2',
                    'Por favor, ingresa el apellido usando solo letras (Ej: Carrión). Evita números o símbolos.');
                ok = false;
            } else { this._limpiarErrorEdit('edit-apellido2'); }

            const celular = document.getElementById('edit-celular')?.value.trim() || '';
            if (!/^09\d{8}$/.test(celular)) {
                this._mostrarErrorEdit('edit-celular',
                    "El número celular debe tener 10 dígitos y empezar con '09' (Ej: 0991234567).");
                ok = false;
            } else { this._limpiarErrorEdit('edit-celular'); }

            const email = document.getElementById('edit-email')?.value.trim() || '';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                this._mostrarErrorEdit('edit-email',
                    'El formato del correo no es válido. Debe ser como: juan.perez@email.com');
                ok = false;
            } else { this._limpiarErrorEdit('edit-email'); }

            // Fecha de nacimiento (TR-13 — capa 2 anti-hack, igual que en registro)
            const fechaNac = document.getElementById('edit-fecha-nac')?.value || '';
            if (!fechaNac) {
                this._mostrarErrorEdit('edit-fecha-nac',
                    'Por favor, selecciona tu fecha de nacimiento.');
                ok = false;
            } else {
                const rangosEdit = app.obtenerRangosFecha();
                if (fechaNac > rangosEdit.hace18Anios) {
                    this._mostrarErrorEdit('edit-fecha-nac',
                        'Debes tener al menos 18 años. Verifica la fecha ingresada.');
                    ok = false;
                } else if (fechaNac < rangosEdit.hace120Anios) {
                    this._mostrarErrorEdit('edit-fecha-nac',
                        'La fecha de nacimiento no puede ser hace más de 120 años.');
                    ok = false;
                } else { this._limpiarErrorEdit('edit-fecha-nac'); }
            }

            return ok;
        },

        // ------------------------------------------------------------------
        // 11.6 Guardar cambios en localStorage
        // H3 (Control y Libertad): NO se cierra automáticamente.
        // H1 (Visibilidad del Estado): Secuencia asíncrona con simulación de latencia.
        // H5 (Prevención de Errores): disabled=true bloquea clics múltiples.
        // Patrón de Edición Continua Asíncrona — golden-rules §3 / active-design v2
        // ------------------------------------------------------------------
        guardarCambios() {
            if (!this._validarCamposEdit()) {
                // TR-48: Scroll suave + foco al primer campo inválido del perfil
                app.enfocarPrimerError('view-editar-perfil');
                return;
            }

            const raw = localStorage.getItem('usuarioActivo');
            if (!raw) { app.navegar('login'); return; }

            // ── PASO 1 — Inicio de Transacción (H5: bloqueo inmediato anti-doble clic) ──
            const btnGuardar = document.querySelector('#view-editar-perfil .btn--accion');
            if (btnGuardar) {
                btnGuardar.disabled = true;
                btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Guardando...';
            }

            // Capturar datos del formulario ANTES del timeout (cierre léxico seguro)
            const u = JSON.parse(raw);
            const val = id => document.getElementById(id)?.value.trim() || '';

            // TR-38 §2 — Bug fix: Siempre actualizar AMBAS convenciones de claves.
            // El bug anterior usaba if/else: si el objeto tenía AMBAS propiedades
            // (nombre1 Y nombre_1), solo una se actualizaba y la otra conservaba
            // el valor viejo. _rellenarFormularioEditarDesdeStorage() lee con
            // prioridad u.nombre1 → u.nombre_1, por lo que la vieja tomaba precedencia.
            // Solución: escribir las cuatro propiedades incondicionalmente.
            const n1 = val('edit-nombre1');
            const n2 = val('edit-nombre2');
            const a1 = val('edit-apellido1');
            const a2 = val('edit-apellido2');

            u.nombre1 = n1; u.nombre_1 = n1;
            u.nombre2 = n2; u.nombre_2 = n2;
            u.apellido1 = a1; u.apellido_1 = a1;
            u.apellido2 = a2; u.apellido_2 = a2;
            u.celular = val('edit-celular');
            u.email = val('edit-email');
            // H3: persistir fecha de nacimiento corregida (TR-13)
            const nuevaFecha = val('edit-fecha-nac');
            if (nuevaFecha) u.fecha_nacimiento = nuevaFecha;

            // ── PASO 2 — TR-32/TR-38: UPDATE en Supabase primero; localStorage solo si Supabase ok ──
            // TR-38: Construir las propiedades unificadas (nombres/apellidos) ANTES del
            // UPDATE, y escribirlas de vuelta en `u` para que el localStorage conserve
            // AMBAS convenciones (dividida para el form + unificada para Supabase/UI).
            const nombresCompletos = [val('edit-nombre1'), val('edit-nombre2')].filter(Boolean).join(' ');
            const apellidosCompletos = [val('edit-apellido1'), val('edit-apellido2')].filter(Boolean).join(' ');

            // Propiedades unificadas (para Supabase y para UI: modal, navbar)
            u.nombres = nombresCompletos;
            u.apellidos = apellidosCompletos;

            // ── PASO 3 — Ejecutar actualización asíncrona (800ms simulan latencia de red) ──
            setTimeout(() => {
                void (async () => {
                    const ced = u.identificacion || u.cedula;

                    // TR-38 §1: patch usa los valores unificados ya calculados sincrónicamente.
                    const patch = {
                        nombres: u.nombres,
                        apellidos: u.apellidos,
                        celular: u.celular,
                        correo: u.email,
                        fecha_nacimiento: u.fecha_nacimiento || null
                    };

                    // TR-32 §1 + TR-35: UPDATE directo a Supabase sin wrappers.
                    // Zero Silent Failures: si hay error se muestra alert() con el
                    // mensaje exacto de Supabase para diagnóstico inmediato en producción.
                    if (ced) {
                        const { error: supaError } = await supabase
                            .from('pacientes')
                            .update({
                                nombres: patch.nombres,
                                apellidos: patch.apellidos,
                                correo: patch.correo,
                                celular: patch.celular,
                                fecha_nacimiento: patch.fecha_nacimiento
                            })
                            .eq('cedula', ced);

                        if (supaError) {
                            // TR-35: Transparencia total — alertar el error exacto de Supabase.
                            alert('Error en BD: ' + supaError.message);
                            console.error('[Supabase] Actualizar perfil:', supaError);
                            if (btnGuardar) {
                                btnGuardar.disabled = false;
                                btnGuardar.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Guardar Cambios';
                            }
                            return; // ← Abortar: no tocar localStorage
                        }
                    }

                    // TR-32 §2 / TR-38 §2: Solo si Supabase respondió ok, actualizar estado local.
                    // El objeto `u` ya tiene nombres/apellidos unificados + las propiedades
                    // divididas, por lo que el formulario de edición y el modal de perfil
                    // podrán reconstruir ambas representaciones sin perder información.
                    localStorage.setItem('usuarioActivo', JSON.stringify(u));

                    const lista = JSON.parse(localStorage.getItem('sanitas_usuarios') || '[]');
                    const idx = lista.findIndex(x => x.identificacion === u.identificacion);
                    if (idx !== -1) {
                        lista[idx] = { ...lista[idx], ...u };
                        localStorage.setItem('sanitas_usuarios', JSON.stringify(lista));
                    }

                    // ── Refrescar navbar (btn-auth: "Nombre Apellido") ──
                    app.iniciarSesionUsuario();

                    // ── TR-38 §2: Refrescar DOM del modal de perfil si está abierto ──
                    // Actualiza #perfil-nombre-completo, #perfil-celular y #perfil-avatar-iniciales
                    // directamente para que el cambio sea visible sin cerrar y reabrir el modal.
                    const modalPerfil = document.getElementById('modal-perfil');
                    if (modalPerfil && modalPerfil.style.display !== 'none') {
                        const nombre1Show = u.nombre1 || u.nombre_1 || (u.nombres || '').split(/\s+/)[0] || '';
                        const elNombreModal = document.getElementById('perfil-nombre-completo');
                        if (elNombreModal) {
                            elNombreModal.textContent =
                                [u.nombres, u.apellidos].filter(Boolean).join(' ').trim() || '—';
                        }
                        const elCelularModal = document.getElementById('perfil-celular');
                        if (elCelularModal) elCelularModal.textContent = u.celular || '—';
                        const elAvatar = document.getElementById('perfil-avatar-iniciales');
                        if (elAvatar) {
                            const inicial = nombre1Show.charAt(0).toUpperCase();
                            if (inicial) elAvatar.textContent = inicial;
                        }
                    }

                    // ── TR-38 §2: Refrescar campos del formulario de edición ──
                    // Si el usuario está en perfil.html y el formulario sigue visible,
                    // actualizar los inputs para reflejar los datos guardados.
                    if (document.getElementById('edit-nombre1')) {
                        app.perfil._rellenarFormularioEditarDesdeStorage();
                    }

                    if (btnGuardar) {
                        btnGuardar.disabled = false;
                        btnGuardar.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Guardar Cambios';
                    }

                    const msg = document.getElementById('edit-success-msg');
                    if (msg) {
                        msg.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> <span>✅ Cambios guardados correctamente</span>';
                        msg.style.display = 'flex';
                        setTimeout(() => {
                            msg.style.display = 'none';
                        }, 3000);
                    }
                })();
            }, 800);
        },

        // ------------------------------------------------------------------
        // 11.7 TR-49: Gestión del Modal de Cambio de Contraseña
        // Progressive Disclosure: separado del formulario de datos personales.
        // ------------------------------------------------------------------
        abrirModalPassword() {
            const modal = document.getElementById('modal-password');
            if (!modal) return;
            // Limpiar campos y errores al abrir (privacidad + estado limpio)
            this._limpiarModalPassword();
            // Indicador de fortaleza — adjuntar una sola vez
            const passNueva = document.getElementById('pass-nueva');
            const passNuevaBar = document.getElementById('pass-nueva-strength');
            if (passNueva && passNuevaBar && !passNueva.dataset.strengthBound) {
                passNueva.dataset.strengthBound = '1';
                passNueva.addEventListener('input', () => {
                    const v = passNueva.value;
                    if (!v) { passNuevaBar.style.display = 'none'; return; }
                    passNuevaBar.style.display = 'flex';
                    const tipos = [/[A-Z]/.test(v), /[a-z]/.test(v), /[0-9]/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
                    let nivel, etiqueta, color;
                    if (v.length < 6 || tipos < 2) { nivel = 1; etiqueta = 'Débil'; color = '#e74c3c'; }
                    else if (v.length < 8 || tipos < 3) { nivel = 2; etiqueta = 'Media'; color = '#e67e22'; }
                    else { nivel = 3; etiqueta = 'Fuerte'; color = '#27ae60'; }
                    passNuevaBar.querySelector('.pass-strength__label').textContent = etiqueta;
                    passNuevaBar.querySelectorAll('.pass-strength__seg').forEach((s, i) => {
                        s.style.background = i < nivel ? color : '#e0e0e0';
                    });
                });
            }
            // ── TR-119: Enter en campos del modal confirma el cambio ─────────
            ['pass-actual', 'pass-nueva', 'pass-repetir'].forEach(id => {
                const el = document.getElementById(id);
                if (!el || el.dataset.tr119Enter === '1') return;
                el.dataset.tr119Enter = '1';
                el.addEventListener('keydown', (e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const btn = document.getElementById('btn-confirmar-password');
                    if (btn && !btn.disabled) { btn.focus(); btn.click(); }
                });
            });

            // Rellenar el hint de usuario con la cédula para el gestor de contraseñas del navegador
            try {
                const u = JSON.parse(localStorage.getItem('usuarioActivo') || '{}');
                const hint = document.getElementById('pass-username-hint');
                if (hint) hint.value = u.cedula || u.identificacion || '';
            } catch (e) {}
            modal.style.display = 'flex';
            // TR-53: ancla en historial para que Atrás nativo cierre el modal
            history.pushState({ tipo: 'modal', id: 'modal-password' }, '', '#modal');
            // Foco inicial accesible al primer input
            setTimeout(() => {
                document.getElementById('pass-actual')?.focus();
            }, 80);
        },

        cerrarModalPassword() {
            const modal = document.getElementById('modal-password');
            if (!modal) return;
            modal.style.display = 'none';
            // TR-49: Limpiar SIEMPRE los inputs al cerrar (privacidad del usuario)
            this._limpiarModalPassword();
        },

        _limpiarModalPassword() {
            ['pass-actual', 'pass-nueva', 'pass-repetir'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.value = ''; el.style.borderColor = ''; el.type = 'password'; }
            });
            const bar = document.getElementById('pass-nueva-strength');
            if (bar) bar.style.display = 'none';
            ['pass-actual', 'pass-nueva', 'pass-repetir'].forEach(id => {
                const sp = document.getElementById(`${id}-error`);
                if (sp) { sp.textContent = ''; sp.style.display = 'none'; }
            });
            const hint = document.getElementById('pass-username-hint');
            if (hint) hint.value = '';
            // Ocultar mensaje de éxito interno si quedó visible
            const ok = document.getElementById('pass-success-msg');
            if (ok) ok.style.display = 'none';
            // Restaurar iconos de ojo
            document.querySelectorAll('#modal-password .login-field__eye i').forEach(i => {
                i.className = 'fa-regular fa-eye';
            });
            // Restaurar botón Confirmar
            const btn = document.getElementById('btn-confirmar-password');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Confirmar Cambio';
            }
        },

        // Helper: mostrar/ocultar error en los campos del modal de password
        _mostrarErrorPass(campoId, msg) {
            const span = document.getElementById(`${campoId}-error`);
            const input = document.getElementById(campoId);
            if (span) { span.textContent = msg; span.style.display = 'block'; }
            if (input) {
                input.style.borderColor = '#c0392b';
                // TR-48: scroll + foco al campo erróneo
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                requestAnimationFrame(() => input.focus({ preventScroll: true }));
            }
        },

        _limpiarErrorPass(campoId) {
            const span = document.getElementById(`${campoId}-error`);
            const input = document.getElementById(campoId);
            if (span) { span.textContent = ''; span.style.display = 'none'; }
            if (input) input.style.borderColor = '';
        },

        // Helper: toggle visibilidad de los inputs de contraseña del modal
        _togglePassVis(campoId, btn) {
            const input = document.getElementById(campoId);
            if (!input) return;
            const icon = btn?.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon?.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon?.classList.replace('fa-eye-slash', 'fa-eye');
            }
        },

        // ------------------------------------------------------------------
        // 11.8 TR-49: Validar y Ejecutar Cambio de Contraseña
        // Orden estricto: vacíos → coincidencia → verificar actual en Supabase → UPDATE
        // ------------------------------------------------------------------
        async cambiarPasswordUsuario() {
            // 0. Limpiar errores previos
            ['pass-actual', 'pass-nueva', 'pass-repetir'].forEach(id => this._limpiarErrorPass(id));

            const actual = document.getElementById('pass-actual')?.value || '';
            const nueva = document.getElementById('pass-nueva')?.value || '';
            const repetir = document.getElementById('pass-repetir')?.value || '';

            // 1. Verificar que ningún campo esté vacío
            if (!actual) {
                this._mostrarErrorPass('pass-actual', 'Ingresa tu contraseña actual.');
                return;
            }
            if (!nueva) {
                this._mostrarErrorPass('pass-nueva', 'Ingresa la nueva contraseña.');
                return;
            }
            if (nueva.length < 6) {
                this._mostrarErrorPass('pass-nueva', 'La contraseña debe tener al menos 6 caracteres.');
                return;
            }
            if (nueva === actual) {
                this._mostrarErrorPass('pass-nueva', 'La nueva contraseña debe ser diferente a la actual.');
                return;
            }
            if (!repetir) {
                this._mostrarErrorPass('pass-repetir', 'Por favor, repite la nueva contraseña.');
                return;
            }

            // 2. Verificar que las contraseñas nuevas coincidan (TR-49 §3)
            if (nueva !== repetir) {
                this._mostrarErrorPass('pass-repetir', 'Las contraseñas no coinciden. Verifica e inténtalo de nuevo.');
                return;
            }

            // 3. Obtener cédula del usuario activo
            const rawUser = localStorage.getItem('usuarioActivo');
            if (!rawUser) { app.navegar('login'); return; }
            const u = JSON.parse(rawUser);
            const cedula = u.identificacion || u.cedula;
            if (!cedula) {
                this._mostrarErrorPass('pass-actual', 'No se pudo identificar la sesión. Reinicia sesión.');
                return;
            }

            // 4. Bloquear botón (anti-doble clic, H5)
            const btn = document.getElementById('btn-confirmar-password');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Verificando…';
            }

            try {
                // 5. Verificar contraseña actual contra Supabase (TR-49 §4)
                //    Se usa loginPacientePorIdentificadorYPassword que ya existe,
                //    pasando la cédula + contraseña actual. Retorna null si no coincide.
                const filaActual = await conCargaGlobal(
                    () => loginPacientePorIdentificadorYPassword(cedula, actual),
                    'Verificando contraseña…'
                );

                if (!filaActual) {
                    this._mostrarErrorPass('pass-actual', 'La contraseña actual no es correcta. Inténtalo de nuevo.');
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Confirmar Cambio';
                    }
                    return;
                }

                // 6. Contraseña actual verificada → UPDATE en Supabase (TR-49 §4)
                await conCargaGlobal(
                    () => updatePacientePorCedula(cedula, { password: nueva }),
                    'Actualizando contraseña…'
                );

                // 7. Actualizar también el localStorage para coherencia (H1)
                u.password = nueva;
                localStorage.setItem('usuarioActivo', JSON.stringify(u));

                // 8. Mostrar mensaje de éxito y cerrar modal tras 2 s (H1 §2)
                const okMsg = document.getElementById('pass-success-msg');
                if (okMsg) okMsg.style.display = 'flex';
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> ¡Actualizada!';
                }
                setTimeout(() => this.cerrarModalPassword(), 2000);

            } catch (err) {
                console.error('[TR-49] Error al cambiar contraseña:', err);
                this._mostrarErrorPass('pass-actual', 'Error de conexión. Intenta de nuevo más tarde.');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Confirmar Cambio';
                }
            }
        }
    },

    // ======================================================================
    // 12. MÓDULO SALUD — Dashboard Mis Citas / Mis Recetas,

    widgetInvitado: {
        _validadoresIniciados: false,
        /** TR-84: retiene la última cédula procesada con éxito para re-hidratarla al volver a Vista A. */
        _cedulaConsultada: '',

        /** TR-84: genera el HTML de Vista A interpolando la cédula persistida (no nace vacía). */
        _generarVistaAHTML() {
            return `
            <div id="vista-consulta-input">
                <div class="widget-invitado__icon" aria-hidden="true" style="margin-bottom: 15px; text-align: center;">
                    <i class="fa-regular fa-calendar-check" style="font-size: 2.5rem; color: #ffffff !important;"></i>
                </div>
                <h3 id="modal-consulta-invitado-title" class="modal-consulta__title" style="margin-bottom: 10px; text-align: center;">Consulta tu cita m\u00e9dica</h3>
                <p class="widget-invitado__desc" style="margin-bottom: 25px; color: var(--gray-text); text-align: center;">Ingresa tu c\u00e9dula para verificar tus citas agendadas.</p>
                <div class="widget-invitado__field" style="margin-bottom: 25px; width: 100%; text-align: left;">
                    <label for="widget-cedula" class="widget-invitado__label">C\u00e9dula</label>
                    <input type="text" id="widget-cedula" class="widget-invitado__input form-control"
                        placeholder="Ej: 1712345678" inputmode="numeric" maxlength="10" aria-required="true"
                        aria-describedby="widget-cedula-error" name="username" autocomplete="off" style="width: 100%;"
                        value="${this._cedulaConsultada || ''}">
                    <span id="widget-cedula-error" class="widget-invitado__error" role="alert"
                        style="display:none; color: #d32f2f; font-size: 0.85rem; margin-top: 5px;"></span>
                </div>
                <button type="button" id="btn-consultar-cita" class="btn btn--primario widget-invitado__btn" style="width: 100%;">
                    <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Consultar
                </button>
            </div>`;
        },

        /** TR-90: Garantiza que .hidden oculte/muestre el modal en toda la MPA. */
        _asegurarUtilidadHidden() {
            if (document.getElementById('tr90-modal-consulta-hidden-css')) return;
            const style = document.createElement('style');
            style.id = 'tr90-modal-consulta-hidden-css';
            style.textContent = [
                '#modal-consulta-invitado.hidden{display:none!important;}',
                '#modal-consulta-invitado.modal-overlay:not(.hidden){display:flex!important;align-items:center;justify-content:center;}'
            ].join('');
            document.head.appendChild(style);
        },

        /**
         * TR-90: Normaliza el shell del modal en páginas secundarias (sin modal-overlay ni botón cerrar).
         * Devuelve referencias al contenedor raíz y al body de inyección de vistas.
         */
        _normalizarShellModalMPA() {
            this._asegurarUtilidadHidden();
            const modal = document.getElementById('modal-consulta-invitado');
            if (!modal) return null;

            if (!modal.classList.contains('modal-overlay')) {
                modal.classList.add('modal-overlay', 'modal-consulta');
            }

            let body = document.getElementById('modal-consulta-invitado-body');
            const shellNormalizado = modal.querySelector('.modal-consulta__content');

            if (!shellNormalizado && body && body.parentElement === modal) {
                const contenidoPrevio = body.innerHTML;
                const wrapper = document.createElement('div');
                wrapper.className = 'modal-content modal-consulta__content';
                wrapper.style.maxWidth = '400px';
                wrapper.style.padding = '30px';

                const closeBtn = document.createElement('button');
                closeBtn.type = 'button';
                closeBtn.className = 'modal-close';
                closeBtn.setAttribute('aria-label', 'Cerrar modal');
                closeBtn.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
                closeBtn.addEventListener('click', () => this.cerrarModalConsulta());

                const nuevoBody = document.createElement('div');
                nuevoBody.id = 'modal-consulta-invitado-body';
                nuevoBody.setAttribute('role', 'region');
                nuevoBody.setAttribute('aria-live', 'polite');
                nuevoBody.innerHTML = contenidoPrevio;

                wrapper.appendChild(closeBtn);
                wrapper.appendChild(nuevoBody);
                modal.replaceChildren(wrapper);
                body = nuevoBody;
            }

            return { modal, body: document.getElementById('modal-consulta-invitado-body') };
        },

        abrirModalConsulta() {
            const shell = this._normalizarShellModalMPA();
            if (!shell || !shell.modal) return;

            const { modal, body } = shell;

            // TR-90: Hidratación forzada si el body está vacío o carece del input de captura.
            const faltaCaptura = !body
                || !body.innerHTML.trim()
                || !body.querySelector('#widget-cedula');
            if (faltaCaptura) {
                this.restaurarVistaA();
            } else {
                this._bindVistaA();
            }

            // TR-120: Sin pushState — el modal se aísla del historial para no
            // disparar popstate/irAtras() al cerrar.
            modal.classList.remove('hidden');
            modal.style.removeProperty('display');
            modal.setAttribute('aria-hidden', 'false');
        },

        cerrarModalConsulta() {
            // TR-107: sanitizar captura de cédula solo al clausurar el modal (no durante listados activos).
            const inputCedula = document.getElementById('widget-cedula');
            if (inputCedula) {
                inputCedula.value = '';
                inputCedula.classList.remove('input-error', 'input-success');
            }
            const errorCedula = document.getElementById('widget-cedula-error');
            if (errorCedula) {
                errorCedula.textContent = '';
                errorCedula.style.display = 'none';
            }

            // Limpiar cédula persistida para que la próxima apertura nazca vacía.
            this._cedulaConsultada = '';

            // TR-120: Cierre atómico — solo ocultación visual.
            // Se prohíbe history.back() para no disparar el popstate → irAtras().
            const modal = document.getElementById('modal-consulta-invitado');
            if (modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
            }
            this._resultadosActuales = [];
        },

        restaurarVistaA() {
            this._normalizarShellModalMPA();
            const body = document.getElementById('modal-consulta-invitado-body');
            if (body) {
                body.innerHTML = this._generarVistaAHTML();
                this._bindVistaA();
            }
        },

        /** TR-119: Enter en inputs del widget dispara la búsqueda principal. */
        _enlazarEnterWidgetTR119(inputEl) {
            if (!inputEl || inputEl.dataset.tr119Enter === '1') return;
            inputEl.dataset.tr119Enter = '1';
            inputEl.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const btn = document.getElementById('btn-consultar-cita');
                if (btn) { btn.focus(); btn.click(); }
            });
        },

        _bindVistaA() {
            const inputCedula = document.getElementById('widget-cedula');
            const inputCodigoCita = document.getElementById('widget-codigo-cita');
            const btnConsultar = document.getElementById('btn-consultar-cita');

            if (inputCedula) {
                inputCedula.oninput = () => {
                    inputCedula.classList.remove('input-error');
                    // No limpiar el errorSpan aquí: el sanitizador global (capture)
                    // ya limpia el valor y muestra "Carácter no permitido" via setTimeout(0).
                    // Limpiar incondicionalmente aquí cancelaría ese mensaje antes de que aparezca.
                    const errorSpan = document.getElementById('widget-cedula-error');
                    if (errorSpan && errorSpan.textContent !== 'Carácter no permitido') {
                        errorSpan.style.display = 'none';
                    }
                };
                // onkeydown = asignación idempotente: siempre sobrescribe sin depender
                // del atributo data-tr119-enter que puede viajar en el innerHTML al
                // reconstruir el shell del modal (TR-90 _normalizarShellModalMPA).
                inputCedula.onkeydown = (e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const btn = document.getElementById('btn-consultar-cita');
                    if (btn) { btn.focus(); btn.click(); }
                };
            }

            if (inputCodigoCita) {
                inputCodigoCita.onkeydown = (e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const btn = document.getElementById('btn-consultar-cita');
                    if (btn) { btn.focus(); btn.click(); }
                };
            }

            if (btnConsultar) {
                btnConsultar.onclick = () => {
                    this.consultar();
                };
            }
        },

        inicializar() {
            if (this._validadoresIniciados) return;

            this._validadoresIniciados = true;

            // TR-90: Pre-sembrar Vista A en páginas MPA cuyo modal nace con body vacío.
            const body = document.getElementById('modal-consulta-invitado-body');
            if (body && (!body.innerHTML.trim() || !body.querySelector('#vista-consulta-input'))) {
                body.innerHTML = this._generarVistaAHTML();
            }
            this._bindVistaA();

            // TR-119: Delegación de Enter al contenedor ESTABLE del modal.
            // #modal-consulta-invitado nunca se reemplaza en el DOM (solo su body
            // interior cambia con innerHTML), por lo que este listener sobrevive
            // a toda reconstrucción dinámica del contenido (TR-90 normalizarShellMPA).
            const modalEstable = document.getElementById('modal-consulta-invitado');
            if (modalEstable && !modalEstable.dataset.enterDelegated) {
                modalEstable.dataset.enterDelegated = '1';
                modalEstable.addEventListener('keydown', (e) => {
                    if (e.key !== 'Enter') return;
                    const focused = document.activeElement;
                    if (!focused || !['widget-cedula', 'widget-codigo-cita'].includes(focused.id)) return;
                    e.preventDefault();
                    const btn = document.getElementById('btn-consultar-cita');
                    if (btn) btn.focus();
                    this.consultar();
                });
            }

            // TR-85: Delegación de Eventos Inmortal en document
            document.addEventListener('click', (e) => {
                const target = e.target.closest('button, a');
                if (!target) return;

                const widget = app.widgetInvitado;
                if (!widget) return;
                
                // Lee de data-id o del estado local efímero
                const idCita = target.getAttribute('data-id') || widget._citaActivaId || (widget._citaActual && widget._citaActual.id_cita);

                if (target.classList.contains('cita-acciones__btn--modificar')) {
                    e.preventDefault(); e.stopPropagation();
                    if(idCita) widget.prepararModificacion(idCita);
                    return;
                }
                if (target.classList.contains('cita-acciones__btn--cancelar')) {
                    e.preventDefault(); e.stopPropagation();
                    if(idCita) widget.cancelarCita(idCita);
                    return;
                }
                if (target.classList.contains('btn--imprimir')) {
                    e.preventDefault(); e.stopPropagation();
                    if (!idCita || target.disabled) return;

                    // Bloquear el botón y mostrar spinner para evitar clics dobles
                    const htmlOriginalImprimir = target.innerHTML;
                    target.disabled = true;
                    target.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Preparando...';

                    // imprimirCita usa iframe.onload + setTimeout(300ms) internamente;
                    // restaurar el botón después de que el diálogo de impresión haya abierto.
                    setTimeout(() => {
                        widget.imprimirCitaInvitado(idCita);
                    }, 60);
                    setTimeout(() => {
                        target.disabled = false;
                        target.innerHTML = htmlOriginalImprimir;
                    }, 700);
                    return;
                }
                if (target.classList.contains('btn--descargar-pdf')) {
                    e.preventDefault(); e.stopPropagation();
                    if (!idCita || target.disabled) return;

                    // Bloquear el botón y mostrar spinner para evitar clics dobles
                    const htmlOriginal = target.innerHTML;
                    target.disabled = true;
                    target.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Generando PDF...';

                    // Ceder el hilo al navegador para que repinte ANTES de que jsPDF bloquee el thread
                    setTimeout(() => {
                        try {
                            widget.descargarPDFCitaInvitado(idCita);
                        } finally {
                            target.disabled = false;
                            target.innerHTML = htmlOriginal;
                        }
                    }, 60);
                    return;
                }
                if (target.classList.contains('btn--vista-c-volver')) {
                    e.preventDefault(); e.stopPropagation();
                    widget.volverAListado();
                    return;
                }
                if (target.classList.contains('btn--vista-c-finalizar')) {
                    e.preventDefault(); e.stopPropagation();
                    widget.restaurarVistaA();
                    return;
                }
            });
            console.log('[WidgetInvitado] Listener global registrado correctamente.');
            this._aplicarAutoConsultaPostAgendamiento();
        },

        /** TR-22: tras agendamiento invitado, autocompletar widget y consultar una sola vez. */
        _aplicarAutoConsultaPostAgendamiento() {
            const raw = sessionStorage.getItem(STORAGE_AUTO_CONSULTA_INVITADO);
            if (!raw) return;
            let data;
            try {
                data = JSON.parse(raw);
            } catch (_) {
                sessionStorage.removeItem(STORAGE_AUTO_CONSULTA_INVITADO);
                return;
            }

            window.setTimeout(() => {
                this.abrirModalConsulta();
                const inputCedula = document.getElementById('widget-cedula');
                if (!inputCedula) {
                    sessionStorage.removeItem(STORAGE_AUTO_CONSULTA_INVITADO);
                    return;
                }
                const ced = String(data.cedula || '').replace(/\D/g, '');
                inputCedula.value = ced;
                inputCedula.classList.remove('input-error');

                this._pendingDetailId = data.id_cita || null;
                this.consultar(true);
                sessionStorage.removeItem(STORAGE_AUTO_CONSULTA_INVITADO);
            }, 380);
        },

        consultar(isAutoConsulta = false) {
            const inputCedula = document.getElementById('widget-cedula');
            const cedula = (inputCedula?.value || '').trim();
            const errorCedula = document.getElementById('widget-cedula-error');
            let valido = true;

            if (inputCedula) inputCedula.classList.remove('input-error', 'input-success');
            if (errorCedula) { errorCedula.textContent = ''; errorCedula.style.display = 'none'; }

            if (!cedula) {
                if (errorCedula) { errorCedula.textContent = 'Por favor, ingrese su número de cédula.'; errorCedula.style.display = 'block'; }
                inputCedula?.classList.add('input-error');
                valido = false;
            } else if (cedula.length !== 10 || !/^\d{10}$/.test(cedula) || (app.citas && !app.citas.validarCedulaEcuatoriana(cedula))) {
                if (errorCedula) { errorCedula.textContent = 'La cédula debe contener 10 dígitos válidos.'; errorCedula.style.display = 'block'; }
                inputCedula?.classList.add('input-error');
                valido = false;
            }

            if (!valido) return;

            void (async () => {
                let resultados = [];
                try {
                    await conCargaGlobal(async () => {
                        // Código corregido y limpio:
                        resultados = await fetchCitasMiSaludPorCedula(cedula);
                    }, 'Buscando citas...');
                } catch (err) {
                    console.error('[TR-82] widgetInvitado.consultar Supabase:', err?.message || err);
                    const body = document.getElementById('modal-consulta-invitado-body');
                    if (body) {
                        body.innerHTML = `
                            <div style="text-align:center;padding:20px;">
                                <i class="fa-solid fa-triangle-exclamation fa-2x" style="color:#c0392b;margin-bottom:12px;"></i>
                                <h3 style="margin-bottom: 10px;">Error de conexión</h3>
                                <p>No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.</p>
                                <button type="button" class="btn btn--secundario" style="margin-top: 15px;" onclick="app.widgetInvitado.restaurarVistaA()">Volver</button>
                            </div>`;
                    }
                    return;
                }

                const body = document.getElementById('modal-consulta-invitado-body');
                if (!body) return;
                
                body.innerHTML = '';

                if (resultados.length === 0) {
                    body.innerHTML = `
                        <div style="text-align: center; padding: 20px;">
                            <i class="fa-regular fa-calendar-xmark fa-3x" style="color: var(--gray-text); margin-bottom: 15px;"></i>
                            <h3 style="margin-bottom: 10px;">No se encontraron citas</h3>
                            <p style="color: var(--gray-text); font-size: 0.9rem;">No hay citas futuras registradas para la cédula ingresada.</p>
                            <button type="button" class="btn btn--primario" style="margin-top: 20px; width: 100%;" onclick="app.widgetInvitado.restaurarVistaA()">Intentar con otra cédula</button>
                        </div>
                    `;
                    return;
                }

                this._resultadosActuales = resultados;
                // TR-84: persiste la cédula procesada con éxito para rehidratarla al volver a Vista A
                this._cedulaConsultada = cedula;

                if (resultados.length === 1 || isAutoConsulta) {
                    const citaAMostrar = isAutoConsulta && this._pendingDetailId
                        ? resultados.find(c => String(c.id_cita) === String(this._pendingDetailId)) || resultados[0]
                        : resultados[0];
                    // TR-85: Guardar el estado de la cita antes de pintar Vista C
                    this._citaActivaId = citaAMostrar.id_cita;
                    body.innerHTML = this._renderVistaC(citaAMostrar, false);
                } else {
                    body.innerHTML = this._renderVistaB(resultados);
                }

                this._pendingDetailId = null;
            })();
        },

        /**
         * TR-94: genera el HTML de Vista C sin atributos onclick embebidos.
         * El binding de eventos se realiza programáticamente en _bindVistaC().
         */
        _renderVistaC(cita, mostrarVolver) {
            const fechaFmt = /^\d{4}-\d{2}-\d{2}$/.test(cita.fecha) ? cita.fecha.split('-').reverse().join('/') : cita.fecha;
            const idCitaEstable = cita.id_cita || '';
            const esCancelada = cita.estado === 'Cancelada';
            const _fechaCitaVistaC = (() => {
                const horaC = cita.hora ? String(cita.hora).slice(0, 5) : '00:00';
                const isoC = cita.fecha && /^\d{4}-\d{2}-\d{2}$/.test(cita.fecha) ? `${cita.fecha}T${horaC}` : null;
                return isoC ? new Date(isoC) : null;
            })();
            const esCompletadaVistaC = !esCancelada && _fechaCitaVistaC && _fechaCitaVistaC < new Date();
            const estadoBadge = esCancelada
                ? '<span class="cita-estado-badge cita-estado-badge--cancelada">Cancelada</span>'
                : esCompletadaVistaC
                    ? '<span class="cita-estado-badge cita-estado-badge--completada">Completada</span>'
                    : '<span class="cita-estado-badge cita-estado-badge--activa">Activa</span>';

            let html = `
                <div style="text-align: center; margin-bottom: 20px;">
                    <div class="modal-consulta__icon" aria-hidden="true">
                        <i class="fa-solid fa-calendar-check" style="font-size: 2.5rem; color: #ffffff !important;"></i>
                    </div>
                    <h3 class="modal-consulta__title" style="margin-top: 10px;">Detalle de tu Cita</h3>
                </div>
                <div class="modal-consulta__row">
                    <span class="modal-consulta__label"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Estado</span>
                    <span class="modal-consulta__val">${estadoBadge}</span>
                </div>
                <div class="modal-consulta__row">
                    <span class="modal-consulta__label"><i class="fa-regular fa-calendar" aria-hidden="true"></i> Fecha</span>
                    <span class="modal-consulta__val">${escapeHtmlWidget(fechaFmt || '\u2014')}</span>
                </div>
                <div class="modal-consulta__row">
                    <span class="modal-consulta__label"><i class="fa-regular fa-clock" aria-hidden="true"></i> Hora</span>
                    <span class="modal-consulta__val">${escapeHtmlWidget(cita.hora || '\u2014')}</span>
                </div>
                <div class="modal-consulta__row">
                    <span class="modal-consulta__label"><i class="fa-solid fa-stethoscope" aria-hidden="true"></i> Especialidad</span>
                    <span class="modal-consulta__val">${escapeHtmlWidget(cita.especialidad || 'No especificado')}</span>
                </div>
                <div class="modal-consulta__row">
                    <span class="modal-consulta__label"><i class="fa-solid fa-user-doctor" aria-hidden="true"></i> M\u00e9dico</span>
                    <span class="modal-consulta__val">${escapeHtmlWidget(cita.medico || 'No especificado')}</span>
                </div>
                <div class="modal-consulta__row">
                    <span class="modal-consulta__label"><i class="fa-solid fa-user" aria-hidden="true"></i> Paciente</span>
                    <span class="modal-consulta__val">${escapeHtmlWidget(cita.paciente || cita.nombres || 'No especificado')}</span>
                </div>`;

            const horaWidgetStr = cita.hora ? String(cita.hora).slice(0, 5) : '00:00';
            const fechaCitaWidgetISO = cita.fecha && /^\d{4}-\d{2}-\d{2}$/.test(cita.fecha) ? `${cita.fecha}T${horaWidgetStr}` : null;
            const fechaCitaWidgetMs = fechaCitaWidgetISO ? new Date(fechaCitaWidgetISO).getTime() : NaN;
            const horasRestantesWidget = isNaN(fechaCitaWidgetMs) ? Infinity : (fechaCitaWidgetMs - Date.now()) / (1000 * 60 * 60);
            const bloqueadoPor24hWidget = !esCancelada && horasRestantesWidget < 24;

            if (!esCancelada && idCitaEstable) {
                if (bloqueadoPor24hWidget) {
                    html += `<p class="cita-aviso-24h" role="alert" style="font-size:0.85rem;color:#c0392b;margin:12px 0 8px;display:flex;align-items:center;gap:6px;">
                                <i class="fa-solid fa-clock" aria-hidden="true"></i>
                                Ya no es posible modificar o cancelar esta cita (menos de 24 horas).
                            </p>`;
                } else {
                    html += `<div class="cita-acciones" role="group" aria-label="Acciones de cita">
                                <button type="button" class="cita-acciones__btn cita-acciones__btn--modificar" data-id="${idCitaEstable}" onclick="app.widgetInvitado.prepararModificacion('${idCitaEstable}')">
                                    <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Cambiar Fecha/Hora
                                </button>
                                <button type="button" class="cita-acciones__btn cita-acciones__btn--cancelar" data-id="${idCitaEstable}" onclick="app.widgetInvitado.cancelarCita('${idCitaEstable}')">
                                    <i class="fa-solid fa-ban" aria-hidden="true"></i> Cancelar Cita
                                </button>
                            </div>`;
                }
            }

            if (!esCancelada) {
                html += `<div class="cita-docs" style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
                            <button class="btn btn--documento btn--imprimir" data-id="${idCitaEstable}" type="button">
                                <i class="fa-solid fa-print" aria-hidden="true"></i> Imprimir
                            </button>
                            <button class="btn btn--documento btn--descargar-pdf" data-id="${idCitaEstable}" type="button">
                                <i class="fa-solid fa-file-pdf" aria-hidden="true"></i> Descargar PDF
                            </button>
                        </div>`;
            }

            if (mostrarVolver) {
                html += `<button type="button" class="modal-consulta__btn-volver" onclick="app.widgetInvitado.volverAListado()" style="margin-top: 20px; width: 100%;">
                            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Volver al listado
                        </button>`;
            } else {
                html += `<button type="button" class="modal-consulta__btn-volver btn--vista-c-volver" onclick="app.widgetInvitado.volverAListado()" style="margin-top: 20px; width: 100%;">
                            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Volver al listado
                        </button>`;
            }

            return html;
        },

        _renderVistaB(citas) {
            // TR-84: encabezado de la vista B
            let html = `<div style="text-align: center; margin-bottom: 20px;">
                <h3 class="modal-consulta__title">Se encontraron ${citas.length} citas</h3>
                <p style="color: var(--gray-text); font-size: 0.9rem;">Selecciona una para ver el detalle</p>
            </div>`;

            const listaHTML = citas.map((c, index) => {
                const fechaFormat = /^\d{4}-\d{2}-\d{2}$/.test(c.fecha) ? c.fecha.split('-').reverse().join('/') : c.fecha;
                const horaLabel = escapeHtmlWidget(`${fechaFormat} - ${c.hora || 'Sin hora'}`);
                const espLabel = escapeHtmlWidget(c.especialidad || 'No especificado');
                const medicoLabel = escapeHtmlWidget(c.medico || 'No especificado');
                const pacienteLine = `<p class="cita-card__paciente" style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden;"><strong>Paciente:</strong> ${escapeHtmlWidget(c.paciente || c.nombres || 'No especificado')}</p>`;

                return `
                <div class="salud-item modal-consulta__item-lista" role="listitem" tabindex="0"
                     onclick="app.widgetInvitado.verDetalle(${index})"
                     onkeydown="if(event.key==='Enter')app.widgetInvitado.verDetalle(${index})">
                    <div class="salud-item__info" style="min-width: 0; flex: 1;">
                        <strong class="salud-item__nombre" style="display: block; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${medicoLabel}</strong>
                        <span class="salud-item__sub" style="display: block; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${espLabel}</span>
                        ${pacienteLine}
                        <span class="salud-item__fecha" style="display: block; margin-top: 4px;">${horaLabel}</span>
                    </div>
                    <i class="fa-solid fa-chevron-right salud-item__arrow" aria-hidden="true"></i>
                </div>`;
            }).join('');

            // TR-84: contenedor con scroll ergonómico para listados volumétricos (evita desbordamiento del viewport)
            html += `<div style="max-height: 360px; overflow-y: auto; box-sizing: border-box; padding-right: 5px;">${listaHTML}</div>`;
            html += `<button type="button" class="btn btn--secundario" onclick="app.widgetInvitado.restaurarVistaA()" style="margin-top: 20px; width: 100%;">Volver</button>`;

            return html;
        },

        verDetalle(index) {
            const cita = this._resultadosActuales[index];
            if (!cita) return;
            const body = document.getElementById('modal-consulta-invitado-body');
            // TR-85: Guardar cita activa antes de inyectar HTML
            this._citaActivaId = cita.id_cita;
            if (body) {
                body.innerHTML = this._renderVistaC(cita, true);
                requestAnimationFrame(() => body.scrollIntoView({ behavior: 'smooth', block: 'start' }));
            }
        },

        volverAListado() {
            const body = document.getElementById('modal-consulta-invitado-body');
            if (body) body.innerHTML = this._renderVistaB(this._resultadosActuales);
        },

        cerrarModal() {
            this.cerrarModalConsulta();
        },

        cancelarCita(idStr) {
            console.log('Iniciando proceso de cancelación para:', idStr);
            const ejecutarCancelacion = async (cancelId) => {
                const cita = this._buscarCitaInvitado(cancelId || idStr);
                if (!cita) {
                    console.warn('[WidgetInvitado] No se encontró la cita para cancelar:', cancelId || idStr);
                    return;
                }

                const citasPublicas = JSON.parse(localStorage.getItem('sanitas_citas') || '[]');
                let indexEnPublicas = citasPublicas.findIndex(c => c.id_cita === cita.id_cita || c.id === cita.id_cita || c.id_cita === idStr || c.id === idStr);
                if (indexEnPublicas === -1) {
                    indexEnPublicas = citasPublicas.findIndex(c => c.cedula === cita.cedula && c.medico === cita.medico && c.hora === cita.hora && c.fecha === cita.fecha);
                }
                if (indexEnPublicas === -1) {
                    citasPublicas.push({ ...cita, estado: 'Cancelada' });
                    indexEnPublicas = citasPublicas.length - 1;
                }

                citasPublicas[indexEnPublicas].estado = 'Cancelada';
                localStorage.setItem('sanitas_citas', JSON.stringify(citasPublicas));
                const citaActualizada = citasPublicas[indexEnPublicas];
                cita.estado = 'Cancelada';
                await app._sincronizarCancelacion(citaActualizada);

                if (Array.isArray(this._resultadosActuales)) {
                    const idxLocal = this._resultadosActuales.findIndex(r => r.id_cita === cita.id_cita || r.id === cita.id_cita || (r.cedula === cita.cedula && r.fecha === cita.fecha && r.hora === cita.hora));
                    if (idxLocal !== -1) this._resultadosActuales[idxLocal].estado = 'Cancelada';
                }

                const body = document.getElementById('modal-consulta-invitado-body');
                this._citaActivaId = cita.id_cita;
                if (body) body.innerHTML = this._renderVistaC(cita, Array.isArray(this._resultadosActuales) && this._resultadosActuales.length > 1);
            };

            if (typeof window.app?.citas?.mostrarConfirmacionCancelacion === 'function') {
                // Invocar directamente sobre el objeto para preservar el `this` correcto del módulo citas
                window.app.citas.mostrarConfirmacionCancelacion(idStr, (idCancelado) => {
                    return ejecutarCancelacion(idCancelado || idStr);
                });
                return;
            }

            // Fallback de seguridad (no debería alcanzarse en producción)
            if (window.confirm('¿Estás seguro de que deseas cancelar esta cita?')) {
                void ejecutarCancelacion(idStr);
            }
        },

        prepararModificacion(idStr) {
            const cita = this._buscarCitaInvitado(idStr);
            if (!cita) return;

            const citasPublicas = JSON.parse(localStorage.getItem('sanitas_citas') || '[]');
            let indexEnPublicas = citasPublicas.findIndex(c => c.id_cita === idStr || c.id === idStr);
            if (indexEnPublicas === -1) {
                indexEnPublicas = citasPublicas.findIndex(c => c.cedula === cita.cedula && c.medico === cita.medico && c.hora === cita.hora && c.fecha === cita.fecha);
            }
            if (indexEnPublicas === -1) {
                citasPublicas.push(cita);
                indexEnPublicas = citasPublicas.length - 1;
                localStorage.setItem('sanitas_citas', JSON.stringify(citasPublicas));
            }

            const citaActualizada = citasPublicas[indexEnPublicas];

            // TR-86: Persistencia de Contexto Operativo — almacenar toda la identidad
            // del paciente original para que el Smart Jump la recupere sin tocar el DOM.
            sessionStorage.setItem('cita_modificacion', JSON.stringify({
                id_cita:          cita.id_cita,
                indexPublicas:    indexEnPublicas,
                medico:           cita.medico,
                especialidad:     cita.especialidad,
                cedula:           cita.cedula || cita.cedula_paciente || '',
                cedula_paciente:  cita.cedula_paciente || cita.cedula || '',
                paciente:         cita.paciente || '',
                id_especialista:  cita.id_especialista ?? null,
                origen:           'widget',
                fechaVieja:       cita.fecha,
                horaVieja:        cita.hora,
                // TR-86: flag maestro del modo modificación
                modoModificacion: true
            }));

            sessionStorage.setItem('reservaCita_preseleccion', JSON.stringify({
                medico:         cita.medico,
                especialidad:   cita.especialidad,
                id_especialista: cita.id_especialista ?? null
            }));
            sessionStorage.setItem('especialidad_seleccionada', cita.especialidad);

            this.cerrarModalConsulta();
            sessionStorage.removeItem(STORAGE_CITA_EN_PROGRESO);
            sessionStorage.removeItem(STORAGE_CITA_POST_LOGIN);

            // Si el usuario ya está en citas.html, navegar() no actúa (mismo pathname).
            // En ese caso iniciamos el flujo directamente sin recargar la página.
            if (document.getElementById('view-citas') && typeof app.citas?.iniciarFlujo === 'function') {
                void app.citas.iniciarFlujo();
            } else {
                app.navegar('citas');
            }
        },

        _normalizarCitaInvitado(idStr) {
            const cita = this._buscarCitaInvitado(idStr);
            if (!cita) return null;

            if (!cita.paciente) {
                const misCitas = JSON.parse(localStorage.getItem('sanitas_mis_citas') || '[]');
                const citaCompleta = misCitas.find(mc => mc.id_cita === cita.id_cita || mc.id === cita.id_cita);
                if (citaCompleta && citaCompleta.paciente) {
                    cita.paciente = citaCompleta.paciente;
                } else {
                    const usuarios = JSON.parse(localStorage.getItem('sanitas_usuarios') || '[]');
                    const usuario = usuarios.find(u => u.identificacion === cita.cedula);
                    if (usuario) {
                        const n1 = (usuario.nombre_1 || usuario.nombre1 || (usuario.nombres || '').split(/\s+/)[0] || '').trim();
                        const n2 = (usuario.nombre_2 || usuario.nombre2 || (usuario.nombres || '').split(/\s+/).slice(1).join(' ') || '').trim();
                        const a1 = (usuario.apellido_1 || usuario.apellido1 || (usuario.apellidos || '').split(/\s+/)[0] || '').trim();
                        const a2 = (usuario.apellido_2 || usuario.apellido2 || (usuario.apellidos || '').split(/\s+/).slice(1).join(' ') || '').trim();
                        cita.paciente = [n1, n2, a1, a2].filter(Boolean).join(' ') || 'Paciente no especificado';
                    } else {
                        cita.paciente = 'Paciente no especificado';
                    }
                }
            }
            return cita;
        },

        _buscarCitaInvitado(idStr) {
            const parseId = String(idStr || '').trim();
            const citasPublicas = JSON.parse(localStorage.getItem('sanitas_citas') || '[]');
            const misCitas = JSON.parse(localStorage.getItem('sanitas_mis_citas') || '[]');

            let cita = citasPublicas.find(c => c.id_cita === parseId || c.id === parseId || c.codigo === parseId);
            if (!cita && Array.isArray(this._resultadosActuales)) {
                cita = this._resultadosActuales.find(c => c.id_cita === parseId || c.id === parseId || c.codigo === parseId);
            }
            if (!cita) {
                cita = misCitas.find(c => c.id_cita === parseId || c.id === parseId || c.codigo === parseId);
            }
            if (!cita && !isNaN(parseInt(parseId, 10))) {
                const idx = parseInt(parseId, 10);
                if (idx >= 0) {
                    if (!cita && idx < citasPublicas.length) cita = citasPublicas[idx];
                    if (!cita && Array.isArray(this._resultadosActuales) && idx < this._resultadosActuales.length) cita = this._resultadosActuales[idx];
                    if (!cita && idx < misCitas.length) cita = misCitas[idx];
                }
            }
            return cita || null;
        },

        imprimirCitaInvitado(idStr) {
            const cita = this._normalizarCitaInvitado(idStr);
            if (!cita) return;
            app.utilidades.imprimirCita(cita);
        },

        descargarPDFCitaInvitado(idStr) {
            const cita = this._normalizarCitaInvitado(idStr);
            if (!cita) return;
            app.utilidades.descargarPDFCita(cita);
        }
    }

};

app.citas = createCitas();
app.salud = salud;
app.utilidades = utilidades;

document.addEventListener('DOMContentLoaded', () => {
    void app.init();
});
window.app = app;
