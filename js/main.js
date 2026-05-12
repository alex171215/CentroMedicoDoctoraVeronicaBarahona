import { utilidades } from './modulos/utilidades.js';
import { estado } from './estado.js';
import { createCitas } from './modulos/citas.js';
import { salud } from './modulos/salud.js';

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

(function inyectarUsuarioPrueba() {
    if (!localStorage.getItem('sanitas_usuarios')) {
        const usuarioDemo = [{
            identificacion: "1722959465",
            password: "admin",
            nombre_1: "Paúl",
            nombre_2: "Alexander",
            apellido_1: "Rosero",
            apellido_2: "Carrión",
            fecha_nacimiento: "2005-05-15",
            sexo: "Masculino",
            celular: "0991234567",
            email: "demo@sanitas.com"
        }];
        localStorage.setItem('sanitas_usuarios', JSON.stringify(usuarioDemo));
        console.log("[Sanitas Prot] Usuario de prueba inyectado: 1715811293 / admin");
    }
})();


const app = {
    // Variables de estado
    intervaloCarrusel: null,
    tiempoCarrusel: 7000, // 7 segundos exigidos por reglas de usabilidad (IHC)

    init: function () {
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
            app.salud.inicializar();
        }
        if (document.getElementById('view-citas')) {
            app.citas.iniciarFlujo();
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

        const minNac = new Date(hoy.getFullYear() - 90, hoy.getMonth(), hoy.getDate());
        const hace90Anios = minNac.toISOString().split('T')[0];

        const maxNac = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate());
        const hace18Anios = maxNac.toISOString().split('T')[0];

        const max60 = new Date(hoy.getFullYear() - 60, hoy.getMonth(), hoy.getDate());
        const hace60Anios = max60.toISOString().split('T')[0];

        return { hoy: fechaHoy, en2Meses, hace90Anios, hace18Anios, hace60Anios };
    },

    _aplicarLimitesFechaGlobal() {
        const rangos = this.obtenerRangosFecha();

        // Aplicar a TODOS los inputs date del sistema
        const dateInputs = document.querySelectorAll('input[type="date"]');
        dateInputs.forEach(input => {
            if (input.id === 'reg-fecha-nac') {
                // Bloque B: Registro de Cuenta (hace 90 años a hace 18 años)
                input.setAttribute('min', rangos.hace90Anios);
                input.setAttribute('max', rangos.hace18Anios);
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
    _sincronizarCancelacion(cita) {
        // Sincronizar hacia sanitas_citas (store público)
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
                        const nom1 = (userActivo.nombre1 || userActivo.nombre_1 || '').trim();
                        const ape1 = (userActivo.apellido1 || userActivo.apellido_1 || '').trim();
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
                    app.perfil.abrirModal();
                } else {
                    app.navegar('login');
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
                        const nom1 = (userActivo.nombre1 || userActivo.nombre_1 || '').trim();
                        const ape1 = (userActivo.apellido1 || userActivo.apellido_1 || '').trim();
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

        // WIDGET INVITADO: Ocultar si hay sesión, mostrar si es invitado
        const widgetInvitado = document.getElementById('widget-invitado');
        if (widgetInvitado) {
            widgetInvitado.style.display = (usuarioLogueado === 'true') ? 'none' : 'block';
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

        if (vistaId !== 'citas') {
            sessionStorage.removeItem('temp_datos_recuperacion');
            if (app.citas) app.citas.modoProxy = false;
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
                        <img src="${imagen}" alt="${esp}" style="width: 100%; height: 100%; object-fit: cover;">
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
        this.navegar('citas');
    },

    // CORRECCIÓN: Para cuando hacen clic en el carrusel de especialidades
    seleccionarEspecialidad: function (especialidad) {
        // Limpiamos al médico anterior, pero guardamos la nueva especialidad
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
                    <img src="${imagenSrc}" alt="${nombreMed}" class="directory-card__img" tabindex="0">
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

            imgModal.src = imagenSrc;

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

    // ======================================================================
    // 8. MÓDULO DE FARMACIA — Vitrina Digital
    // ======================================================================
    farmacia: {

        _categoriaActiva: 'TODAS',
        _productos: [],
        _resultadosActuales: [], // Guarda la búsqueda actual
        _paginaActual: 1,        // Control de paginación
        _itemsPorPagina: 12,     // Mostrar de 12 en 12
        _debounceTimer: null,

        // IHC PARCHE: Diccionario para acortar los nombres largos en los botones (Chips)
        _nombresCortosCat: {
            "ANTIPIRETICOS – ANTIINFLAMATORIOS PEDIATRICOS": "Fiebre y Dolor (Pediatría)",
            "ANTIPIRETICOS - ANTIINFLAMATORIOS ADULTOS": "Fiebre y Dolor (Adultos)",
            "MUCOLITICOS - ANTIHISTAMINICOS - EXPECTORANTES PEDIATRICOS": "Respiratorio (Pediatría)",
            "ANTIHISTAMINICOS - MUCOLITICOS - ANTIGRIPALES ADULTOS": "Respiratorio (Adultos)",
            "ANTIBIOTICOS PEDIATRICOS": "Antibióticos (Pediatría)",
            "ANTIBIOTICOS ADULTOS": "Antibióticos (Adultos)",
            "ANTIPARASITARIOS PEDIATRICOS": "Antiparasitarios (Ped.)",
            "ANTIPARASITARIOS ADULTOS": "Antiparasitarios (Adul.)",
            "TRACTO DIGESTIVO": "Tracto Digestivo",
            "DERMATOLOGIA": "Dermatología",
            "OFTALMOLOGIA": "Oftalmología",
            "GINECOLOGIA": "Ginecología",
            "COLESTEROL y TRIGLICERIDOS": "Cardiología / Colesterol",
            "ENDOCRINOLOGIA": "Endocrinología",
            "VITAMINAS PEDIATRICOS": "Vitaminas (Pediatría)",
            "VITAMINAS ADULTOS": "Vitaminas (Adultos)",
            "OTROS": "Otros",
            "NEBULIZACIONES": "Nebulizaciones",
            "LECHES": "Fórmulas y Leches"
        },

        // ------------------------------------------------------------------
        // 8.1 — Utilidades de Parseo (Regex)
        // ------------------------------------------------------------------
        _parsearProducto(rawString) {
            let raw = (rawString || '').trim();

            // IHC PARCHE: Limpieza manual de strings anómalos del JSON
            if (raw.includes("ACTIVA ANTICASPA CHAMPU")) {
                return { comercial: "ACTIVA ANTICASPA CHAMPU", generico: "Uso Tópico", presentacion: "Frasco" };
            }
            if (raw.includes("URIAGE DESODORANTE")) {
                return { comercial: "URIAGE DESODORANTE", generico: "Uso Tópico", presentacion: "Roll-on/Spray" };
            }
            if (raw.includes("LAMODERM") && raw.includes("SPRAY ANTITRANSPIRANTE")) {
                raw = raw.split("SPRAY ANTITRANSPIRANTE")[0].trim(); // Cortamos la basura
            }

            const matchGenerico = raw.match(/^([^(]+?)\s*\(([^)]+)\)\s*(.*?)$/);

            if (matchGenerico) {
                return {
                    comercial: matchGenerico[1].trim(),
                    generico: matchGenerico[2].trim(),
                    presentacion: matchGenerico[3].trim()
                };
            }

            // Si el nombre sigue siendo gigante (más de 35 letras), lo truncamos visualmente
            if (raw.length > 35) {
                return { comercial: raw.substring(0, 32) + '...', generico: '—', presentacion: '' };
            }
            return { comercial: raw, generico: '—', presentacion: '' };
        },

        // ------------------------------------------------------------------
        // 8.2 — Generadores de datos de prototipo (STOCK EXACTO IHC #1)
        // ------------------------------------------------------------------
        _precioAleatorio() {
            const val = 1.50 + Math.random() * (48.00 - 1.50);
            return parseFloat(val.toFixed(2));
        },

        _stockAleatorio() {
            return Math.floor(Math.random() * 51); // 0 – 50
        },

        _claseStock(cantidad) {
            if (cantidad === 0) return { clase: 'stock-out', texto: 'Agotado' };
            if (cantidad <= 5) return { clase: 'stock-low', texto: `Pocas uds (${cantidad} u)` };
            return { clase: 'stock-high', texto: `En Stock (${cantidad} u)` };
        },

        // ------------------------------------------------------------------
        // 8.3 — Imágenes dinámicas según tipo de presentación
        // ------------------------------------------------------------------
        _imagenProducto(nombre, presentacion) {
            const haystack = (nombre + ' ' + presentacion).toUpperCase();
            if (/JARABE|SUSPENSION|GOTERO|SOLUCION/.test(haystack))
                return 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&q=70';
            if (/CREMA|GEL|UNGÜENTO|LOCION|POMADA/.test(haystack))
                return 'https://images.unsplash.com/photo-1664376694240-14da625cc0c8?q=80';
            if (/AMPOLLA|AMPOLLAS|INYECTABLE/.test(haystack))
                return 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=300&q=70';
            if (/GOTAS|COLIRIO|SPRAY NASAL/.test(haystack))
                return 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=300&q=70';
            if (/TARRO|LECHE|FORMULA|SUPLEMENTO|CEREALES/.test(haystack))
                return 'https://images.unsplash.com/photo-1579194440951-0c501e8ba3c5?q=80';
            return 'https://images.unsplash.com/photo-1550572017-4fcdbb59cc32?w=300&q=70';
        },

        // ------------------------------------------------------------------
        // 8.4 — Extracción de datos desde la DB
        // ------------------------------------------------------------------
        _cargarProductos() {
            const dbStr = localStorage.getItem('sanitasFam_db');
            if (!dbStr) return [];
            const db = JSON.parse(dbStr);

            let categorias = [];
            try { categorias = db.inventario_botiquin.categorias_medicamentos[0].inventario_botiquin.categorias_medicamentos; }
            catch (_) { return []; }

            const lista = [];
            categorias.forEach(cat => {
                const nombreCat = (cat.categoria || 'OTROS').trim();
                // Lista de categorías que requieren receta médica (prototipo)
                const categoriasConReceta = [
                    'ANTIBIOTICOS PEDIATRICOS',
                    'ANTIBIOTICOS ADULTOS',
                    'DERMATOLOGIA',
                    'OFTALMOLOGIA',
                    'GINECOLOGIA',
                    'NEBULIZACIONES',
                    'COLESTEROL y TRIGLICERIDOS',
                    'ENDOCRINOLOGIA'
                ];
                const requiereReceta = categoriasConReceta.includes(nombreCat);
                (cat.productos || []).forEach(rawProd => {
                    const parsed = this._parsearProducto(rawProd);
                    const stock = this._stockAleatorio();
                    const precio = this._precioAleatorio();
                    lista.push({
                        categoria: nombreCat,
                        comercial: parsed.comercial,
                        generico: parsed.generico,
                        presentacion: parsed.presentacion,
                        precio: precio,
                        stock: stock,
                        imagen: this._imagenProducto(parsed.comercial, parsed.presentacion),
                        requiereReceta: requiereReceta
                    });
                });
            });
            return lista;
        },

        // ------------------------------------------------------------------
        // 8.5 — Renderizado de Menú Desplegable (Resolución Ley de Hick)
        // ------------------------------------------------------------------
        _renderizarChips(categorias) {
            const container = document.getElementById('farmacia-chips');
            if (!container) return;

            const grupos = {
                "PEDIATRÍA": ["ANTIPIRETICOS – ANTIINFLAMATORIOS PEDIATRICOS", "MUCOLITICOS - ANTIHISTAMINICOS - EXPECTORANTES PEDIATRICOS", "ANTIBIOTICOS PEDIATRICOS", "ANTIPARASITARIOS PEDIATRICOS", "VITAMINAS PEDIATRICOS", "LECHES"],
                "ADULTOS": ["ANTIPIRETICOS - ANTIINFLAMATORIOS ADULTOS", "ANTIHISTAMINICOS - MUCOLITICOS - ANTIGRIPALES ADULTOS", "ANTIBIOTICOS ADULTOS", "ANTIPARASITARIOS ADULTOS", "VITAMINAS ADULTOS"],
                "ESPECIALIDADES": ["TRACTO DIGESTIVO", "DERMATOLOGIA", "OFTALMOLOGIA", "GINECOLOGIA", "COLESTEROL y TRIGLICERIDOS", "ENDOCRINOLOGIA", "NEBULIZACIONES"],
                "OTROS": ["OTROS"]
            };

            let html = `<a class="farmacia-sidebar__item farmacia-sidebar__item--active" data-cat="TODAS" onclick="app.farmacia._filtrarPorCategoria('TODAS')">Todas</a>`;
            for (const [nombreGrupo, catsDelGrupo] of Object.entries(grupos)) {
                const catsValidas = catsDelGrupo.filter(c => categorias.includes(c));
                if (catsValidas.length === 0) continue;
                html += `<h4 class="farmacia-sidebar__group-title">${nombreGrupo}</h4>`;
                catsValidas.forEach(cat => {
                    const nombreMostrar = this._nombresCortosCat[cat] || cat;
                    html += `<a class="farmacia-sidebar__item" data-cat="${cat}" onclick="app.farmacia._filtrarPorCategoria('${cat}')">${nombreMostrar}</a>`;
                });
            }
            container.innerHTML = html;
        },

        // ------------------------------------------------------------------
        // 8.6 — Renderizado del Grid de Tarjetas (Limpias)
        // ------------------------------------------------------------------
        _renderizarGrid() {
            const grid = document.getElementById('farmacia-grid');
            const empty = document.getElementById('farmacia-empty');
            const btnMas = document.getElementById('btn-cargar-mas');
            if (!grid) return;

            if (this._resultadosActuales.length === 0) {
                grid.innerHTML = '';
                if (empty) empty.style.display = 'block';
                if (btnMas) btnMas.style.display = 'none';
                return;
            }

            if (empty) empty.style.display = 'none';

            // Paginación: Mostrar solo hasta el límite actual
            const tope = this._paginaActual * this._itemsPorPagina;
            const productosPagina = this._resultadosActuales.slice(0, tope);

            grid.innerHTML = productosPagina.map((p, idx) => {
                const agotado = p.stock === 0;
                const stockSimple = agotado ? 'Agotado' : 'Disponible';
                const stockClase = agotado ? 'stock-out' : 'stock-high'; // o podrías tener 'stock-disponible'
                const cardClass = agotado ? 'medicine-card medicine-card--agotado' : 'medicine-card';

                return `
                    <article class="${cardClass}" title="${p.comercial}" onclick="${agotado ? '' : `app.farmacia.abrirModalMedicamento('${p.comercial}', '${p.generico}', '${p.presentacion || ''}', '${p.precio.toFixed(2)}', '${p.stock}', '${p.requiereReceta}', '${p.imagen}')`}" style="cursor:${agotado ? 'default' : 'pointer'};">
                        <div class="medicine-card__img-wrap">
                            <img class="medicine-card__img" src="${p.imagen}" alt="${p.comercial}" loading="lazy"
                                onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                            <span class="medicine-card__img-placeholder" style="display:none;"><i class="fa-solid fa-pills"></i></span>
                           ${p.requiereReceta ? `<span class="medicine-card__cat-badge medicine-card__cat-badge--rx">Requiere receta</span>` : ''}
                        </div>
                        <div class="medicine-card__body">
                            <p class="medicine-card__name">${p.comercial}</p>
                            <p class="medicine-card__generic">${p.generico}</p>
                            <div class="medicine-card__footer">
                                <span class="medicine-card__stock ${stockClase}">${stockSimple}</span>
                                <span class="medicine-card__price">$${p.precio.toFixed(2)}</span>
                            </div>
                        </div>
                    </article>`;
            }).join('');

            // Mostrar/Ocultar el botón "Cargar Más" si hay más productos que los mostrados
            if (btnMas) {
                btnMas.style.display = (tope < this._resultadosActuales.length) ? 'inline-flex' : 'none';
            }
        },

        _cargarMas() {
            this._paginaActual++;
            this._renderizarGrid();
        },

        // ------------------------------------------------------------------
        // 8.7 — Filtro por Categoría
        // ------------------------------------------------------------------
        _filtrarPorCategoria(cat) {
            this._categoriaActiva = cat;
            const query = (document.getElementById('farmacia-buscador')?.value || '').trim();
            this._aplicarFiltros(query, cat);

            // Actualizar clase activa en chips
            document.querySelectorAll('.farmacia-sidebar__item').forEach(item => {
                item.classList.toggle('farmacia-sidebar__item--active', item.dataset.cat === cat);
            });
        },

        // ------------------------------------------------------------------
        // 8.8 — Buscador Tolerante a Fallos (Normalización)
        // ------------------------------------------------------------------
        _aplicarFiltros(query, categoria) {
            let resultado = [...this._productos];

            if (categoria && categoria !== 'TODAS') {
                resultado = resultado.filter(p => p.categoria === categoria);
            }

            if (query.length > 0) {
                const normalizar = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                const terminos = normalizar(query).split(' ').filter(t => t.length > 0);

                resultado = resultado.filter(p => {
                    const textoCompleto = normalizar(`${p.comercial} ${p.generico} ${p.presentacion}`);
                    return terminos.every(termino => textoCompleto.includes(termino));
                });
            }

            this._resultadosActuales = resultado;
            this._paginaActual = 1; // Resetear la página a 1 cada vez que se filtra
            this._renderizarGrid();
        },

        // ------------------------------------------------------------------
        // 8.9 — Buscador en tiempo real (debounce 250ms)
        // ------------------------------------------------------------------
        _iniciarBuscador() {
            const input = document.getElementById('farmacia-buscador');
            if (!input) return;

            input.addEventListener('input', () => {
                clearTimeout(this._debounceTimer);
                this._debounceTimer = setTimeout(() => {
                    const query = input.value.trim().toLowerCase();
                    this._aplicarFiltros(query, this._categoriaActiva);
                }, 250);
            });
        },

        // ------------------------------------------------------------------
        // 8.10 — Inicialización del módulo
        // ------------------------------------------------------------------
        inicializar() {
            // Cargar productos (con precios/stocks aleatorios estables por sesión)
            if (this._productos.length === 0) {
                this._productos = this._cargarProductos();
            }

            // Categorías únicas
            const categorias = [...new Set(this._productos.map(p => p.categoria))];

            this._categoriaActiva = 'TODAS';
            this._renderizarChips(categorias);

            // Copiar contenido al modal de filtros móvil
            const modalList = document.getElementById('farmacia-filtros-modal-list');
            const sidebarList = document.getElementById('farmacia-chips');
            if (modalList && sidebarList) {
                modalList.innerHTML = sidebarList.innerHTML;
                // Reasignar eventos onclick de los enlaces duplicados
                modalList.querySelectorAll('.farmacia-sidebar__item').forEach(item => {
                    const cat = item.getAttribute('data-cat');
                    if (cat) {
                        item.setAttribute('onclick', `app.farmacia._filtrarPorCategoria('${cat}')`);
                    }
                });
            }

            // Abrir modal al pulsar el botón de filtros
            const btnFiltrosMobile = document.getElementById('btn-filtros-mobile');
            if (btnFiltrosMobile) {
                btnFiltrosMobile.addEventListener('click', () => this.abrirModalFiltros());
            }

            // Cerrar modal al hacer clic fuera del contenido
            const modalFiltros = document.getElementById('modal-filtros-mobile');
            if (modalFiltros) {
                modalFiltros.addEventListener('click', (e) => {
                    if (e.target === modalFiltros) this.cerrarModalFiltros();
                });
            }
            this._aplicarFiltros('', 'TODAS');
            this._iniciarBuscador();
            // Cerrar modal de medicamento al hacer clic fuera
            const modalMed = document.getElementById('modal-medicamento');
            if (modalMed) {
                modalMed.addEventListener('click', (e) => {
                    if (e.target === modalMed) this.cerrarModalMedicamento();
                });
            }
        },

        abrirModalMedicamento(comercial, generico, presentacion, precio, stock, requiereReceta, imagen) {
            const root = document.getElementById('modal-medicamento');
            if (!root) return;
            const t = document.getElementById('modal-med-title');
            const g = document.getElementById('modal-med-generic');
            const pr = document.getElementById('modal-med-presentacion');
            const pc = document.getElementById('modal-med-precio');
            const st = document.getElementById('modal-med-stock');
            const img = document.getElementById('modal-med-img');
            if (!t || !g || !pr || !pc || !st || !img) return;
            t.textContent = comercial;
            g.textContent = generico;
            pr.textContent = presentacion || '—';
            pc.textContent = `$${precio}`;
            const stockMsg = stock === '0' ? 'Agotado' : `${stock} unidades`;
            st.textContent = stockMsg;
            img.src = imagen;
            const recetaEl = document.getElementById('modal-med-receta');
            if (recetaEl) {
                recetaEl.style.display = (requiereReceta === 'true') ? 'flex' : 'none';
            }
            root.style.display = 'flex';
            setTimeout(() => {
                const closeBtn = document.querySelector('#modal-medicamento .modal-close');
                if (closeBtn) closeBtn.focus();
            }, 100);
        },

        cerrarModalMedicamento() {
            const m = document.getElementById('modal-medicamento');
            if (m) m.style.display = 'none';
        },

        // Abrir modal de filtros en móvil
        abrirModalFiltros() {
            const modal = document.getElementById('modal-filtros-mobile');
            if (modal) modal.style.display = 'flex';
        },

        // Cerrar modal de filtros
        cerrarModalFiltros() {
            const modal = document.getElementById('modal-filtros-mobile');
            if (modal) modal.style.display = 'none';
        }
    },

    // ======================================================================
    // 9. MÓDULO LOGIN (Validación Inteligente e IHC)
    // ======================================================================
    login: {
        inicializar() {
            const inputCedula = document.getElementById('login-cedula');
            if (inputCedula) {
                // Solo dígitos, sin convertir a mayúsculas
                inputCedula.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/[^0-9]/g, '');
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
                submitBtn.addEventListener('click', (e) => this.enviar(e));
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

        enviar(e) {
            e.preventDefault();

            const identificacion = (document.getElementById('login-cedula')?.value || '').trim();
            const password = (document.getElementById('login-password')?.value || '').trim();
            let valido = true;

            this._limpiarError('login-cedula');
            this._limpiarError('login-password');

            // 1. Validación de Longitud (Cédula o Pasaporte) – se mantiene igual

            // ── VALIDACIÓN DE CÉDULA / PASAPORTE ──
            if (identificacion.length === 10 || identificacion.length === 13) {
                if (!utilidades.validarCedulaEcuatoriana(identificacion)) {
                    this._mostrarError('login-cedula', 'La cédula ingresada no es válida.');
                    valido = false;
                }
            } else if (identificacion.length >= 6 && identificacion.length <= 13) {
                // Longitudes 6–9 u 11–12 sin dígito verificador válido → se aceptan como pasaporte
                // no se aplica validación módulo 10
            } else if (identificacion.length > 0) {
                this._mostrarError('login-cedula', 'La identificación debe tener entre 6 y 13 caracteres.');
                valido = false;
            } else {
                this._mostrarError('login-cedula', 'Ingresa una identificación.');
                valido = false;
            }

            // 3. Validación de Contraseña
            if (password.length === 0) {
                this._mostrarError('login-password', 'La contraseña es requerida.');
                valido = false;
            }

            if (!valido) return;

            // 4. Verificación contra Base de Datos Simulada
            const usuariosDb = JSON.parse(localStorage.getItem('sanitas_usuarios')) || [];
            const usuarioEncontrado = usuariosDb.find(u => u.identificacion === identificacion && u.password === password);

            // Bypass temporal de prototipo: Permitir login con un usuario por defecto si no hay base de datos
            if (usuarioEncontrado || (identificacion === "1715811293" && password === "admin")) {
                // ── DISPARAR GESTOR DE CONTRASEÑAS SOLO SI LOGIN EXITOSO ──
                const hiddenUsername = document.getElementById('hidden-username');
                const hiddenPassword = document.getElementById('hidden-password');
                if (hiddenUsername && hiddenPassword) {
                    hiddenUsername.value = identificacion;
                    hiddenPassword.value = password;
                    // Simular clic en el botón interno: dispara el evento 'submit' del form,
                    // el cual tiene su e.preventDefault() registrado → NO hay POST real al servidor.
                    // NUNCA usar hiddenForm.submit() directamente: eso bypasea los event listeners.
                    const hiddenForm = document.getElementById('hidden-login-form');
                    const submitBtn = hiddenForm?.querySelector('button[type="submit"]');
                    if (submitBtn) submitBtn.click();
                }
                // ──────────────────────────────────────────────────────────

                // ── NUEVO: Limpiar formulario antes de salir ──
                this.resetearFormulario();
                localStorage.setItem('usuarioLogueado', 'true');
                localStorage.setItem('usuarioActivo', JSON.stringify(usuarioEncontrado || { nombres: "Usuario de Prueba", identificacion: identificacion }));

                app.iniciarSesionUsuario(); // Actualiza el botón del header

                // DECISIÓN ÚNICA: ¿viene de un flujo de agendamiento?
                // ── Redirección basada en vista de origen ──
                const vistaOrigen = sessionStorage.getItem('vista_origen');
                sessionStorage.removeItem('vista_origen');   // Limpiar para no contaminar

                if (!vistaOrigen || vistaOrigen === 'registro') {
                    app.navegar('home');
                } else if (vistaOrigen === 'citas') {
                    // Los datos de citas ya fueron guardados antes de navegar a login,
                    // y serán restaurados por iniciarFlujo al detectar 'citas_login_restore'
                    app.navegar('citas');
                } else {
                    app.navegar(vistaOrigen);   // 'especialistas', 'farmacia', 'home', etc.
                }
            } else {
                this._mostrarError('login-password', 'Usuario o contraseña incorrectos.');
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
        _countdownInterval: null,
        _regexNombre: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,

        // ------------------------------------------------------------------
        // 10.1 Inicialización: bloqueos de input + on-blur + fecha max
        // ------------------------------------------------------------------
        inicializar() {
            // Prevención de nacimientos futuros (IHC #5)
            const fechaInput = document.getElementById('reg-fecha-nac');
            if (fechaInput) fechaInput.max = new Date().toISOString().split('T')[0];
            // ── NUEVO: Aplica restricción de 18 a 60 años ──
            utilidades.aplicarRestriccionEdad('reg-fecha-nac');

            // Deshabilitar identificación hasta que se elija tipo de documento
            const identInput = document.getElementById('reg-identificacion');
            if (identInput) {
                identInput.disabled = true;
                identInput.value = '';
            }

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
            borrador.timestamp = Date.now();   // ← AÑADE ESTA LÍNEA
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

            // Si ya hay un tipo de documento, habilitar el input y ajustar placeholder/maxlength
            if (this._tipoDoc) {
                const identInput = document.getElementById('reg-identificacion');
                if (identInput) {
                    identInput.disabled = false;
                    identInput.placeholder = this._tipoDoc === 'Cédula' ? 'Ej: 1712345678' : 'Ej: AB123456';
                    identInput.maxLength = this._tipoDoc === 'Cédula' ? 10 : 13;
                }
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
            }
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
                const emailEl = document.getElementById('reg-email-show');
                const emailVal = document.getElementById('reg-email')?.value || '';
                if (emailEl) emailEl.textContent = emailVal;
                this._iniciarCountdown(60);
            }
            // Regla 12 – Gestión de Foco y Scroll (TR-12):
            // Al transicionar entre pasos el usuario debe ver el inicio del nuevo contenido.
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        siguientePaso(pasoActual) {
            if (!this._validarPaso(pasoActual)) return;
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
                    // Bloque C: Validación en el servidor simulado
                    const rangos = app.obtenerRangosFecha();
                    if (val > rangos.hace18Anios) {
                        this._mostrarError('reg-fecha', 'Debe ser mayor de 18 años para crear una cuenta.');
                        return false;
                    }
                    if (val < rangos.hace60Anios) {   // ← cambia de 90 a 60
                        this._mostrarError('reg-fecha', 'La edad máxima permitida es de 60 años.');
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
                // Tipo de documento (no tiene campo con blur, validar aquí)
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
                        '<a href="javascript:void(0)" onclick="app.registro._iniciarCountdown(60)" ' +
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
        validarCodigo() {
            this._limpiarError('reg-codigo');
            const codigo = (document.getElementById('reg-codigo')?.value || '').trim();

            if (codigo.length !== 6) {
                this._mostrarError('reg-codigo',
                    'El código de verificación debe tener exactamente 6 dígitos. ' +
                    'Revisa el correo que enviamos y cópialo aquí.');
                return;
            }
            if (codigo !== '123456') {
                this._mostrarError('reg-codigo',
                    'El código ingresado no coincide. Verifica que lo hayas escrito correctamente ' +
                    'o solicita uno nuevo cuando el contador llegue a cero.');
                return;
            }

            // Guardar en DB simulada
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
                email: (document.getElementById('reg-email')?.value || '').trim(),
                password: document.getElementById('reg-password')?.value || '',
                nombres: `${(document.getElementById('reg-nombre1')?.value || '').trim()} ${(document.getElementById('reg-apellido1')?.value || '').trim()}`
            };

            const usuarios = JSON.parse(localStorage.getItem('sanitas_usuarios') || '[]');
            usuarios.push(nuevoUsuario);
            localStorage.setItem('sanitas_usuarios', JSON.stringify(usuarios));
            localStorage.setItem('usuarioLogueado', 'true');
            localStorage.setItem('usuarioActivo', JSON.stringify(nuevoUsuario));

            clearInterval(this._countdownInterval);
            app.iniciarSesionUsuario();
            // Limpiar borrador
            sessionStorage.removeItem('sanitas_borrador_registro');
            // Limpiar campos visualmente para evitar residuos de datos
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

            // ── H1 - Punto Final de Registro: Pantalla de Éxito post-Verificación ──
            // El usuario ya está registrado y logueado (iniciarSesionUsuario ya fue llamado).
            // En lugar de navegar abruptamente al Home, mostramos la confirmación visual.
            // El botón de la pantalla lleva al Home como acción explícita del usuario.
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
            } else {
                // Fallback: si el contenedor no está disponible, navegar directamente
                app.navegar('home');
            }

        },

        // ------------------------------------------------------------------
        // 10.8 Modales — Tipo de Documento
        // ------------------------------------------------------------------
        abrirModalDoc() {
            const m = document.getElementById('modal-tipo-doc');
            if (m) m.style.display = 'flex';
        },
        cerrarModalDoc() {
            const m = document.getElementById('modal-tipo-doc');
            if (m) m.style.display = 'none';
        },
        seleccionarDoc(tipo) {
            this._tipoDoc = tipo;

            // Actualizar input visible
            const input = document.getElementById('reg-tipo-doc');
            if (input) input.value = tipo;

            // Forzar checked en el radio del modal (reactividad aunque repita opción)
            const radio = document.querySelector(`#modal-tipo-doc input[type="radio"][value="${tipo}"]`);
            if (radio) radio.checked = true;

            // Habilitar campo de identificación y limpiar valor anterior
            const identInput = document.getElementById('reg-identificacion');
            if (identInput) {
                identInput.disabled = false;
                identInput.value = '';
                if (tipo === 'Cédula') {
                    identInput.placeholder = 'Ej: 1712345678';
                    identInput.maxLength = 10;
                } else {
                    identInput.placeholder = 'Ej: AB123456';
                    identInput.maxLength = 13;
                }
            }

            this.cerrarModalDoc();
            this._limpiarError('reg-tipo-doc');
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
            const nombre1 = u.nombre1 || u.nombre_1 || '';
            const nombre2 = u.nombre2 || u.nombre_2 || '';
            const apellido1 = u.apellido1 || u.apellido_1 || '';
            const apellido2 = u.apellido2 || u.apellido_2 || '';
            const nombreCompleto = [nombre1, nombre2, apellido1, apellido2]
                .filter(Boolean).join(' ');
            const celular = u.celular || '—';

            // Inyectar en el DOM
            const elNombre = document.getElementById('perfil-nombre-completo');
            if (elNombre) elNombre.textContent = nombreCompleto || '—';

            const elCelular = document.getElementById('perfil-celular');
            if (elCelular) elCelular.textContent = celular;

            // Avatar: mostrar inicial del primer nombre
            const elAvatar = document.getElementById('perfil-avatar-iniciales');
            if (elAvatar) {
                const inicial = nombre1.charAt(0).toUpperCase();
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

            set('edit-nombre1', u.nombre1 || u.nombre_1 || '');
            set('edit-nombre2', u.nombre2 || u.nombre_2 || '');
            set('edit-apellido1', u.apellido1 || u.apellido_1 || '');
            set('edit-apellido2', u.apellido2 || u.apellido_2 || '');
            set('edit-celular', u.celular || '');
            set('edit-email', u.email || '');

            const msg = document.getElementById('edit-success-msg');
            if (msg) msg.style.display = 'none';

            ['edit-nombre1', 'edit-nombre2', 'edit-apellido1', 'edit-apellido2',
                'edit-celular', 'edit-email'].forEach(id => {
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
            if (!this._validarCamposEdit()) return;

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

            // Soportar ambas convenciones de claves (usuario demo vs. usuario registrado)
            if ('nombre_1' in u) {
                u.nombre_1 = val('edit-nombre1');
                u.nombre_2 = val('edit-nombre2');
                u.apellido_1 = val('edit-apellido1');
                u.apellido_2 = val('edit-apellido2');
            } else {
                u.nombre1 = val('edit-nombre1');
                u.nombre2 = val('edit-nombre2');
                u.apellido1 = val('edit-apellido1');
                u.apellido2 = val('edit-apellido2');
            }
            u.celular = val('edit-celular');
            u.email   = val('edit-email');

            // ── PASO 2 — Procesamiento (800ms simulan latencia de red) ──
            setTimeout(() => {

                // Persistir en localStorage (lógica atómica dentro del timeout)
                localStorage.setItem('usuarioActivo', JSON.stringify(u));

                const lista = JSON.parse(localStorage.getItem('sanitas_usuarios') || '[]');
                const idx = lista.findIndex(x => x.identificacion === u.identificacion);
                if (idx !== -1) {
                    lista[idx] = { ...lista[idx], ...u };
                    localStorage.setItem('sanitas_usuarios', JSON.stringify(lista));
                }

                // Refrescar header y barra inferior con el nuevo nombre
                app.iniciarSesionUsuario();

                // ── PASO 3 — Resolución: restaurar botón + mostrar mensaje (misma tarea) ──
                // El botón se reactiva aquí para que el usuario pueda guardar de nuevo
                // ANTES de que el mensaje desaparezca — sin condición de carrera visual.
                if (btnGuardar) {
                    btnGuardar.disabled = false;
                    btnGuardar.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Guardar Cambios';
                }

                const msg = document.getElementById('edit-success-msg');
                if (msg) {
                    msg.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> <span>✅ Cambios guardados correctamente</span>';
                    msg.style.display = 'flex';

                    // ── PASO 4 — Limpieza: ocultar SOLO el mensaje (3000ms anidados) ──
                    // El botón ya está activo; este timer solo elimina el aviso visual.
                    // EL USUARIO PERMANECE EN LA VISTA — es él quien decide cuándo salir.
                    setTimeout(() => {
                        msg.style.display = 'none';
                    }, 3000);
                }

            }, 800);
        }
    },

    // ======================================================================
    // 12. MÓDULO SALUD — Dashboard Mis Citas / Mis Recetas,

    widgetInvitado: {
        _validadoresIniciados: false,

        inicializar() {
            if (this._validadoresIniciados) return;
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

            // ── Paso 1: Obtener TODOS los registros que coincidan (Cédula + Fecha) ──
            const citasGuardadas = JSON.parse(localStorage.getItem('sanitas_citas') || '[]');

            // Normalizar la fecha del input (YYYY-MM-DD) para comparación exacta
            const fechaNorm = fecha.trim();

            const resultados = citasGuardadas.filter(c => {
                const cedulaMatch = (c.cedula || '').trim() === cedula;
                const fechaMatch = (c.fecha || '').trim() === fechaNorm;
                return cedulaMatch && fechaMatch;
            });

            // ── Paso 2: Lógica de visualización según cantidad de resultados ──
            const body = document.getElementById('modal-consulta-body');
            const titulo = document.getElementById('modal-consulta-title');

            // Limpiar contenedor dinámico
            body.innerHTML = '';

            if (resultados.length === 0) {
                // 0 resultados → Abrir modal con Empty State
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
                // 1 resultado → Inyectar vista Detalle directamente
                titulo.textContent = 'Detalle de tu Cita';
                body.innerHTML = this._renderDetalle(resultados[0]);
            } else {
                // >1 resultados → Inyectar vista Maestro (lista clickeable)
                titulo.textContent = `Se encontraron ${resultados.length} citas`;
                body.innerHTML = this._renderListaMaestro(resultados);
            }

            // Abrir modal
            const modal = document.getElementById('modal-consulta-cita');
            if (modal) modal.style.display = 'flex';

            // Deep link desde colisión: abrir automáticamente el detalle de la cita conflictiva
            if (this._pendingDetailId) {
                const idCita = this._pendingDetailId;
                this._pendingDetailId = null; // se consume una sola vez
                const index = this._resultadosActuales.findIndex(c => c.id_cita === idCita);
                if (index !== -1) {
                    this.verDetalle(index);
                }
            }
        },

        // ── Render: Vista Detalle de una cita ──
        _renderDetalle(cita, mostrarVolver) {
            const fechaFmt = /^\d{4}-\d{2}-\d{2}$/.test(cita.fecha)
                ? cita.fecha.split('-').reverse().join('/')
                : cita.fecha;

            // Determinar el índice de esta cita en sanitas_citas para poder referenciarlo
            const citasPublicas = JSON.parse(localStorage.getItem('sanitas_citas') || '[]');
            const indexEnPublicas = citasPublicas.findIndex(cp =>
                cp.cedula === cita.cedula && cp.fecha === cita.fecha && cp.hora === cita.hora && cp.medico === cita.medico);

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
                    <span class="modal-consulta__val">${fechaFmt || '—'}</span>
                </div>
                <div class="modal-consulta__row">
                    <span class="modal-consulta__label"><i class="fa-regular fa-clock" aria-hidden="true"></i> Hora</span>
                    <span class="modal-consulta__val">${cita.hora || '—'}</span>
                </div>
                <div class="modal-consulta__row">
                    <span class="modal-consulta__label"><i class="fa-solid fa-stethoscope" aria-hidden="true"></i> Especialidad</span>
                    <span class="modal-consulta__val">${cita.especialidad || '—'}</span>
                </div>
                <div class="modal-consulta__row">
                    <span class="modal-consulta__label"><i class="fa-solid fa-user-doctor" aria-hidden="true"></i> Médico</span>
                    <span class="modal-consulta__val">${cita.medico || '—'}</span>
                </div>`;

            // Botones CRUD solo si la cita NO está cancelada y se encontró en el store
            if (!esCancelada && indexEnPublicas !== -1) {
                html += `
                <div class="cita-acciones" role="group" aria-label="Acciones de cita">
                    <button type="button" class="cita-acciones__btn cita-acciones__btn--modificar"
                        onclick="app.widgetInvitado.prepararModificacion('${cita.id_cita || indexEnPublicas}')">
                        <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Cambiar Fecha/Hora
                    </button>
                    <button type="button" class="cita-acciones__btn cita-acciones__btn--cancelar"
                        onclick="app.widgetInvitado.cancelarCita('${cita.id_cita || indexEnPublicas}')">
                        <i class="fa-solid fa-ban" aria-hidden="true"></i> Cancelar Cita
                    </button>
                </div>`;
            }

            // Botones de portabilidad (Imprimir / Descargar PDF) — solo si NO cancelada
            if (!esCancelada) {
                html += `
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
                    <button class="btn btn--documento"
                        onclick="app.widgetInvitado.imprimirCitaInvitado('${cita.id_cita || indexEnPublicas}')">
                        <i class="fa-solid fa-print" aria-hidden="true"></i> Imprimir
                    </button>
                    <button class="btn btn--documento"
                        onclick="app.widgetInvitado.descargarPDFCitaInvitado('${cita.id_cita || indexEnPublicas}')">
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
                const horaLabel = c.hora || 'Sin hora';
                const espLabel = c.especialidad || 'Consulta General';
                const medicoLabel = c.medico || 'Médico Especialista';

                return `
                <div class="salud-item modal-consulta__item-lista" role="listitem" tabindex="0"
                     onclick="app.widgetInvitado.verDetalle(${index})"
                     onkeydown="if(event.key==='Enter')app.widgetInvitado.verDetalle(${index})">
                    <div class="salud-item__info">
                        <strong class="salud-item__nombre">${medicoLabel}</strong>
                        <span class="salud-item__sub">${espLabel}</span>
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
                app._sincronizarCancelacion(cita);

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
            app.navegar('citas');
            setTimeout(() => {
                app.citas.mostrarPaso(2);
            }, 100);
        },

        // ── Helper: Normalizar cita de invitado (mapeo de datos H1) ──
        /**
         * Busca la cita en sanitas_citas por ID y normaliza el campo `paciente`
         * que el store público no persiste (citas.js:1462 lo omite).
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
                        const n1 = (usuario.nombre_1 || usuario.nombre1 || '').trim();
                        const n2 = (usuario.nombre_2 || usuario.nombre2 || '').trim();
                        const a1 = (usuario.apellido_1 || usuario.apellido1 || '').trim();
                        const a2 = (usuario.apellido_2 || usuario.apellido2 || '').trim();
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
    app.init();
});
window.app = app;
