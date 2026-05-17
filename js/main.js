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
    existePacienteConCedula,
    existePacienteConCorreo
} from './modulos/supabaseServicio.js';

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
            '.citas-error-msg[style*="block"], '     +
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
            if (carteraEspecialistasCacheValida()) {
                fetchEspecialistasSupabase()
                    .then((lista) => {
                        if (lista.length) mergeCarteraEnSanitasFamDb(lista);
                    })
                    .catch((err) => {
                        console.warn('[Supabase] Refresco en segundo plano de especialistas no disponible.', err);
                    });
            } else {
                await conCargaGlobal(async () => {
                    const lista = await fetchEspecialistasSupabase();
                    if (lista.length) mergeCarteraEnSanitasFamDb(lista);
                }, 'Cargando especialistas…');
            }
        } catch (err) {
            console.warn('[Supabase] Especialistas no disponibles; se usa caché local (data.js).', err);
        }

        this.iniciarMenuMovil();

        if (document.querySelector('.hero__carousel')) {
            this.iniciarCarrusel();
        }
        if (document.getElementById('doctors-carousel')) {
            this.iniciarCarruselEspecialistas();
            this.renderizarEspecialidadesHome();
        }

        this.iniciarSesionUsuario();

        if (document.getElementById('widget-invitado')) {
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

        // TR-13: Titulares de cuenta → mínimo 18 años, máximo 120 años
        // new Date(año, mes, día) maneja años bisiestos de forma nativa.
        const minNac = new Date(hoy.getFullYear() - 120, hoy.getMonth(), hoy.getDate());
        const hace120Anios = minNac.toISOString().split('T')[0];

        const maxNac = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate());
        const hace18Anios = maxNac.toISOString().split('T')[0];

        // Alias de compatibilidad para código anterior que usaba 'hace90Anios'
        const hace90Anios = hace120Anios;

        return { hoy: fechaHoy, en2Meses, hace120Anios, hace90Anios, hace18Anios };
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
                try {
                    const userActivo = JSON.parse(localStorage.getItem('usuarioActivo'));
                    if (userActivo) {
                        const nom1 = (userActivo.nombre1 || userActivo.nombre_1 || (userActivo.nombres || '').split(/\s+/)[0] || '').trim();
                        const ape1 = (userActivo.apellido1 || userActivo.apellido_1 || (userActivo.apellidos || '').split(/\s+/)[0] || '').trim();
                        if (nom1) {
                            nombreMostrar = ape1 ? `${nom1} ${ape1}` : nom1;
                            if (nombreMostrar.length > 22) nombreMostrar = nombreMostrar.substring(0, 20) + '…';
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

            nuevoBtnAuth.addEventListener('click', (e) => {
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
                        window.location.href = 'login.html';
                    }
                }
            });
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

        // TR-25: el widget nace oculto en index.html; solo mostrarlo si no hay sesión (evita parpadeo al estar logueado).
        const widgetInvitado = document.getElementById('widget-invitado');
        if (widgetInvitado) {
            if (usuarioLogueado === 'true') {
                widgetInvitado.style.display = 'none';
            } else {
                widgetInvitado.style.display = 'block';
            }
        }
    },

    iniciarMenuMovil: function () {
        const menuToggle = document.querySelector('.header__menu-toggle');
        const mainMenu = document.getElementById('main-menu');

        if (menuToggle && mainMenu) {
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
            if (app.citas) app.citas.modoProxy = false;
            if (app.citas && typeof app.citas.limpiarSessionFlujoCitas === 'function') {
                app.citas.limpiarSessionFlujoCitas(true);
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
            home:           '.hero__title',
            citas:          '#view-citas h2, #view-citas h3',
            especialistas:  '#view-especialistas h2',
            farmacia:       '#farmacia-heading',
            contacto:       '#contacto-heading',
            login:          '#login-heading',
            registro:       '#registro-heading',
            'mi-salud':     '#mi-salud-heading',
            'editar-perfil':'#editar-perfil-heading',
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
            // Fallback: ocultar directamente
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
            const last  = focusables[focusables.length - 1];

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
        if (!grid || !prevBtn || !nextBtn) return;

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

        // Mapa de imágenes representativas por especialidad (Unsplash reales y enfocadas)
        const imagenesEspecialidad = {
            "MEDICINA FAMILIAR": "https://images.pexels.com/photos/7579831/pexels-photo-7579831.jpeg?auto=compress&cs=tinysrgb&w=600",
            "MEDICINA GENERAL": "https://images.pexels.com/photos/40568/medical-appointment-doctor-healthcare-40568.jpeg?auto=compress&cs=tinysrgb&w=600",
            "RADIODIÁGNOSTICO": "https://images.pexels.com/photos/3825527/pexels-photo-3825527.jpeg?auto=compress&cs=tinysrgb&w=600",
            "DERMATOLOGÍA": "https://images.pexels.com/photos/3762871/pexels-photo-3762871.jpeg?auto=compress&cs=tinysrgb&w=600",
            "UROLOGÍA": "https://images.pexels.com/photos/6627663/pexels-photo-6627663.jpeg?auto=compress&cs=tinysrgb&w=600",
            "ENDOCRINOLOGÍA": "https://images.pexels.com/photos/6940861/pexels-photo-6940861.jpeg?auto=compress&cs=tinysrgb&w=600",
            "TRAUMATOLOGÍA": "https://images.pexels.com/photos/5473182/pexels-photo-5473182.jpeg?auto=compress&cs=tinysrgb&w=600", // Sesión de fisioterapia y rehabilitación
            "PSICOLOGÍA": "https://images.pexels.com/photos/5699419/pexels-photo-5699419.jpeg?auto=compress&cs=tinysrgb&w=600",
            "ODONTOLOGÍA": "https://images.pexels.com/photos/3845806/pexels-photo-3845806.jpeg?auto=compress&cs=tinysrgb&w=600",
            "ENFERMERÍA": "https://images.pexels.com/photos/339620/pexels-photo-339620.jpeg?auto=compress&cs=tinysrgb&w=600",
            "LABORATORIO": "https://images.pexels.com/photos/2280571/pexels-photo-2280571.jpeg?auto=compress&cs=tinysrgb&w=600",
            "GINECOLOGÍA": "https://images.pexels.com/photos/3845129/pexels-photo-3845129.jpeg?auto=compress&cs=tinysrgb&w=600" // Doctora revisando vientre/ecografía
        };

        // 3. Generar HTML Dinámicamente
        let html = '';
        especialidadesUnicas.forEach(esp => {
            const imagen = imagenesEspecialidad[esp] || "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=500&q=80"; // Imagen por defecto

            html += `
                <article class="doctor-card" onclick="app.seleccionarEspecialidad('${esp}')" style="cursor: pointer;" title="Ver especialistas en ${esp}">
                    <div class="doctor-card__img-container" style="position: relative; height: 200px;">
                        <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(59, 73, 163, 0.9), rgba(59, 73, 163, 0.3)); z-index: 1;"></div>
                        <img src="${imagen}" alt="${esp}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;">
                        <h3 style="position: absolute; bottom: 20px; left: 20px; color: #ffffff; z-index: 2; margin: 0; font-size: 1.2rem; font-weight: 700;">${esp}</h3>
                    </div>
                    <div class="doctor-card__content">
                        <div class="doctor-card__actions" style="margin-top: 15px;">
                            <span class="btn btn--secundario" aria-label="Ver especialistas en ${esp}">
                                <i class="fa-solid fa-calendar-check" aria-hidden="true"></i> Agendar Cita
                            </span>
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
        // Vaciamos la memoria de citas anteriores (El mata-fantasmas)
        sessionStorage.removeItem('reservaCita_preseleccion');
        sessionStorage.removeItem('especialidad_seleccionada');
        sessionStorage.removeItem(STORAGE_CITA_EN_PROGRESO);
        sessionStorage.removeItem(STORAGE_CITA_POST_LOGIN);
        this.navegar('citas');
    },

    // CORRECCIÓN: Para cuando hacen clic en el carrusel de especialidades
    seleccionarEspecialidad: function (especialidad) {
        // Limpiamos al médico anterior, pero guardamos la nueva especialidad
        sessionStorage.removeItem('reservaCita_preseleccion');
        sessionStorage.setItem('especialidad_seleccionada', especialidad);
        sessionStorage.removeItem(STORAGE_CITA_EN_PROGRESO);
        sessionStorage.removeItem(STORAGE_CITA_POST_LOGIN);
        this.navegar('citas');
    },

    // ======================================================================
    // 6. LÓGICA DE CITAS (3 Pasos, Validaciones, Módulo 10)
    // ======================================================================,

    directorio: {
        medicosCache: [],

        inicializar() {
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

                // Bloque A – Sanitización en tiempo real (Regex Whitelist)
                // Solo permite letras (incluye tildes y ñ) y espacios. Borra números y símbolos al instante.
                buscador.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
                });
            }

            // Modal overlay click (Cerrar)
            const modalOverlay = document.getElementById('modal-especialista');
            if (modalOverlay) {
                modalOverlay.addEventListener('click', (e) => {
                    if (e.target === modalOverlay) {
                        this.cerrarModal();
                    }
                });
            }

            // Botón X modal
            const closeBtn = document.getElementById('modal-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.cerrarModal());
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

        renderizarTarjetas(listaMedicos) {
            const grid = document.getElementById('specialists-directory-grid');
            if (!grid) return;

            grid.innerHTML = '';

            if (listaMedicos.length === 0) {
                grid.innerHTML = '<p style="text-align:center; color:#888; grid-column: 1/-1;">No se encontraron médicos con ese criterio.</p>';
                return;
            }

            // Asignación de imágenes (Dra Verónica u genéricas Unsplash)
            // Para asegurar la heurística de consistencia y la foto guardada en assets/img
            listaMedicos.forEach(med => {
                const nombreMed = med.doctor.nombre_completo || '';
                let imagenSrc = med.imagen_url;

                if (nombreMed.toLowerCase().includes('verónica') && nombreMed.toLowerCase().includes('barahona')) {
                    imagenSrc = 'assets/img/veronica-barahona.jpg'; // Imagen específica guardada localmente
                } else if (!imagenSrc) {
                    const espLower = med.especialidad.toLowerCase();
                    if (espLower.includes('medicina familiar') || espLower.includes('medico familiar'))
                        imagenSrc = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&q=80';
                    else if (espLower.includes('medicina general') || espLower.includes('general'))
                        imagenSrc = 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?q=80';
                    else if (espLower.includes('pediatr'))
                        imagenSrc = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&q=80';
                    else if (espLower.includes('odontolog'))
                        imagenSrc = 'https://images.unsplash.com/photo-1681939282781-341ac4f61996?q=80';
                    else if (espLower.includes('ginec')) {
                        if (nombreMed.toLowerCase().includes('marcela') && nombreMed.toLowerCase().includes('pantoja')) {
                            imagenSrc = 'https://images.unsplash.com/photo-1713865467253-ce0ac8477d34?q=80';
                        } else {
                            imagenSrc = 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?q=80';
                        }
                    }
                    else if (espLower.includes('dermatol'))
                        imagenSrc = 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80';
                    else if (espLower.includes('radiolog') || espLower.includes('radiodiagn'))
                        imagenSrc = 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&q=80';
                    else if (espLower.includes('urolog'))
                        imagenSrc = 'https://images.unsplash.com/photo-1637059824899-a441006a6875?q=80';
                    else if (espLower.includes('endocrin'))
                        imagenSrc = 'https://images.unsplash.com/photo-1758691463582-11aea602cd4a?q=80';
                    else if (espLower.includes('traumat') || espLower.includes('ortoped'))
                        imagenSrc = 'https://images.unsplash.com/photo-1712215544003-af10130f8eb3?q=80';
                    else if (espLower.includes('psicolog'))
                        imagenSrc = 'https://plus.unsplash.com/premium_photo-1661580574627-9211124e5c3f?q=80';
                    else if (espLower.includes('enfermer'))
                        imagenSrc = 'https://plus.unsplash.com/premium_photo-1681996359725-06262b082c27?q=80';
                    else if (espLower.includes('laboratorio'))
                        imagenSrc = 'https://plus.unsplash.com/premium_photo-1682089874677-3eee554feb19?w=600';
                    else
                        imagenSrc = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80'; // fallback genérico
                }

                const card = document.createElement('article');
                card.className = 'directory-card';
                card.innerHTML = `  
                    <img src="${imagenSrc}" alt="${nombreMed}" class="directory-card__img" tabindex="0" loading="lazy">
                    <h3 class="directory-card__name">${nombreMed}</h3>
                    <p class="directory-card__specialty">${med.especialidad}</p>
                    <button class="btn btn--secundario directory-card__link" aria-label="Ver perfil de ${nombreMed}">Ver perfil y servicios</button>
                    <button class="btn btn--primario directory-card__btn" style=" color: #fff; font-weight: bold;">
                        <i class="fa-regular fa-calendar-check" style="margin-right: 8px;"></i> Agendar Cita
                    </button>
                `;

                // Eventos
                const img = card.querySelector('.directory-card__img');
                const linkVerPerfil = card.querySelector('.directory-card__link');
                const btnAgendar = card.querySelector('.directory-card__btn');

                const abrirModalClick = () => this.abrirModal(med);
                img.addEventListener('click', abrirModalClick);
                img.addEventListener('keydown', (e) => { if (e.key === 'Enter') abrirModalClick(); });
                linkVerPerfil.addEventListener('click', abrirModalClick);

                btnAgendar.addEventListener('click', () => {
                    sessionStorage.setItem('especialidad_seleccionada', med.especialidad);
                    sessionStorage.setItem('reservaCita_preseleccion', JSON.stringify({
                        medico: nombreMed,
                        especialidad: med.especialidad
                    }));
                    sessionStorage.removeItem(STORAGE_CITA_EN_PROGRESO);
                    sessionStorage.removeItem(STORAGE_CITA_POST_LOGIN);
                    app.navegar('citas');
                });

                grid.appendChild(card);
            });
        },

        abrirModal(medico) {
            document.getElementById('modal-doc-name').textContent = medico.doctor.nombre_completo || 'Médico';
            document.getElementById('modal-doc-specialty').textContent = medico.especialidad || '';

            // Imagen del Modal
            const imgModal = document.getElementById('modal-doc-img');
            const nombreMed = medico.doctor.nombre_completo || '';
            let imagenSrc = medico.imagen_url;

            if (nombreMed.toLowerCase().includes('verónica') && nombreMed.toLowerCase().includes('barahona')) {
                imagenSrc = 'assets/img/veronica-barahona.jpg'; // Imagen específica guardada localmente
            } else if (!imagenSrc) {
                const espLower = medico.especialidad.toLowerCase(); // <-- CORREGIDO: "medico", no "med"
                if (espLower.includes('medicina familiar') || espLower.includes('medico familiar'))
                    imagenSrc = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&q=80';
                else if (espLower.includes('medicina general') || espLower.includes('general'))
                    imagenSrc = 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?q=80';
                else if (espLower.includes('pediatr'))
                    imagenSrc = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&q=80';
                else if (espLower.includes('odontolog'))
                    imagenSrc = 'https://images.unsplash.com/photo-1681939282781-341ac4f61996?q=80';
                else if (espLower.includes('ginec')) {
                    if (nombreMed.toLowerCase().includes('marcela') && nombreMed.toLowerCase().includes('pantoja')) {
                        imagenSrc = 'https://images.unsplash.com/photo-1713865467253-ce0ac8477d34?q=80';
                    } else {
                        imagenSrc = 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?q=80';
                    }
                }
                else if (espLower.includes('dermatol'))
                    imagenSrc = 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80';
                else if (espLower.includes('radiolog') || espLower.includes('radiodiagn'))
                    imagenSrc = 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&q=80';
                else if (espLower.includes('urolog'))
                    imagenSrc = 'https://images.unsplash.com/photo-1637059824899-a441006a6875?q=80';
                else if (espLower.includes('endocrin'))
                    imagenSrc = 'https://images.unsplash.com/photo-1758691463582-11aea602cd4a?q=80';
                else if (espLower.includes('traumat') || espLower.includes('ortoped'))
                    imagenSrc = 'https://images.unsplash.com/photo-1712215544003-af10130f8eb3?q=80';
                else if (espLower.includes('psicolog'))
                    imagenSrc = 'https://plus.unsplash.com/premium_photo-1661580574627-9211124e5c3f?q=80';
                else if (espLower.includes('enfermer'))
                    imagenSrc = 'https://plus.unsplash.com/premium_photo-1681996359725-06262b082c27?q=80';
                else if (espLower.includes('laboratorio'))
                    imagenSrc = 'https://plus.unsplash.com/premium_photo-1682089874677-3eee554feb19?w=600';
                else
                    imagenSrc = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80'; // fallback genérico
            }

            if (imgModal) {
                imgModal.loading = 'lazy';
                imgModal.src = imagenSrc;
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
            modal.style.display = 'flex';

            // Trap focus simple
            setTimeout(() => document.getElementById('modal-close-btn').focus(), 100);
        },

        cerrarModal() {
            const modal = document.getElementById('modal-especialista');
            if (modal) {
                modal.style.display = 'none';
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
                // TR-42: whitelist alfanumérca — permite cédulas (dígitos) y pasaportes (letras+dígitos).
                // Bloquea espacios, <, >, ', ", ; y cualquier carácter XSS/SQLi.
                inputCedula.addEventListener('input', (e) => {
                    const antes = e.target.value;
                    const despues = antes.replace(/[^a-zA-Z0-9]/g, '');
                    if (antes !== despues) {
                        const pos = e.target.selectionStart;
                        e.target.value = despues;
                        try { e.target.setSelectionRange(pos - 1, pos - 1); } catch (_) {}
                    }
                });

                // TR-46 §1: Validación de formato en blur (H5 – feedback inmediato al salir del campo)
                inputCedula.addEventListener('blur', () => {
                    const val = inputCedula.value.trim();
                    if (val.length === 0) return; // campo vacío: se valida en submit, no aquí
                    if (val.length < 6 || val.length > 13) {
                        this._mostrarError('login-cedula', 'La identificación debe tener entre 6 y 13 caracteres.');
                    } else {
                        this._limpiarError('login-cedula');
                    }
                });
            }

            // ── Prevenir envío por Enter en campos de login ──
            ['login-cedula', 'login-password'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();               // evita cualquier acción por defecto
                            // Opcional: hacer clic en el botón de login automáticamente
                            // document.getElementById('login-submit-btn').click();
                        }
                    });
                }
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
                // Previene que el navegador lea el cambio como un “valor de contraseña”
                inputPassword.type = 'text';
                inputPassword.value = '';
                inputPassword.type = 'password';
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

            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
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

        async enviar(e) {
            e?.preventDefault?.();

            const identificacion = (document.getElementById('login-cedula')?.value || '').trim();
            const password = (document.getElementById('login-password')?.value || '').trim();
            let valido = true;

            this._limpiarError('login-cedula');
            this._limpiarError('login-password');

            // TR-42 §1: Solo cédula/pasaporte. Correo queda prohibido en el login.
            if (identificacion.length === 0) {
                this._mostrarError('login-cedula', 'Ingresa tu número de identificación.');
                valido = false;
            } else if (identificacion.length === 10) {
                // Cédula ecuatoriana: validar dígito verificador
                if (!utilidades.validarCedulaEcuatoriana(identificacion)) {
                    this._mostrarError('login-cedula', 'La cédula ingresada no es válida.');
                    valido = false;
                }
            } else if (identificacion.length >= 6 && identificacion.length <= 13) {
                // Pasaporte u otros documentos — longitud válida, no hay algoritmo de suma
            } else {
                this._mostrarError('login-cedula', 'La identificación debe tener entre 6 y 13 caracteres.');
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
                const spanPwd  = document.getElementById('login-password-error');

                if (inputCed) inputCed.style.borderColor = '#c0392b';
                if (inputPwd) inputPwd.style.borderColor = '#c0392b';
                if (spanPwd)  {
                    spanPwd.textContent = 'Número de identificación o contraseña incorrectos.';
                    spanPwd.style.display = 'block';
                }

                return;
            }

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
        _tipoDoc: '',   // 'Cédula' | 'Pasaporte'
        _sexo: '',
        _codigoOTPGenerado: '',
        _countdownInterval: null,
        _regexNombre: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,

        // ------------------------------------------------------------------
        // 10.1 Inicialización: bloqueos de input + on-blur + fecha max
        // ------------------------------------------------------------------
        inicializar() {
            this._cerrarModalCuentaExistenteRegistro();
            // Los límites de fecha (min: 120 años, max: 18 años) son aplicados por
            // app._aplicarLimitesFechaGlobal() que se ejecuta en app.inicializar().
            // No es necesario establecer atributos de fecha aquí.

            const docInput = document.getElementById('reg-tipo-doc');
            const identInput = document.getElementById('reg-identificacion');
            if (identInput) {
                identInput.disabled = !this._tipoDoc;
                if (!this._tipoDoc) identInput.value = '';
            }
            // El input readonly se actualiza vía seleccionarDoc(); no se necesita listener de 'change'.

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

            // — Identificación: sanitización CONDICIONAL según tipo de documento —
            // Cédula   → solo dígitos         `/[^0-9]/g`
            // Pasaporte → alfanumérico         `/[^a-zA-Z0-9]/g`
            // Si no hay tipo seleccionado aún, no se sanitiza (campo deshabilitado).
            const regIdent = document.getElementById('reg-identificacion');
            if (regIdent) {
                regIdent.removeEventListener('input', regIdent._inputHandler);
                regIdent._inputHandler = () => {
                    if (this._tipoDoc === 'Cédula') {
                        app._sanitizarInput(regIdent, /[^0-9]/g);
                    } else if (this._tipoDoc === 'Pasaporte') {
                        app._sanitizarInput(regIdent, /[^a-zA-Z0-9]/g);
                    }
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

            if (borrador._tipoDoc) this._tipoDoc = borrador._tipoDoc;
            if (borrador._sexo) this._sexo = borrador._sexo;

            // Restaurar el input visible de tipo de documento
            const docInput = document.getElementById('reg-tipo-doc');
            if (docInput && this._tipoDoc) docInput.value = this._tipoDoc;

            // Si ya hay un tipo de documento, habilitar el input y ajustar placeholder/maxlength
            if (this._tipoDoc) {
                const identInput = document.getElementById('reg-identificacion');
                if (identInput) {
                    identInput.disabled = false;
                    identInput.placeholder = this._tipoDoc === 'Cédula' ? 'Ej: 1712345678' : 'Ej: AB123456';
                    identInput.maxLength = this._tipoDoc === 'Cédula' ? 10 : 13;
                }
                // Marcar el radio correspondiente en el modal
                const radio = document.querySelector(`#modal-tipo-doc input[type="radio"][value="${this._tipoDoc}"]`);
                if (radio) radio.checked = true;
            }
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
                this._tipoDoc = '';
                this._sexo = '';
                this._codigoOTPGenerado = '';
            }
        },

        _emitirOTPAlEntrarPaso3() {
            const emailVal = (document.getElementById('reg-email')?.value || '').trim();
            const emailEl  = document.getElementById('reg-email-show');
            if (emailEl) emailEl.textContent = emailVal;

            const codigo = String(Math.floor(100000 + Math.random() * 900000));
            this._codigoOTPGenerado = codigo;

            // ── TR-40 + TR-41: OTP por EmailJS con nombre real (sin fallback genérico) ──
            const EMAILJS_PUBLIC_KEY  = 'kk20Q6x-B6giGcqcU';
            const EMAILJS_SERVICE_ID  = 'service_y7c5ugc';
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
                    codigo_otp:     codigo
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
                        const existe = await conCargaGlobal(
                            () => existePacienteConCedula(ident),
                            'Verificando datos…'
                        );
                        if (existe) {
                            this._mostrarModalCuentaExistenteRegistro({
                                titulo: 'Cédula ya registrada',
                                mensaje: 'Ya existe una cuenta con esta cédula.'
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
                if (correoVal) {
                    try {
                        const existe = await conCargaGlobal(
                            () => existePacienteConCorreo(correoVal),
                            'Verificando datos…'
                        );
                        if (existe) {
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

                // ── TR-34++: Hack de evasión de Chrome (nivel definitivo) ────────────
                // Secuencia obligatoria antes de ocultar el Paso 2:
                // 1. Guardar el valor en sessionStorage (para recuperarlo en el OTP/ghost-form).
                // 2. Vaciar el DOM — Chrome deja de ver la contraseña en el campo.
                // 3. Cambiar type a 'text' — Chrome no sabe que era un campo de contraseña
                //    cuando se oculta el contenedor, eliminando el prompt al 100%.
                const pwdInput = document.getElementById('reg-password');
                if (pwdInput) {
                    sessionStorage.setItem('temp_pass', pwdInput.value); // paso 1
                    pwdInput.value = '';                                  // paso 2
                    pwdInput.type  = 'text';                              // paso 3 — mata el prompt
                }
            }

            this._irAPaso(pasoActual + 1);
        },

        pasoAnterior(pasoActual) {
            if (pasoActual > 1) this._irAPaso(pasoActual - 1);
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
                    const ident = (document.getElementById(id)?.value || '').trim();
                    if (!this._tipoDoc) {
                        // Sin tipo de doc no podemos validar; se mostrará error al pulsar Siguiente
                        return true;
                    }
                    if (ident.length === 0) {
                        this._mostrarError('reg-ident',
                            'Por favor, ingresa tu número de identificación antes de continuar.');
                        return false;
                    }
                    if (this._tipoDoc === 'Cédula') {
                        if (!/^\d{10}$/.test(ident) || !app.citas.validarCedulaEcuatoriana(ident)) {
                            this._mostrarError('reg-ident',
                                'La cédula debe tener exactamente 10 números y ser válida. ' +
                                'Verifica que no falten dígitos o ingresa una cédula ecuatoriana correcta.');
                            return false;
                        }
                    } else if (this._tipoDoc === 'Pasaporte') {
                        if (ident.length < 6) {
                            this._mostrarError('reg-ident',
                                'El número de pasaporte debe tener al menos 6 caracteres. ' +
                                'Revisa que lo estés escribiendo tal como aparece en tu documento.');
                            return false;
                        }
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
                this._tipoDoc = this._tipoDoc || '';
                this._limpiarError('reg-tipo-doc');
                if (!this._tipoDoc) {
                    this._mostrarError('reg-tipo-doc',
                        'Por favor, selecciona el tipo de documento antes de continuar.');
                    ok = false;
                }

                // Tipo de documento seleccionado → validar identificación
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
        // 10.6 Contador de reenvío
        // ------------------------------------------------------------------
        _iniciarCountdown(segundos) {
            clearInterval(this._countdownInterval);
            const spanCd = document.getElementById('reg-countdown');
            const resendTxt = document.getElementById('reg-resend-txt');
            const btn = document.getElementById('reg-validar-btn');
            if (btn) btn.disabled = false;

            let restante = segundos;
            const actualizar = () => {
                const m = String(Math.floor(restante / 60)).padStart(2, '0');
                const s = String(restante % 60).padStart(2, '0');
                if (spanCd) spanCd.textContent = `${m}:${s}`;
                if (restante === 0) {
                    clearInterval(this._countdownInterval);
                    if (resendTxt) resendTxt.innerHTML =
                        '<a href="javascript:void(0)" onclick="app.registro._renovarOTP()" ' +
                        'style="color:var(--action-color);font-weight:600;">' +
                        'Solicitar código nuevamente</a>';
                }
                restante--;
            };
            actualizar();
            this._countdownInterval = setInterval(actualizar, 1000);
        },

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

            // TR-34/B: Recuperar la contraseña real desde sessionStorage.
            // El input #reg-password fue vaciado al pasar al Paso 3; el valor
            // real está guardado en 'temp_pass' para evitar fallos silenciosos.
            const finalPass = sessionStorage.getItem('temp_pass') || '';

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
                password: finalPass  // ← desde sessionStorage, no del DOM vaciado
            };

            const filaPacienteSupabase = pacienteDesdeRegistroLocal(nuevoUsuario);

            let filaInsertada;
            try {
                filaInsertada = await conCargaGlobal(
                    () => insertPacienteSupabase(filaPacienteSupabase),
                    'Creando tu cuenta…'
                );
            } catch (err) {
                console.error('[Supabase] Registro:', err);
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

            // ── TR-31 §3 — Ghost Form: disparar prompt nativo de guardado de contraseñas ──
            // Se crea un formulario invisible con las credenciales reales, se hace submit
            // interceptado (preventDefault) para que el navegador ofrezca guardar la
            // contraseña, y se elimina de inmediato. No altera el <form> original.
            try {
                const ghostForm = document.createElement('form');
                ghostForm.style.cssText = 'display:none;position:fixed;top:-9999px;left:-9999px;';
                ghostForm.setAttribute('autocomplete', 'on');
                ghostForm.setAttribute('action', 'javascript:void(0);');

                const ghostUser = document.createElement('input');
                ghostUser.type = 'text';
                ghostUser.name = 'username';
                ghostUser.autocomplete = 'username';
                ghostUser.value = nuevoUsuario.identificacion || '';

                const ghostPwd = document.createElement('input');
                ghostPwd.type = 'password';
                ghostPwd.name = 'password';
                ghostPwd.autocomplete = 'new-password';
                ghostPwd.value = finalPass || nuevoUsuario.password || ''; // TR-34: usa el valor real

                const ghostSubmit = document.createElement('button');
                ghostSubmit.type = 'submit';

                ghostForm.appendChild(ghostUser);
                ghostForm.appendChild(ghostPwd);
                ghostForm.appendChild(ghostSubmit);

                // Interceptar el submit para evitar navegación pero dejar que el
                // gestor de contraseñas del navegador capture las credenciales.
                ghostForm.addEventListener('submit', (e) => e.preventDefault(), { once: true });

                document.body.appendChild(ghostForm);
                ghostSubmit.click(); // Activa el prompt nativo sin navegación
                ghostForm.remove();

                // TR-34/B §4: Limpiar la clave temporal tras usarla en el Ghost Form.
                sessionStorage.removeItem('temp_pass');
            } catch (_) {
                // No interrumpir el flujo si el ghost form falla (degradación controlada)
                sessionStorage.removeItem('temp_pass'); // Limpiar igualmente en caso de error
            }

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
            this._tipoDoc = '';
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

        abrirModalDoc() {
            const m = document.getElementById('modal-tipo-doc');
            if (m) m.style.display = 'flex';
            // Foco al primer radio para accesibilidad
            setTimeout(() => m?.querySelector('input[type="radio"]')?.focus(), 50);
        },
        cerrarModalDoc() {
            const m = document.getElementById('modal-tipo-doc');
            if (m) m.style.display = 'none';
            // Devolver foco al input que abrió el modal
            document.getElementById('reg-tipo-doc')?.focus();
        },
        seleccionarDoc(tipo) {
            this._tipoDoc = tipo;

            // Actualizar input visible
            const input = document.getElementById('reg-tipo-doc');
            if (input) input.value = tipo;

            // Forzar checked en el radio del modal (reactividad aunque repita opción)
            const radio = document.querySelector(`#modal-tipo-doc input[type="radio"][value="${tipo}"]`);
            if (radio) radio.checked = true;

            // Habilitar y ajustar el campo de identificación
            const identInput = document.getElementById('reg-identificacion');
            if (identInput) {
                identInput.disabled = false;
                identInput.placeholder = tipo === 'Cédula' ? 'Ej: 1712345678' : 'Ej: AB123456';
                identInput.maxLength = tipo === 'Cédula' ? 10 : 13;
                identInput.value = '';
            }

            this.cerrarModalDoc();
            this._limpiarError('reg-tipo-doc');
        },

        _renovarOTP() {
            const emailVal = document.getElementById('reg-email')?.value || '';
            const codigo = String(Math.floor(100000 + Math.random() * 900000));
            this._codigoOTPGenerado = codigo;
            console.log('[QA OTP] Nuevo código:', codigo, '| correo:', emailVal);
            alert('Tu código de validación es: ' + codigo);
            this._iniciarCountdown(60);
        },

        // ------------------------------------------------------------------
        // 10.9 Modales — Sexo
        // ------------------------------------------------------------------
        abrirModalSexo() {
            const m = document.getElementById('modal-sexo');
            if (m) m.style.display = 'flex';
        },
        cerrarModalSexo() {
            const m = document.getElementById('modal-sexo');
            if (m) m.style.display = 'none';
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
            if (!input) return;
            if (input.type === 'password') {
                input.type = 'text';
                icon?.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
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
            this._tipoDoc = '';
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
            if (modal) modal.style.display = 'flex';
        },

        // ------------------------------------------------------------------
        // 11.2 Cerrar modal
        // ------------------------------------------------------------------
        cerrarModal() {
            const modal = document.getElementById('modal-perfil');
            if (modal) modal.style.display = 'none';
        },

        // ------------------------------------------------------------------
        // 11.3 Cerrar sesión
        // ------------------------------------------------------------------
        cerrarSesion() {
            localStorage.removeItem('usuarioLogueado');
            localStorage.removeItem('usuarioActivo');
            this.cerrarModal();
            app.iniciarSesionUsuario();   // Restaura el botón "Iniciar Sesión"
            app.navegar('home');
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

            u.nombre1   = n1;  u.nombre_1   = n1;
            u.nombre2   = n2;  u.nombre_2   = n2;
            u.apellido1 = a1;  u.apellido_1 = a1;
            u.apellido2 = a2;  u.apellido_2 = a2;
            u.celular = val('edit-celular');
            u.email   = val('edit-email');
            // H3: persistir fecha de nacimiento corregida (TR-13)
            const nuevaFecha = val('edit-fecha-nac');
            if (nuevaFecha) u.fecha_nacimiento = nuevaFecha;

            // ── PASO 2 — TR-32/TR-38: UPDATE en Supabase primero; localStorage solo si Supabase ok ──
            // TR-38: Construir las propiedades unificadas (nombres/apellidos) ANTES del
            // UPDATE, y escribirlas de vuelta en `u` para que el localStorage conserve
            // AMBAS convenciones (dividida para el form + unificada para Supabase/UI).
            const nombresCompletos  = [val('edit-nombre1'), val('edit-nombre2')].filter(Boolean).join(' ');
            const apellidosCompletos = [val('edit-apellido1'), val('edit-apellido2')].filter(Boolean).join(' ');

            // Propiedades unificadas (para Supabase y para UI: modal, navbar)
            u.nombres   = nombresCompletos;
            u.apellidos = apellidosCompletos;

            // ── PASO 3 — Ejecutar actualización asíncrona (800ms simulan latencia de red) ──
            setTimeout(() => {
                void (async () => {
                    const ced = u.identificacion || u.cedula;

                    // TR-38 §1: patch usa los valores unificados ya calculados sincrónicamente.
                    const patch = {
                        nombres:          u.nombres,
                        apellidos:        u.apellidos,
                        celular:          u.celular,
                        correo:           u.email,
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
            modal.style.display = 'flex';
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
                const sp = document.getElementById(`${id}-error`);
                if (sp) { sp.textContent = ''; sp.style.display = 'none'; }
            });
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

            const actual   = document.getElementById('pass-actual')?.value   || '';
            const nueva    = document.getElementById('pass-nueva')?.value    || '';
            const repetir  = document.getElementById('pass-repetir')?.value  || '';

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

        inicializar() {
            if (!this._validadoresIniciados) {
                this._validadoresIniciados = true;

                const inputCedula = document.getElementById('widget-cedula');
                const inputFecha = document.getElementById('widget-fecha-cita');
                const btnConsultar = document.getElementById('btn-consultar-cita');

                // Solo dígitos en cédula y limpiar error en tiempo real
                if (inputCedula) {
                    inputCedula.addEventListener('input', (e) => {
                        e.target.value = e.target.value.replace(/\D/g, '');
                        inputCedula.classList.remove('input-error');
                        const errorSpan = document.getElementById('widget-cedula-error');
                        if (errorSpan) errorSpan.style.display = 'none';
                    });

                    // Validación on blur (H5 Nielsen)
                    inputCedula.addEventListener('blur', () => {
                        const val = inputCedula.value.trim();
                        const errorSpan = document.getElementById('widget-cedula-error');
                        if (val.length === 0) {
                            inputCedula.classList.remove('input-error', 'input-success');
                            if (errorSpan) errorSpan.style.display = 'none';
                        } else if (val.length !== 10 || !/^\d{10}$/.test(val)) {
                            inputCedula.classList.add('input-error');
                            inputCedula.classList.remove('input-success');
                            if (errorSpan) { errorSpan.textContent = 'La cédula debe tener 10 dígitos.'; errorSpan.style.display = 'block'; }
                        } else if (app.citas && !app.citas.validarCedulaEcuatoriana(val)) {
                            inputCedula.classList.add('input-error');
                            inputCedula.classList.remove('input-success');
                            if (errorSpan) { errorSpan.textContent = 'La cédula ingresada no es válida.'; errorSpan.style.display = 'block'; }
                        } else {
                            inputCedula.classList.remove('input-error');
                            inputCedula.classList.add('input-success');
                            if (errorSpan) errorSpan.style.display = 'none';
                        }
                    });
                }

                if (inputFecha) {
                    // Limpiar error en tiempo real
                    inputFecha.addEventListener('input', () => {
                        inputFecha.classList.remove('input-error');
                        const errorSpan = document.getElementById('widget-fecha-error');
                        if (errorSpan) errorSpan.style.display = 'none';
                    });

                    inputFecha.addEventListener('blur', () => {
                        const val = inputFecha.value.trim();
                        const errorSpan = document.getElementById('widget-fecha-error');
                        if (val.length === 0) {
                            inputFecha.classList.remove('input-error', 'input-success');
                            if (errorSpan) errorSpan.style.display = 'none';
                        } else {
                            inputFecha.classList.remove('input-error');
                            inputFecha.classList.add('input-success');
                            if (errorSpan) errorSpan.style.display = 'none';
                        }
                    });
                }

                // Botón Consultar
                if (btnConsultar) {
                    btnConsultar.addEventListener('click', () => {
                        this.consultar();
                    });
                }
            }

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

            const section = document.getElementById('widget-invitado');
            section?.scrollIntoView({ behavior: 'smooth', block: 'start' });

            window.setTimeout(() => {
                const inputCedula = document.getElementById('widget-cedula');
                const inputFecha = document.getElementById('widget-fecha-cita');
                if (!inputCedula || !inputFecha) {
                    sessionStorage.removeItem(STORAGE_AUTO_CONSULTA_INVITADO);
                    return;
                }
                const ced = String(data.cedula || '').replace(/\D/g, '');
                const fecha = String(data.fecha || '').trim();
                inputCedula.value = ced;
                inputFecha.value = fecha;
                inputCedula.classList.remove('input-error');
                inputFecha.classList.remove('input-error');

                this._pendingDetailId = data.id_cita || null;
                this.consultar();
                sessionStorage.removeItem(STORAGE_AUTO_CONSULTA_INVITADO);
            }, 380);
        },

        consultar() {
            const inputCedula = document.getElementById('widget-cedula');
            const inputFecha = document.getElementById('widget-fecha-cita');
            const cedula = (inputCedula?.value || '').trim();
            const fecha = (inputFecha?.value || '').trim();
            const errorCedula = document.getElementById('widget-cedula-error');
            const errorFecha = document.getElementById('widget-fecha-error');
            let valido = true;

            // Limpiar errores previos antes de revalidar
            [inputCedula, inputFecha].forEach(el => {
                if (el) { el.classList.remove('input-error', 'input-success'); }
            });
            [errorCedula, errorFecha].forEach(el => {
                if (el) { el.textContent = ''; el.style.display = 'none'; }
            });

            // ── H9: Validación de Cédula con mensajes precisos ──
            if (!cedula) {
                if (errorCedula) { errorCedula.textContent = 'Por favor, ingrese su número de cédula.'; errorCedula.style.display = 'block'; }
                inputCedula?.classList.add('input-error');
                valido = false;
            } else if (cedula.length !== 10 || !/^\d{10}$/.test(cedula) || (app.citas && !app.citas.validarCedulaEcuatoriana(cedula))) {
                if (errorCedula) { errorCedula.textContent = 'La cédula debe contener 10 dígitos válidos.'; errorCedula.style.display = 'block'; }
                inputCedula?.classList.add('input-error');
                valido = false;
            }

            // ── H9: Validación de Fecha con mensajes precisos ──
            if (!fecha) {
                if (errorFecha) { errorFecha.textContent = 'Por favor, seleccione la fecha de su cita.'; errorFecha.style.display = 'block'; }
                inputFecha?.classList.add('input-error');
                valido = false;
            } else {
                // Validar rango: no puede exceder 2 meses a futuro
                const rangos = app.obtenerRangosFecha();
                if (fecha > rangos.en2Meses) {
                    if (errorFecha) { errorFecha.textContent = 'Las citas solo pueden consultarse hasta 2 meses a futuro.'; errorFecha.style.display = 'block'; }
                    inputFecha?.classList.add('input-error');
                    valido = false;
                }
                // Validar rango: no puede ser en el pasado
                if (fecha < rangos.hoy) {
                    if (errorFecha) { errorFecha.textContent = 'La fecha de la cita no puede ser en el pasado.'; errorFecha.style.display = 'block'; }
                    inputFecha?.classList.add('input-error');
                    valido = false;
                }
            }

            if (!valido) return;

            // TR-50: Single Source of Truth — leer directo de Supabase (no localStorage)
            // Envolver en conCargaGlobal para Heurística 1 (visibilidad del estado)
            void (async () => {
                let resultados = [];
                try {
                    await conCargaGlobal(async () => {
                        // SELECT filtrando por cédula + fecha
                        const { data, error } = await supabase
                            .from('citas')
                            .select('*')
                            .eq('cedula_paciente', cedula)
                            .eq('fecha', fecha);
                        if (error) throw error;
                        if (!data || data.length === 0) { resultados = []; return; }

                        // TR-51: Resolver id_especialista → nombre legible usando cache local
                        let cartera = [];
                        try {
                            const db = JSON.parse(localStorage.getItem('sanitasFam_db') || '{}');
                            cartera = db.cartera_especialistas || [];
                        } catch (_) { cartera = []; }

                        resultados = data.map(row => {
                            // Buscar especialista por id
                            const idEsp = row.id_especialista;
                            const esp = cartera.find(e =>
                                e.id_especialista === idEsp ||
                                e.id_especialista === String(idEsp) ||
                                e.id_especialista === Number(idEsp) ||
                                e.id === idEsp
                            );
                            return {
                                id_cita:       row.id_cita,
                                cedula:        row.cedula_paciente || row.cedula,
                                cedula_paciente: row.cedula_paciente,
                                fecha:         row.fecha,
                                hora:          row.hora,
                                estado:        row.estado || 'Próxima',
                                motivo:        row.motivo || '',
                                tipo:          row.tipo_consulta || '',
                                tipo_consulta: row.tipo_consulta || '',
                                // TR-51: JOIN UI — inyectar nombre legible
                                medico:        row.medico ||
                                               (esp && (esp.nombre_completo || esp.doctor?.nombre_completo)) ||
                                               '(Especialista #' + idEsp + ')',
                                especialidad:  row.especialidad ||
                                               (esp && esp.especialidad) || '',
                                paciente:      row.paciente || row.nombres || '',
                                id_especialista: idEsp
                            };
                        });
                    }, 'Sincronizando datos...');
                } catch (err) {
                    console.error('[TR-50] widgetInvitado.consultar Supabase:', err);
                    const body = document.getElementById('modal-consulta-body');
                    const titulo = document.getElementById('modal-consulta-title');
                    if (titulo) titulo.textContent = 'Error de conexión';
                    if (body) body.innerHTML = `
                        <div style="text-align:center;padding:20px;">
                            <i class="fa-solid fa-triangle-exclamation fa-2x" style="color:#c0392b;margin-bottom:12px;"></i>
                            <p>No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.</p>
                        </div>`;
                    const modal = document.getElementById('modal-consulta-cita');
                    if (modal) modal.style.display = 'flex';
                    return;
                }

                // ── Paso 2: Lógica de visualización según cantidad de resultados ──
                const body = document.getElementById('modal-consulta-body');
                const titulo = document.getElementById('modal-consulta-title');
                if (!body || !titulo) return;

                body.innerHTML = '';

                if (resultados.length === 0) {
                    titulo.textContent = 'No se encontraron citas';
                    body.innerHTML = `
                        <div style="text-align: center; padding: 20px;">
                            <i class="fa-regular fa-calendar-xmark fa-3x" style="color: var(--gray-text); margin-bottom: 15px;"></i>
                            <h4 style="margin-bottom: 10px;">No se encontraron citas</h4>
                            <p style="color: var(--gray-text); font-size: 0.9rem;">No hay citas registradas para la cédula y fecha seleccionadas.</p>
                        </div>
                    `;
                    const modal = document.getElementById('modal-consulta-cita');
                    if (modal) modal.style.display = 'flex';
                    return;
                }

                // Guardar resultados en memoria para navegación interna
                this._resultadosActuales = resultados;

                if (resultados.length === 1) {
                    titulo.textContent = 'Detalle de tu Cita';
                    body.innerHTML = this._renderDetalle(resultados[0]);
                } else {
                    titulo.textContent = `Se encontraron ${resultados.length} citas`;
                    body.innerHTML = this._renderListaMaestro(resultados);
                }

                const modal = document.getElementById('modal-consulta-cita');
                if (modal) modal.style.display = 'flex';

                // Deep link desde colisión
                if (this._pendingDetailId) {
                    const idCita = this._pendingDetailId;
                    this._pendingDetailId = null;
                    const index = this._resultadosActuales.findIndex(c => c.id_cita === idCita);
                    if (index !== -1) this.verDetalle(index);
                }
            })();
        },

        // ── Render: Vista Detalle de una cita ──
        _renderDetalle(cita, mostrarVolver) {
            const fechaFmt = /^\d{4}-\d{2}-\d{2}$/.test(cita.fecha)
                ? cita.fecha.split('-').reverse().join('/')
                : cita.fecha;

            // TR-50: Usar id_cita de Supabase como identificador estable (no índice de localStorage)
            const idCitaEstable = cita.id_cita || '';
            const esCancelada = cita.estado === 'Cancelada';
            const estadoBadge = esCancelada
                ? '<span class="cita-estado-badge cita-estado-badge--cancelada">Cancelada</span>'
                : '<span class="cita-estado-badge cita-estado-badge--activa">Activa</span>';

            let html = `
                <div class="modal-consulta__row">
                    <span class="modal-consulta__label"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Estado</span>
                    <span class="modal-consulta__val">${estadoBadge}</span>
                </div>
                <div class="modal-consulta__row">
                    <span class="modal-consulta__label"><i class="fa-regular fa-calendar" aria-hidden="true"></i> Fecha</span>
                    <span class="modal-consulta__val">${escapeHtmlWidget(fechaFmt || '—')}</span>
                </div>
                <div class="modal-consulta__row">
                    <span class="modal-consulta__label"><i class="fa-regular fa-clock" aria-hidden="true"></i> Hora</span>
                    <span class="modal-consulta__val">${escapeHtmlWidget(cita.hora || '—')}</span>
                </div>
                <div class="modal-consulta__row">
                    <span class="modal-consulta__label"><i class="fa-solid fa-stethoscope" aria-hidden="true"></i> Especialidad</span>
                    <span class="modal-consulta__val">${escapeHtmlWidget(cita.especialidad || 'No especificado')}</span>
                </div>
                <div class="modal-consulta__row">
                    <span class="modal-consulta__label"><i class="fa-solid fa-user-doctor" aria-hidden="true"></i> Médico</span>
                    <span class="modal-consulta__val">${escapeHtmlWidget(cita.medico || 'No especificado')}</span>
                </div>
                <div class="modal-consulta__row">
                    <span class="modal-consulta__label"><i class="fa-solid fa-user" aria-hidden="true"></i> Paciente</span>
                    <span class="modal-consulta__val">${escapeHtmlWidget(cita.paciente || cita.nombres || 'No especificado')}</span>
                </div>`;

            // Botones CRUD solo si la cita NO está cancelada e id_cita disponible
            if (!esCancelada && idCitaEstable) {
                html += `
                <div class="cita-acciones" role="group" aria-label="Acciones de cita">
                    <button type="button" class="cita-acciones__btn cita-acciones__btn--modificar"
                        onclick="app.widgetInvitado.prepararModificacion('${idCitaEstable}')">
                        <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Cambiar Fecha/Hora
                    </button>
                    <button type="button" class="cita-acciones__btn cita-acciones__btn--cancelar"
                        onclick="app.widgetInvitado.cancelarCita('${idCitaEstable}')">
                        <i class="fa-solid fa-ban" aria-hidden="true"></i> Cancelar Cita
                    </button>
                </div>`;
            }

            // Botones de portabilidad (Imprimir / Descargar PDF) — solo si NO cancelada
            if (!esCancelada) {
                html += `
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
                    <button class="btn btn--documento"
                        onclick="app.widgetInvitado.imprimirCitaInvitado('${idCitaEstable}')">
                        <i class="fa-solid fa-print" aria-hidden="true"></i> Imprimir
                    </button>
                    <button class="btn btn--documento"
                        onclick="app.widgetInvitado.descargarPDFCitaInvitado('${idCitaEstable}')">
                        <i class="fa-solid fa-file-pdf" aria-hidden="true"></i> Descargar PDF
                    </button>
                </div>`;
            }

            // Botón "Volver al listado" solo si viene de una lista de múltiples resultados
            if (mostrarVolver) {
                html += `
                <button type="button" class="modal-consulta__btn-volver"
                    onclick="app.widgetInvitado.volverAListado()">
                    <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Volver al listado
                </button>`;
            }

            return html;
        },

        // ── Render: Vista Maestro (lista de citas) ──
        // Recicla la estructura DOM y clases CSS del módulo de Recetas (Mi Salud)
        _renderListaMaestro(citas) {
            return citas.map((c, index) => {
                const horaLabel = escapeHtmlWidget(c.hora || 'Sin hora');
                const espLabel = escapeHtmlWidget(c.especialidad || 'No especificado');
                const medicoLabel = escapeHtmlWidget(c.medico || 'No especificado');
                const pacienteLine = `<p class="cita-card__paciente"><strong>Paciente:</strong> ${escapeHtmlWidget(c.paciente || c.nombres || 'No especificado')}</p>`;

                return `
                <div class="salud-item modal-consulta__item-lista" role="listitem" tabindex="0"
                     onclick="app.widgetInvitado.verDetalle(${index})"
                     onkeydown="if(event.key==='Enter')app.widgetInvitado.verDetalle(${index})">
                    <div class="salud-item__info">
                        <strong class="salud-item__nombre">${medicoLabel}</strong>
                        <span class="salud-item__sub">${espLabel}</span>
                        ${pacienteLine}
                        <span class="salud-item__fecha">${horaLabel}</span>
                    </div>
                    <i class="fa-solid fa-chevron-right salud-item__arrow" aria-hidden="true"></i>
                </div>`;
            }).join('');
        },

        // ── Navegación: Maestro → Detalle de una cita específica ──
        verDetalle(index) {
            const cita = this._resultadosActuales[index];
            if (!cita) return;

            const body = document.getElementById('modal-consulta-body');
            const titulo = document.getElementById('modal-consulta-title');

            titulo.textContent = 'Detalle de tu Cita';
            body.innerHTML = this._renderDetalle(cita, true);
        },

        // ── Navegación: Detalle → Volver al listado Maestro ──
        volverAListado() {
            const body = document.getElementById('modal-consulta-body');
            const titulo = document.getElementById('modal-consulta-title');

            titulo.textContent = `Se encontraron ${this._resultadosActuales.length} citas`;
            body.innerHTML = this._renderListaMaestro(this._resultadosActuales);
        },

        cerrarModal() {
            const modal = document.getElementById('modal-consulta-cita');
            if (modal) modal.style.display = 'none';
            // Limpiar estado interno
            this._resultadosActuales = [];
        },

        // ── Bloque A: Cancelar cita desde modal de invitado ──
        cancelarCita(idStr) {
            console.log("Iniciando proceso de cancelación para:", idStr);
            app.citas.mostrarConfirmacionCancelacion(idStr, (idCancelado) => {
                const citasPublicas = JSON.parse(localStorage.getItem('sanitas_citas') || '[]');

                let indexEnPublicas = citasPublicas.findIndex(c => c.id_cita === idStr);
                if (indexEnPublicas === -1 && !isNaN(parseInt(idStr, 10))) {
                    indexEnPublicas = parseInt(idStr, 10);
                }

                if (indexEnPublicas < 0 || indexEnPublicas >= citasPublicas.length) return;

                // Soft-delete: marcar como cancelada sin borrar
                citasPublicas[indexEnPublicas].estado = 'Cancelada';
                localStorage.setItem('sanitas_citas', JSON.stringify(citasPublicas));

                // Sincronizar con sanitas_mis_citas si existe el registro allí
                const cita = citasPublicas[indexEnPublicas];
                void app._sincronizarCancelacion(cita);

                // H1: Refrescar la vista — re-renderizar el detalle
                const body = document.getElementById('modal-consulta-body');
                const titulo = document.getElementById('modal-consulta-title');
                if (titulo) titulo.textContent = 'Cita Cancelada';

                // Actualizar el resultado en memoria y re-renderizar
                if (this._resultadosActuales[0]) {
                    // Buscar cuál de los resultados coincide
                    const idxLocal = this._resultadosActuales.findIndex(r =>
                        r.cedula === cita.cedula && r.fecha === cita.fecha && r.hora === cita.hora);
                    if (idxLocal !== -1) this._resultadosActuales[idxLocal].estado = 'Cancelada';
                }
                if (body) body.innerHTML = this._renderDetalle(cita, this._resultadosActuales.length > 1);
            });
        },

        // ── Bloque B: Preparar modificación desde modal de invitado ──
        prepararModificacion(idStr) {
            console.log('Modificando cita:', idStr);
            const citasPublicas = JSON.parse(localStorage.getItem('sanitas_citas') || '[]');

            let indexEnPublicas = citasPublicas.findIndex(c => c.id_cita === idStr);
            if (indexEnPublicas === -1 && !isNaN(parseInt(idStr, 10))) {
                indexEnPublicas = parseInt(idStr, 10);
            }

            if (indexEnPublicas < 0 || indexEnPublicas >= citasPublicas.length) return;

            const cita = citasPublicas[indexEnPublicas];

            sessionStorage.setItem('cita_modificacion', JSON.stringify({
                id_cita: cita.id_cita,
                indexPublicas: indexEnPublicas,
                medico: cita.medico,
                especialidad: cita.especialidad,
                cedula: cita.cedula,
                origen: 'widget',
                fechaVieja: cita.fecha,
                horaVieja: cita.hora
            }));

            sessionStorage.setItem('reservaCita_preseleccion', JSON.stringify({
                medico: cita.medico,
                especialidad: cita.especialidad
            }));
            sessionStorage.setItem('especialidad_seleccionada', cita.especialidad);

            this.cerrarModal();
            sessionStorage.removeItem(STORAGE_CITA_EN_PROGRESO);
            sessionStorage.removeItem(STORAGE_CITA_POST_LOGIN);
            app.navegar('citas');
            setTimeout(() => {
                app.citas.mostrarPaso(2);
            }, 100);
        },

        // ── Helper: Normalizar cita de invitado (mapeo de datos H1) ──
        /**
         * Busca la cita en sanitas_citas por ID y normaliza el campo `paciente`
         * (registros antiguos pueden no tenerlo; las nuevas confirmaciones sí lo guardan en citas.js).
         * Estrategia de resolución del nombre del paciente:
         *   1. Si la cita ya tiene `paciente`, se usa tal cual.
         *   2. Cross-ref con sanitas_mis_citas (store privado que SÍ guarda `paciente`).
         *   3. Lookup en sanitas_usuarios por `cedula` para construir el nombre.
         *   4. Fallback: "Paciente no especificado".
         * @param {string} idStr - ID de la cita (id_cita) o índice numérico fallback
         * @returns {Object|null} Cita normalizada o null si no se encontró
         */
        _normalizarCitaInvitado(idStr) {
            const citasPublicas = JSON.parse(localStorage.getItem('sanitas_citas') || '[]');
            let cita = citasPublicas.find(c => c.id_cita === idStr);
            if (!cita && !isNaN(parseInt(idStr, 10))) {
                const idx = parseInt(idStr, 10);
                if (idx >= 0 && idx < citasPublicas.length) cita = citasPublicas[idx];
            }
            if (!cita) return null;

            // ── Mapeo del nombre del paciente ──
            if (!cita.paciente) {
                // Estrategia 1: Cross-ref con sanitas_mis_citas (tiene el objeto completo)
                const misCitas = JSON.parse(localStorage.getItem('sanitas_mis_citas') || '[]');
                const citaCompleta = misCitas.find(mc =>
                    mc.id_cita === cita.id_cita || mc.id === cita.id_cita
                );
                if (citaCompleta && citaCompleta.paciente) {
                    cita.paciente = citaCompleta.paciente;
                } else {
                    // Estrategia 2: Lookup en sanitas_usuarios por cédula
                    const usuarios = JSON.parse(localStorage.getItem('sanitas_usuarios') || '[]');
                    const usuario = usuarios.find(u => u.identificacion === cita.cedula);
                    if (usuario) {
                        const n1 = (usuario.nombre_1 || usuario.nombre1 || (usuario.nombres || '').split(/\s+/)[0] || '').trim();
                        const n2 = (usuario.nombre_2 || usuario.nombre2 || (usuario.nombres || '').split(/\s+/).slice(1).join(' ') || '').trim();
                        const a1 = (usuario.apellido_1 || usuario.apellido1 || (usuario.apellidos || '').split(/\s+/)[0] || '').trim();
                        const a2 = (usuario.apellido_2 || usuario.apellido2 || (usuario.apellidos || '').split(/\s+/).slice(1).join(' ') || '').trim();
                        cita.paciente = [n1, n2, a1, a2].filter(Boolean).join(' ') || 'Paciente no especificado';
                    } else {
                        // Estrategia 3: Fallback digno
                        cita.paciente = 'Paciente no especificado';
                    }
                }
            }

            return cita;
        },

        // ── Proxy: Imprimir cita desde modal de invitado (golden-rules §58) ──
        /**
         * Busca la cita en localStorage por ID, normaliza el nombre del paciente,
         * y delega a utilidades.imprimirCita.
         * @param {string} idStr - ID de la cita (id_cita) o índice numérico fallback
         */
        imprimirCitaInvitado(idStr) {
            const cita = this._normalizarCitaInvitado(idStr);
            if (!cita) {
                console.warn('[app.widgetInvitado] imprimirCitaInvitado: cita no encontrada con ID', idStr);
                return;
            }
            app.utilidades.imprimirCita(cita);
        },

        // ── Proxy: Descargar PDF de cita desde modal de invitado (golden-rules §58) ──
        /**
         * Busca la cita en localStorage por ID, normaliza el nombre del paciente,
         * y delega a utilidades.descargarPDFCita.
         * @param {string} idStr - ID de la cita (id_cita) o índice numérico fallback
         */
        descargarPDFCitaInvitado(idStr) {
            const cita = this._normalizarCitaInvitado(idStr);
            if (!cita) {
                console.warn('[app.widgetInvitado] descargarPDFCitaInvitado: cita no encontrada con ID', idStr);
                return;
            }
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
