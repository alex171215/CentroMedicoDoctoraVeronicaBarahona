// ======================================================================
// CONFIGURACIÓN DEL PROTOTIPO (Usuario de prueba para evaluación)
// ======================================================================
(function inyectarUsuarioPrueba() {
    // Si no existe la base de datos de usuarios, la creamos
    if (!localStorage.getItem('sanitas_usuarios')) {
        const usuarioDemo = [{
            identificacion: "1722959465", // Cédula de prueba (ya validada)
            password: "admin",           // Contraseña simple
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



/**
 * app.js - Lógica principal del Centro Médico (Prototipo IHC)
 * Maneja la interactividad del DOM, Carrusel (7s) y Navegación SPA.
 */

const app = {
    // Variables de estado
    intervaloCarrusel: null,
    tiempoCarrusel: 7000, // 7 segundos exigidos por reglas de usabilidad (IHC)

    init: function () {
        this.iniciarMenuMovil();
        this.iniciarCarrusel();
        this.iniciarSesionUsuario();
        this.iniciarCarruselEspecialistas();
        this.renderizarEspecialidadesHome();
        app.login.inicializar();
        app.widgetInvitado.inicializar();

        // ── Bloque A: Inyectar límites de fecha (hoy → hoy + 2 meses) en todos los date inputs ──
        this._aplicarLimitesFechaGlobal();

        // 2. Escucha del evento 'popstate'
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.vista) {
                this.navegar(event.state.vista, false);
            } else {
                const hash = window.location.hash.replace('#', '');
                this.navegar(hash || 'home', false);
            }
        });

        // ── Expiración de borrador al volver a la pestaña ──
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && app.registro) {
                app.registro._verificarExpiracionBorrador();
            }
        });

        // 3. Carga Inicial (First Load)
        const hashInicial = window.location.hash.replace('#', '');
        if (hashInicial) {
            this.navegar(hashInicial, false);
        } else {
            history.replaceState({ vista: 'home' }, '', '#home');
        }

        console.log("Sistema del Centro Médico inicializado correctamente.");
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

    // ── Utilidad: Validación contextual de celular (H9 – Mensajes de error útiles) ──
    // Retorna el mensaje de error exacto (string) o null si el valor es válido.
    // Fuente única de verdad: usada por app.registro y app.citas.
    _validarCelular(valor) {
        const v = (valor || '').trim();
        if (v.length === 0) {
            return 'El celular es obligatorio.';
        }
        if (!/^\d+$/.test(v) || v.length !== 10) {
            return 'El celular debe tener exactamente 10 dígitos numéricos.';
        }
        if (!/^09/.test(v)) {
            return 'El celular debe comenzar con 09.';
        }
        if (/^(0{10}|09{9}0|090{8})$/.test(v) || /^(\d)\1{9}$/.test(v)) {
            return 'El número ingresado no es válido.';
        }
        return null; // Pasa todas las validaciones
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

        // Refrescar _citas en memoria del módulo salud
        if (app.salud && app.salud._citas) {
            const saludMatch = app.salud._citas.find(sc => {
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

    navegar: function (vistaId, pushState = true, force = false) {
        console.log(`Navegando a la vista: ${vistaId}`);

        // ── NUEVO: Guardar origen cuando se va a login ──
        if (vistaId === 'login') {
            const vistaActual = this.currentView || window.location.hash.replace('#', '') || 'home';
            sessionStorage.setItem('vista_origen', vistaActual);
            // Si venía de citas, guardar paso actual y datos del formulario
            if (vistaActual === 'citas' && app.citas) {
                app.citas._guardarEstadoParaLogin();
            }
        }

        // --- Garbage Collector de Recuperación ---
        if (vistaId !== 'citas') {
            sessionStorage.removeItem('temp_datos_recuperacion');
            if (app.citas) app.citas.modoProxy = false;
        }

        // 1. History API ...
        if (!force && pushState) {
            if (window.location.hash === '#' + vistaId) return;
            history.pushState({ vista: vistaId }, '', '#' + vistaId);
        } else if (pushState) {
            history.pushState({ vista: vistaId }, '', '#' + vistaId);
        }

        // 1. Actualizar estado activo en menú de escritorio
        const vistasPrincipales = ['home', 'especialistas', 'farmacia', 'contacto', 'citas'];
        const aplicaLinea = vistasPrincipales.includes(vistaId);

        const navLinks = document.querySelectorAll('.header__nav-link');
        navLinks.forEach(link => {
            link.classList.remove('header__nav-link--active');
            link.removeAttribute('aria-current');

            if (aplicaLinea) {
                const onclickAttr = link.getAttribute('onclick');
                if (onclickAttr) {
                    // Para "citas", también activamos el enlace que dispara agendarCitaGeneral()
                    if (vistaId === 'citas' && onclickAttr.includes('agendarCita')) {
                        link.classList.add('header__nav-link--active');
                        link.setAttribute('aria-current', 'page');
                    } else if (onclickAttr.includes(`'${vistaId}'`)) {
                        link.classList.add('header__nav-link--active');
                        link.setAttribute('aria-current', 'page');
                    }
                }
            }
        });

        // 2. Actualizar estado activo en menú inferior (Móvil)
        const bottomNavItems = document.querySelectorAll('.bottom-nav__item');
        bottomNavItems.forEach(item => {
            item.classList.remove('bottom-nav__item--active');
            item.removeAttribute('aria-current');

            if (aplicaLinea) {
                const onclickAttr = item.getAttribute('onclick');
                if (onclickAttr && onclickAttr.includes(`'${vistaId}'`)) {
                    item.classList.add('bottom-nav__item--active');
                    item.setAttribute('aria-current', 'page');
                }
            }
        });

        // 3. Mostrar/Ocultar secciones (SPA Logic)
        // Ocultar todas las view-sections
        const vistas = document.querySelectorAll('.view-section');
        vistas.forEach(v => v.style.display = 'none');

        // IHC SEGURIDAD: Limpiar login al salir de la pantalla
        if (this.login && typeof this.login.resetearFormulario === 'function') {
            this.login.resetearFormulario();
        }

        // ── Bloque C: Privacidad – Limpiar widget de invitados al navegar ──
        this._limpiarWidgetInvitado();

        // Mostrar u ocultar componentes principales
        const hero = document.querySelector('.hero');
        const locations = document.querySelector('.locations');
        const doctors = document.querySelector('.doctors');

        if (vistaId === 'home') {
            if (hero) hero.style.display = 'block';
            if (locations) locations.style.display = 'block';
            if (doctors) doctors.style.display = 'block';
            // Widget invitado: mostrar solo si no hay usuario logueado
            const widgetInv = document.getElementById('widget-invitado');
            if (widgetInv) {
                widgetInv.style.display = (localStorage.getItem('usuarioLogueado') === 'true') ? 'none' : 'block';
            }
            // Resetear la posición del carrusel de especialidades al inicio
            const doctorsGrid = document.getElementById('doctors-carousel');
            if (doctorsGrid) doctorsGrid.scrollLeft = 0;
            this._actualizarVisibilidadCarruselEspecialistas();
        } else {
            if (hero) hero.style.display = 'none';
            if (locations) locations.style.display = 'none';
            if (doctors) doctors.style.display = 'none';
            // Widget invitado: ocultar en cualquier vista que no sea Home
            const widgetInvOcultar = document.getElementById('widget-invitado');
            if (widgetInvOcultar) widgetInvOcultar.style.display = 'none';

            const vistaActiva = document.getElementById(`view-${vistaId}`);
            if (vistaActiva) {
                // Validación estricta para citas y nuevo Step Manager
                if (vistaId === 'citas') {
                    vistaActiva.style.display = 'block';
                    if (app.citas) app.citas.iniciarFlujo();
                } else if (vistaId === 'especialistas') {
                    vistaActiva.style.display = 'block';
                    if (app.directorio) app.directorio.inicializar();
                } else if (vistaId === 'farmacia') {
                    vistaActiva.style.display = 'block';
                    if (app.farmacia) app.farmacia.inicializar();
                } else if (vistaId === 'registro' || vistaId === 'registro-1') {
                    // La sección HTML tiene id="view-registro"
                    const vReg = document.getElementById('view-registro');
                    if (vReg) vReg.style.display = 'block';
                    if (app.registro) app.registro.inicializar();
                } else if (vistaId === 'editar-perfil') {
                    const vEdit = document.getElementById('view-editar-perfil');
                    if (vEdit) vEdit.style.display = 'block';
                } else if (vistaId === 'mi-salud') {
                    const vSalud = document.getElementById('view-mi-salud');
                    if (vSalud) vSalud.style.display = 'block';
                    if (app.salud) app.salud.inicializar();
                } else if (vistaId === 'contacto') {
                    if (vistaActiva) vistaActiva.style.display = 'block';
                } else {
                    vistaActiva.style.display = 'block';
                }
            }
        }
        // Forzar el scroll hacia arriba al cambiar de vista
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // ── NUEVO: Actualizar vista actual ──
        this.currentView = vistaId;
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
    // ======================================================================
    citas: {
        horaSeleccionada: null,
        pasoActual: 0,
        historialPasos: [],
        validadoresIniciados: false,


        // Diccionario de Iconos representativos para tus especialidades (FontAwesome 6)
        iconosEspecialidad: {
            "MEDICINA FAMILIAR": "fa-house-medical",
            "MEDICINA GENERAL": "fa-stethoscope",
            "RADIODIÁGNOSTICO": "fa-x-ray",
            "DERMATOLOGÍA": "fa-allergies",
            "UROLOGÍA": "fa-venus-mars",      // Sistema genitourinario
            "ENDOCRINOLOGÍA": "fa-droplet",   // Sangre/Hormonas/Metabolismo
            "TRAUMATOLOGÍA": "fa-bone",
            "PSICOLOGÍA": "fa-brain",
            "ODONTOLOGÍA": "fa-tooth",
            "ENFERMERÍA": "fa-user-nurse",
            "LABORATORIO": "fa-microscope",
            "GINECOLOGÍA": "fa-person-pregnant"
        },

        iniciarFlujo() {
            // ── NUEVO: Restauración post‑login desde citas ──
            const restoreStr = sessionStorage.getItem('citas_login_restore');
            if (restoreStr) {
                sessionStorage.removeItem('citas_login_restore');
                this._restaurarEstadoPostLogin(restoreStr);
                return;
            }

            // Limpiar errores visuales y estado anterior
            document.querySelectorAll('#view-citas .error-msg').forEach(msg => msg.style.display = 'none');
            document.querySelectorAll('#view-citas .form-control').forEach(input => {
                input.classList.remove('input-error', 'input-success');
                input.value = '';
            });

            if (!this.validadoresIniciados) {
                this.configurarValidadores();
                this.validadoresIniciados = true;
            }

            // MATA-BUGS: Resetear el paso actual a 0 ANTES de mostrar cualquier pantalla
            this.modoProxy = false;   // ← INSERTAR LÍNEA
            this.pasoActual = 0;
            this.historialPasos = [];

            // IHC FIX: SIEMPRE renderizar Paso 0 (Especialidades) al iniciar, 
            // así el DOM no está vacío si el usuario hace clic en "Volver".
            this.renderizarPasoEspecialidades();

            // Verificar si el usuario acaba de iniciar sesión desde el paso 3 de citas
            const citaDesdeLogin = sessionStorage.getItem('cita_desde_login');
            sessionStorage.removeItem('cita_desde_login'); // Se consume una sola vez

            const preCitaStr = sessionStorage.getItem('reservaCita_preseleccion');
            let preCita = null;
            try { preCita = JSON.parse(preCitaStr); } catch (e) { }
            const preEspecialidad = sessionStorage.getItem('especialidad_seleccionada');

            if (citaDesdeLogin === 'true' && preCita && preCita.medico) {
                // Restaurar horaSeleccionada desde sessionStorage si aún no está en memoria
                if (!this.horaSeleccionada) {
                    const horaGuardada = sessionStorage.getItem('cita_hora_seleccionada');
                    if (horaGuardada) this.horaSeleccionada = horaGuardada;
                }

                if (this.horaSeleccionada) {
                    // (paso 4 - Revisión)
                    this.pasoActual = 2; // necesario para que prepararResumenFinal no proteste
                    this.prepararResumenFinal(true);
                    this.mostrarPaso(4);
                    return; // Salimos de iniciarFlujo sin ejecutar el resto
                }
            }

            if (preCita && preCita.medico) {
                const esp = preEspecialidad || preCita.especialidad;
                const db = JSON.parse(localStorage.getItem('sanitasFam_db'));

                if (db && esp) {
                    const medicos = db.cartera_especialistas.filter(e => e.especialidad === esp && e.doctor);

                    // IHC FIX: Condicionar el historial según la cantidad de médicos disponibles
                    if (medicos.length > 1) {
                        this.renderizarPasoDoctores(esp, medicos);
                        this.historialPasos.push(0); // Guardamos que venimos del 0
                        this.pasoActual = 1;         // Nos situamos virtualmente en el 1
                    } else {
                        // Si hay 1 solo médico (o ninguno válido), NO inyectamos el Paso 1.
                        // Dejamos el pasoActual en 0 para que "Volver" regrese directo a las especialidades.
                        this.pasoActual = 0;
                    }
                }

                this.prepararResumenMedico(preCita.medico, esp, preCita.imagen_url);
                this.mostrarPaso(2); // Salta al calendario (2) guardando el historial correcto
                this.generarCalendario(true);
            } else if (preEspecialidad) {
                this.evaluarEspecialidad(preEspecialidad);
            } else {
                this.mostrarPaso(0);
            }
        },

        evaluarEspecialidad(especialidad) {
            sessionStorage.setItem('especialidad_seleccionada', especialidad);
            const db = JSON.parse(localStorage.getItem('sanitasFam_db'));
            if (!db || !db.cartera_especialistas) return;

            const medicos = db.cartera_especialistas.filter(e => e.especialidad === especialidad && e.doctor);

            if (medicos.length === 1) {
                const med = medicos[0];
                // ✅ NUEVO: guardar pre-selección para que el login sepa que hay cita en curso
                sessionStorage.setItem('reservaCita_preseleccion', JSON.stringify({
                    medico: med.doctor.nombre_completo,
                    especialidad: especialidad,
                    imagen_url: med.imagen_url
                }));
                this.prepararResumenMedico(med.doctor.nombre_completo, especialidad, med.imagen_url);
                this.mostrarPaso(2);
                this.generarCalendario(true);
            } else if (medicos.length > 1) {
                this.mostrarPaso(1);
                this.renderizarPasoDoctores(especialidad, medicos);
            } else {
                // Fallback por si no hay médicos en esa especialidad
                alert("Actualmente no hay especialistas disponibles para esta rama.");
            }
        },

        // Nueva función auxiliar para obtener la imagen exacta
        obtenerImagenMedico(nombreMed, especialidad, imgUrl) {
            if (imgUrl) return imgUrl; // Si ya viene de la tarjeta

            let imagenSrc = "";
            const nombreLower = (nombreMed || '').toLowerCase();
            const espLower = (especialidad || '').toLowerCase();

            if (nombreLower.includes('verónica') && nombreLower.includes('barahona')) {
                imagenSrc = 'assets/img/veronica-barahona.jpg';
            } else {
                if (espLower.includes('medicina familiar') || espLower.includes('medico familiar'))
                    imagenSrc = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&q=80';
                else if (espLower.includes('medicina general') || espLower.includes('general'))
                    imagenSrc = 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?q=80';
                else if (espLower.includes('pediatr'))
                    imagenSrc = 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&q=80';
                else if (espLower.includes('odontolog'))
                    imagenSrc = 'https://images.unsplash.com/photo-1681939282781-341ac4f61996?q=80';
                else if (espLower.includes('ginec')) {
                    if (nombreLower.includes('marcela') && nombreLower.includes('pantoja')) {
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
                    imagenSrc = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80';
            }
            return imagenSrc;
        },

        prepararResumenMedico(medicoNombre, especialidad, imgUrl) {
            document.getElementById('citas-doctor-name').textContent = medicoNombre;
            document.getElementById('citas-doctor-specialty').textContent = especialidad || '';
            const imagenCorrecta = this.obtenerImagenMedico(medicoNombre, especialidad, imgUrl);
            document.getElementById('citas-doctor-img').src = imagenCorrecta;

            // Nuevo: guardar el objeto médico completo
            const db = JSON.parse(localStorage.getItem('sanitasFam_db'));
            if (db && db.cartera_especialistas) {
                this._doctorActual = db.cartera_especialistas.find(
                    e => e.especialidad === especialidad && e.doctor && e.doctor.nombre_completo === medicoNombre
                ) || null;
            } else {
                this._doctorActual = null;
            }
        },

        // Inyectar especialidades dinámicas (Paso 0)
        renderizarPasoEspecialidades: function () {
            const db = JSON.parse(localStorage.getItem('sanitasFam_db'));
            if (!db || !db.cartera_especialistas) return;

            const contenedor = document.getElementById('citas-step-0');
            if (!contenedor) return;

            // Extraer especialidades únicas (omitiendo FARMACIA)
            const especialidadesSet = new Set();
            db.cartera_especialistas.forEach(medico => {
                if (medico.especialidad && medico.especialidad !== "FARMACIA") {
                    especialidadesSet.add(medico.especialidad);
                }
            });

            let html = '<div class="citas-step-content">';
            html += '<h3 class="text-center" style="margin-bottom: 30px; color: var(--text-main);">Escoja una Especialidad médica</h3>';
            html += '<div class="citas-specialty-grid">';

            especialidadesSet.forEach(esp => {
                // IHC Parche: Usar icono personalizado o estetoscopio por defecto
                const iconoClass = this.iconosEspecialidad[esp] || "fa-stethoscope";

                html += `
                    <button class="citas-specialty-btn" onclick="app.citas.evaluarEspecialidad('${esp}')">
                        <i class="fa-solid ${iconoClass}"></i>
                        <span>${esp}</span>
                    </button>
                `;
            });

            html += '</div></div>';
            contenedor.innerHTML = html;
        },

        renderizarPasoDoctores(especialidad, medicos) {
            const step1Content = document.getElementById('citas-step-1-content');
            let html = `<h2 style="text-align:center; color:#3B49A3; margin-bottom: 30px;">Especialistas en ${especialidad}</h2>`;
            html += `<div class="specialists-directory-grid">`;

            medicos.forEach(med => {
                // AQUÍ: Usamos la función para obtener la imagen
                const img = this.obtenerImagenMedico(med.doctor.nombre_completo, med.especialidad, med.imagen_url);

                html += `
                    <div class="doctor-card-dir">
                        <div class="doctor-card-dir__header">
                            <img src="${img}" alt="${med.doctor.nombre_completo}" class="doctor-card-dir__img">
                        </div>
                        <div class="doctor-card-dir__body">
                            <h3 class="doctor-card-dir__name">${med.doctor.nombre_completo}</h3>
                            <p class="doctor-card-dir__specialty">${med.especialidad}</p>
                            <div class="doctor-card-dir__actions" style="margin-top: 15px;">
                                <button onclick="app.citas.seleccionarDoctorParaCita('${med.doctor.nombre_completo}', '${med.especialidad}', '${img}')" class="btn btn--primario directory-card__btn">
                                    Seleccionar Médico
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            step1Content.innerHTML = html;
        },

        seleccionarDoctorParaCita(nombre, especialidad, img) {
            // Guardamos en memoria el médico, especialidad y la imagen que viene de la tarjeta
            sessionStorage.setItem('reservaCita_preseleccion', JSON.stringify({
                medico: nombre,
                especialidad: especialidad,
                imagen_url: img
            }));

            // Llamamos a la función que ya existe para actualizar la interfaz
            this.prepararResumenMedico(nombre, especialidad, img);
            this.mostrarPaso(2);
            this.generarCalendario(true);
        },

        mostrarPaso(nuevoPaso) {
            if (this.pasoActual !== nuevoPaso) {
                if (this.historialPasos[this.historialPasos.length - 1] !== this.pasoActual) {
                    this.historialPasos.push(this.pasoActual);
                }
            }

            document.querySelectorAll('.citas-step').forEach(el => el.style.display = 'none');
            document.getElementById(`citas-step-${nuevoPaso}`).style.display = 'block';
            this.pasoActual = nuevoPaso;

            this.actualizarBarraProgreso();

            // --- INSERCIÓN: Auto-Completado para Recuperación de Errores (Heurística Nielsen) ---
            // --- INSERCIÓN: Auto-Completado tras recuperación de error ---
            if (nuevoPaso === 3) {
                const recoveryData = sessionStorage.getItem('temp_datos_recuperacion');
                if (recoveryData) {
                    try {
                        const data = JSON.parse(recoveryData);
                        const nomInput = document.getElementById('citas-nombres');
                        const cedInput = document.getElementById('citas-cedula');
                        const celInput = document.getElementById('citas-celular');

                        if (nomInput && data.nombres) nomInput.value = data.nombres;
                        if (cedInput && data.cedula) cedInput.value = data.cedula;
                        if (celInput && data.celular) celInput.value = data.celular;

                        // Consumir el dato para que no quede residual
                        sessionStorage.removeItem('temp_datos_recuperacion');
                    } catch (e) { }
                }

                const estaLogueado = localStorage.getItem('usuarioLogueado') === 'true';
                const step3Form = document.getElementById('citas-step-3');
                if (step3Form) {
                    // Elementos que vamos a manipular
                    const loginH2 = step3Form.querySelector('h2');         // "¿Ya registrado? Acceder"
                    const oDiv = step3Form.querySelector('h2 + div');       // "O"
                    const registroH3 = step3Form.querySelector('h3');       // "¿Todavía no está registrado?"
                    const formLabel = step3Form.querySelector('h3 + form > div:first-child label'); // Etiqueta "Nombres completos"

                    // Si estamos en modo proxy (logueado agendando para familiar)
                    if (estaLogueado && this.modoProxy) {
                        // Ocultar enlaces de login/registro
                        if (loginH2) loginH2.style.display = 'none';
                        if (oDiv) oDiv.style.display = 'none';
                        if (registroH3) registroH3.style.display = 'none';

                        // Insertar o actualizar título e instrucción
                        let titleEl = document.getElementById('proxy-paso3-title');
                        if (!titleEl) {
                            titleEl = document.createElement('h2');
                            titleEl.id = 'proxy-paso3-title';
                            titleEl.style.cssText = 'color: #3B49A3; margin-bottom: 10px; text-align: center; font-size: 1.2rem;';
                            const formWrapper = step3Form.querySelector('.citas-form-wrapper');
                            if (formWrapper) {
                                formWrapper.insertBefore(titleEl, formWrapper.firstChild);
                            }
                        }
                        titleEl.textContent = 'Registro de Familiar';

                        let instEl = document.getElementById('proxy-paso3-inst');
                        if (!instEl) {
                            instEl = document.createElement('p');
                            instEl.id = 'proxy-paso3-inst';
                            instEl.style.cssText = 'text-align: center; color: #666; margin-bottom: 20px; font-size: 0.95rem;';
                            if (titleEl.nextSibling) {
                                titleEl.parentNode.insertBefore(instEl, titleEl.nextSibling);
                            }
                        }
                        instEl.textContent = 'Ingrese los datos personales de su familiar para esta reserva.';
                    } else {
                        // Modo invitado (sin sesión)
                        // Mostrar login/registro normalmente
                        if (loginH2) loginH2.style.display = '';
                        if (oDiv) oDiv.style.display = '';
                        if (registroH3) registroH3.style.display = '';

                        // Actualizar a "Datos del Paciente"
                        if (registroH3) {
                            registroH3.textContent = 'Ingrese los datos del Paciente';
                            registroH3.style.color = '#3B49A3';
                        }
                        // Eliminar cualquier título/instrucción de proxy si existe
                        const proxyTitle = document.getElementById('proxy-paso3-title');
                        if (proxyTitle) proxyTitle.remove();
                        const proxyInst = document.getElementById('proxy-paso3-inst');
                        if (proxyInst) proxyInst.remove();
                    }
                }

                // Llamadas existentes de modificación y validadores
                this._configurarPaso3Modificacion();
                if (!this.validadoresIniciados) {
                    this.configurarValidadores();
                    this.validadoresIniciados = true;
                } else {
                    this.actualizarEstadoBotonSiguiente();
                }
            }
            // --- INSERCIÓN: Renderizado del nuevo Paso 4 (Revisión) ---
            if (nuevoPaso === 4) {
                if (this._citaTemporal) {
                    this._mostrarResumen(this._citaTemporal);
                } else {
                    // Si no hay datos, volver al paso 2 por seguridad
                    this.mostrarPaso(2);
                    return;
                }
            }

            // --- FIN DE LA INSERCIÓN ---

            // Resetear modoProxy al entrar al paso 2 (por si venía de otro flujo)
            if (this.pasoActual !== 2 && nuevoPaso === 2) {
                this.modoProxy = false;
            }

            // ── Regla G: Consistencia de Etiqueta del botón Volver en Paso 2 ──
            // El texto del botón debe coincidir con el destino real del retroceso.
            // Si hay 1 médico → destino es Especialidades (Paso 0).
            // Si hay >1 médico → destino es Médicos (Paso 1).
            if (nuevoPaso === 2) {
                const backBtnPaso2 = document.querySelector('#citas-step-2 .btn-back-minimalist');
                if (backBtnPaso2) {
                    const numMedicos = this._contarMedicosEspecialidad();
                    if (numMedicos === 1) {
                        backBtnPaso2.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Volver a Especialidades';
                    } else {
                        backBtnPaso2.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Volver a Médicos';
                    }
                }
            }

            // --- FIN DE LA INSERCIÓN ---
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // ─── Paso 4: inyectar aviso si es modificación ───
            // ─── Paso 5: inyectar aviso si es modificación ───
            // ─── Paso 5: inyectar aviso si es modificación ───
            if (nuevoPaso === 5 && sessionStorage.getItem('cita_modificacion')) {
                const step5 = document.getElementById('citas-step-5');
                // Evitar duplicados
                let alertInfo = step5.querySelector('.alert-info-mod');
                if (!alertInfo) {
                    alertInfo = document.createElement('div');
                    alertInfo.className = 'alert-info-mod';
                    alertInfo.innerHTML = '<strong>✅ Identidad Mantenida:</strong> Los datos del paciente (Nombre, Cédula y Celular) se conservan de la cita original.';
                    // Insertar al inicio del contenedor de resumen (el div que tiene max-width:600px...)
                    // Buscar ese contenedor específico dentro de step-4
                    const resumenContainer = step5.querySelector('.citas-step > div:first-child');
                    if (resumenContainer) {
                        resumenContainer.insertBefore(alertInfo, resumenContainer.firstChild);
                    } else {
                        step5.insertBefore(alertInfo, step5.firstChild);
                    }
                }
            }
        },

        // ── Helper: cuenta los médicos de la especialidad activa en la DB ──
        // Retorna el número de doctores válidos para sessionStorage:'especialidad_seleccionada'.
        // Usado por irAtras() y mostrarPaso() para aplicar la Regla G.
        _contarMedicosEspecialidad() {
            const esp = sessionStorage.getItem('especialidad_seleccionada');
            if (!esp) return 0;
            try {
                const db = JSON.parse(localStorage.getItem('sanitasFam_db'));
                if (!db || !db.cartera_especialistas) return 0;
                return db.cartera_especialistas.filter(e => e.especialidad === esp && e.doctor).length;
            } catch (e) { return 0; }
        },

        irAtras() {
            // ── Regla de Oro de Retorno (Navegación Secuencial Determinista) ──
            // Fuente única de verdad para TODO retroceso en el módulo de citas.
            //
            // Flujo Titular Logueado: 4 → 2 → 1 → 0  (Paso 3 se omite porque no lo visitó)
            // Flujo Invitado / Proxy: 4 → 3 → 2 → 1 → 0  (orden inverso estricto)

            const esTitularLogueado = localStorage.getItem('usuarioLogueado') === 'true' && !this.modoProxy;

            // Caso especial: Titular en Paso 4 salta directamente al Paso 2 (Calendario)
            if (this.pasoActual === 4 && esTitularLogueado) {
                this.mostrarPaso(2);
                return;
            }

            // ── Regla G: Asimetría de Retorno (Back-jump Condicional) ──
            // Si el usuario está en el Calendario (Paso 2) y la especialidad tiene
            // exactamente 1 médico, nunca pasó por el Paso 1 (lista de médicos).
            // Ir a Paso 1 mostraría una pantalla vacía → se salta directamente al Paso 0.
            if (this.pasoActual === 2 && this._contarMedicosEspecialidad() === 1) {
                const imgEl = document.getElementById('citas-doctor-img');
                if (imgEl) imgEl.src = '';
                this.mostrarPaso(0);
                return;
            }

            // Caso general: retroceder N-1
            const pasoDeterminista = this.pasoActual - 1;

            if (pasoDeterminista >= 0) {
                // MATA-BUGS VISUAL: Al salir del Calendario (Paso 2), limpiar imagen
                // para evitar flash con la foto del médico equivocado la próxima vez.
                if (this.pasoActual === 2) {
                    const imgEl = document.getElementById('citas-doctor-img');
                    if (imgEl) imgEl.src = '';
                }
                this.mostrarPaso(pasoDeterminista);
            } else {
                // Fallback de seguridad: si ya estamos en el paso 0, salir de citas
                app.navegar('home');
            }
        },

        avanzarPaso() {
            if (this.pasoActual === 2) {
                const estaLogueado = localStorage.getItem('usuarioLogueado');

                // ─── Lógica de modificación se mantiene idéntica ───
                const modCtxStr = sessionStorage.getItem('cita_modificacion');
                if (modCtxStr) {
                    let modCtx;
                    try { modCtx = JSON.parse(modCtxStr); } catch (e) { }
                    if (!estaLogueado && modCtx) {
                        const misCitas = JSON.parse(localStorage.getItem('sanitas_mis_citas') || '[]');
                        let citaOriginal = null;
                        if (modCtx.id_cita) {
                            citaOriginal = misCitas.find(c => (c.id_cita === modCtx.id_cita || c.id === modCtx.id_cita || c._id === modCtx.id_cita));
                        }
                        if (!citaOriginal) {
                            citaOriginal = misCitas.find(c =>
                                c.cedula === modCtx.cedula && c.medico === modCtx.medico && c.fecha === modCtx.fechaVieja && c.hora === modCtx.horaVieja
                            );
                        }
                        if (citaOriginal) {
                            const nomInput = document.getElementById('citas-nombres');
                            const cedInput = document.getElementById('citas-cedula');
                            if (nomInput) nomInput.value = citaOriginal.paciente || '';
                            if (cedInput) cedInput.value = citaOriginal.cedula || '';
                            this._verificarColisionYContinuar(false);
                            return;
                        }
                    }
                }

                // ─── PROXY: si elige "Para un familiar" mostramos Paso 3 vacío ───
                if (estaLogueado && this.modoProxy) {
                    // Mostrar paso 3 del formulario
                    this.mostrarPaso(3);
                    // Forzar campos vacíos y editables (sin datos de modificación)
                    ['citas-nombres', 'citas-cedula', 'citas-celular'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) {
                            el.value = '';
                            el.removeAttribute('readonly');
                            el.style.borderColor = '#ccc';
                        }
                    });
                    // Eliminar mensaje de modificación si existiera
                    const modMsg = document.getElementById('modificacion-msg');
                    if (modMsg) modMsg.remove();
                    // Iniciar validadores del paso 3
                    if (!this.validadoresIniciados) {
                        this.configurarValidadores();
                        this.validadoresIniciados = true;
                    } else {
                        this.actualizarEstadoBotonSiguiente();
                    }
                    return;
                }

                // ── BR-2/BR-3: Trigger de Identidad ──
                // El titular logueado salta directamente al resumen (Paso 4).
                // Las colisiones y buffer se validan en confirmarCita() con su cédula confirmada.
                if (estaLogueado) {
                    this.prepararResumenFinal(true);
                    this.mostrarPaso(4);
                } else {
                    this.mostrarPaso(3);
                    this._configurarPaso3Modificacion();
                    if (!this.validadoresIniciados) {
                        this.configurarValidadores();
                        this.validadoresIniciados = true;
                    } else {
                        this.actualizarEstadoBotonSiguiente();
                    }
                }
            } else if (this.pasoActual === 3) {
                if (!this.validarPaso3(true)) return;
                const logueadoReal = localStorage.getItem('usuarioLogueado') === 'true';

                // --- VALIDACIÓN DE LÍMITE DIARIO ---
                let cedulaParaLimite = '';
                if (logueadoReal && this.modoProxy) {
                    // Modo proxy: usar cédula del formulario
                    const inputCed = document.getElementById('citas-cedula');
                    if (inputCed) cedulaParaLimite = inputCed.value.trim();
                } else if (!logueadoReal) {
                    // Invitado: usar cédula del formulario
                    const inputCed = document.getElementById('citas-cedula');
                    if (inputCed) cedulaParaLimite = inputCed.value.trim();
                } else {
                    // Loguedado para sí mismo: se validará en el paso 4, aquí no aplica
                }
                if (cedulaParaLimite) {
                    const fechaISO = this.fechaISOSeleccionada || sessionStorage.getItem('cita_fecha_iso');
                    const especialidad = sessionStorage.getItem('especialidad_seleccionada') || document.getElementById('citas-doctor-specialty')?.textContent?.trim() || '';
                    let idExcluir = null;
                    const modCtxStr = sessionStorage.getItem('cita_modificacion');
                    if (modCtxStr) {
                        try { const modCtx = JSON.parse(modCtxStr); idExcluir = modCtx.id_cita; } catch (e) { }
                    }
                    // [BR-1 Debug] Auditoría Paso 3 (Invitado / Proxy)
                    console.log('[BR-1 Debug] Trigger Paso 3', { cedula: cedulaParaLimite, fechaISO, especialidad, idExcluir });
                    if (this._verificarLimiteDiario(cedulaParaLimite, fechaISO, especialidad, idExcluir)) {
                        // Pasar fechaISO al modal, nunca texto legible
                        this._mostrarModalLimiteDiario(especialidad, fechaISO);
                        return;
                    }
                }
                // --- FIN VALIDACIÓN ---

                this._verificarColisionYContinuar(logueadoReal);
            }
        },
        // Verifica si el paciente ya tiene una cita en la misma especialidad el mismo día.
        // Retorna true si YA EXISTE una cita que incumple el límite (debe bloquearse).
        _verificarLimiteDiario(cedulaPaciente, fecha, especialidad, idCitaExcluida = null) {
            if (!cedulaPaciente || !fecha || !especialidad) return false;
            // Obtener citas del store público (sanitas_citas) para cubrir invitados y logueados.
            const citas = JSON.parse(localStorage.getItem('sanitas_citas') || '[]');
            // BR-1: Normalizar ESTRICTAMENTE el argumento a YYYY-MM-DD.
            // Si viene un ISO completo (YYYY-MM-DDTHH:mm:ss), recortar a los primeros 10 chars.
            // Si viene en cualquier otro formato legible, la validación falla de forma segura (no bloquea).
            const ISO_REGEX = /^\d{4}-\d{2}-\d{2}/;
            if (!ISO_REGEX.test(fecha)) return false; // Fecha no está en formato ISO → no bloquear
            const fechaNorm = fecha.substring(0, 10); // Siempre YYYY-MM-DD
            const encontrada = citas.find(c => {
                // technical-requirements.md: el campo de cédula en sanitas_citas es 'cedula_paciente'
                const cCedula = String(c.cedula_paciente || c.cedula || '').trim();
                if (cCedula !== String(cedulaPaciente).trim()) return false;
                if (c.especialidad !== especialidad) return false;
                if (c.estado === 'Cancelada') return false;
                // BR-1: Normalizar el campo del store de la misma manera (manzanas con manzanas).
                // c.fecha puede ser ISO completo o YYYY-MM-DD; recortar a 10 chars.
                const cFecha = (c.fecha || '').trim().substring(0, 10);
                if (!ISO_REGEX.test(cFecha)) return false; // Dato corrupto en store → ignorar
                if (cFecha !== fechaNorm) return false;
                // Excluir la misma cita si se está modificando
                if (idCitaExcluida && (c.id_cita === idCitaExcluida || c.id === idCitaExcluida)) return false;
                return true;
            });
            return !!encontrada;
        },

        _verificarColisionYContinuar(logueado) {
            let cedulaPaciente = "";
            if (logueado && !this.modoProxy) {
                // Si está logueado y agenda para sí mismo: usar su propia cédula
                try {
                    const userActivoStr = localStorage.getItem('usuarioActivo');
                    if (userActivoStr) {
                        const user = JSON.parse(userActivoStr);
                        cedulaPaciente = user.identificacion || "";
                    }
                } catch (e) { }
            } else {
                // En modo proxy (logueado pero para familiar) o invitado: usar la cédula ingresada en el formulario
                const inputCedula = document.getElementById('citas-cedula');
                if (inputCedula) cedulaPaciente = inputCedula.value.trim();
            }

            const fechaHoraStr = this.horaSeleccionada;
            let fecha = fechaHoraStr, hora = '';
            if (fechaHoraStr && fechaHoraStr.includes(',')) {
                const [datePart, timePart] = fechaHoraStr.split(', ');
                fecha = datePart;
                hora = timePart;
            }
            const fechaISO = this.fechaISOSeleccionada || sessionStorage.getItem('cita_fecha_iso');

            // Obtener duración de la cita que se está agendando
            const doc = this._doctorActual;
            const duracionNueva = doc ? (doc.duracion_minutos || 30) : 30;

            // --- Verificación de colisión exacta ---
            const modCtxStr = sessionStorage.getItem('cita_modificacion');
            let modCtx = null;
            try { modCtx = JSON.parse(modCtxStr); } catch (e) { }

            const citasPublicas = JSON.parse(localStorage.getItem('sanitas_citas') || '[]');
            // En modo proxy, garantizamos que se toma la cédula del formulario aunque logueado sea true
            if (logueado && this.modoProxy) {
                const inputCedula = document.getElementById('citas-cedula');
                if (inputCedula) cedulaPaciente = inputCedula.value.trim();
            }
            const citaColision = citasPublicas.find(c =>
                c.cedula === cedulaPaciente &&
                c.fecha === fechaISO &&
                c.hora === hora &&
                c.estado !== 'Cancelada'
            );

            let esColisionMismaCita = false;
            if (citaColision && modCtx) {
                if (modCtx.cedula === citaColision.cedula && modCtx.fechaVieja === citaColision.fecha && modCtx.horaVieja === citaColision.hora) {
                    esColisionMismaCita = true;
                }
            }

            if (citaColision && !esColisionMismaCita) {
                this._mostrarModalColision(citaColision, fecha, hora, fechaISO);
                return;
            }

            // --- Verificación de buffer (30 min bidireccional) ---
            const [hNueva, mNueva] = hora.split(':').map(Number);
            const inicioMinNueva = hNueva * 60 + mNueva;
            const finMinNueva = inicioMinNueva + duracionNueva;

            const citasMismoDia = citasPublicas.filter(c =>
                c.cedula === cedulaPaciente &&
                c.fecha === fechaISO &&
                c.estado !== 'Cancelada'
            );

            const idCitaModificando = modCtx ? (modCtx.id_cita || modCtx.idCita) : null;

            const db = JSON.parse(localStorage.getItem('sanitasFam_db'));
            for (const cita of citasMismoDia) {
                if (idCitaModificando && (cita.id_cita === idCitaModificando || cita.id === idCitaModificando)) continue;

                let duracionExistente = 30;
                if (db && db.cartera_especialistas) {
                    const esp = db.cartera_especialistas.find(e => e.especialidad === cita.especialidad);
                    if (esp) duracionExistente = esp.duracion_minutos || 30;
                }

                const [hExt, mExt] = cita.hora.split(':').map(Number);
                const inicioMinExistente = hExt * 60 + mExt;
                const finMinExistente = inicioMinExistente + duracionExistente;

                // Condición de solapamiento con buffer de 30 min a cada lado
                if ((finMinNueva + 30 > inicioMinExistente) && (finMinExistente + 30 > inicioMinNueva)) {
                    // Calcular la hora sugerida: fin de la cita existente + 30 min
                    const minSugerido = finMinExistente + 30;
                    const hSug = Math.floor(minSugerido / 60);
                    const mSug = minSugerido % 60;
                    const horaSugerida = `${String(hSug).padStart(2, '0')}:${String(mSug).padStart(2, '0')}`;

                    const detalle = `${cita.especialidad || 'Especialidad'} con ${cita.medico || 'Médico'} a las ${cita.hora}`;
                    this._mostrarModalBuffer(detalle, duracionExistente, horaSugerida);
                    return;
                }
            }
            console.log('[Colisión] Cédula a verificar:', cedulaPaciente, ' | Modo proxy:', this.modoProxy);

            // Si todo ok, continuar
            this.prepararResumenFinal(logueado);
            this.mostrarPaso(4);
        },
        // Dentro de app.citas

        _mostrarModalColision(cita, fecha, hora, fechaISO) {
            let modal = document.getElementById('modal-colision-cita');
            if (modal) modal.remove();

            modal = document.createElement('div');
            modal.id = 'modal-colision-cita';
            modal.className = 'modal-overlay';
            modal.setAttribute('role', 'alertdialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'modal-colision-title');
            modal.style.display = 'flex';
            // Bloquear interacción con el fondo
            modal.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
            });

            // Construir mensaje enriquecido
            const nombreMedico = cita.medico || 'Médico';
            const especialidad = cita.especialidad || 'la especialidad';

            modal.innerHTML = `
                <div class="modal-content modal-colision-content" id="colision-content-inner">
                    <i class="fa-solid fa-triangle-exclamation fa-3x alert-colision-icon" aria-hidden="true"></i>
                    <h2 id="modal-colision-title" class="modal-colision-title">Conflicto de Horario Detectado</h2>
                    <p class="modal-colision-text">
                        Ya tienes una cita agendada en <strong>${especialidad}</strong> con el/la <strong>${nombreMedico}</strong> para el <strong>${fecha}</strong> a las <strong>${hora}</strong>.
                        El sistema no permite duplicidad de horarios para un mismo paciente.
                    </p>
                    <div class="modal-colision-actions">
                        <!-- Botón Principal: Elegir otra hora -->
                        <button id="btn-colision-otra" class="btn btn--primario btn-full-width btn-margin-bottom">
                            Elegir otra hora
                        </button>

                        <!-- Botón secundario: Gestionar cita previa -->
                        <button id="btn-gestionar-cita" class="btn btn--secundario btn-full-width">
                            <i class="fa-solid fa-gear" aria-hidden="true" style="margin-right: 8px;"></i> Gestionar cita anterior
                        </button>
                        <p class="text-warning-small">(⚠️ Abandonarás esta pantalla y perderás la selección actual)</p>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Asignar eventos manualmente para acceder a la variable cita sin riesgo de inyección
            document.getElementById('btn-colision-otra').addEventListener('click', () => {
                this.cerrarModalColision();
                this.resetearSeleccionOtraHora();
            });

            document.getElementById('btn-gestionar-cita').addEventListener('click', () => {
                this._mostrarConfirmacionGestion(cita, fecha, hora, fechaISO);
            });
        },

        // Agregar justo después de _mostrarModalColision

        _mostrarConfirmacionGestion(cita, fecha, hora, fechaISO) {
            this._citaEnConflicto = cita;   // ← guardar referencia

            const modal = document.getElementById('modal-colision-cita');
            if (!modal) return;
            const contentDiv = modal.querySelector('#colision-content-inner');
            if (!contentDiv) return;

            this._colisionOriginalHtml = contentDiv.innerHTML;

            contentDiv.innerHTML = `
                <i class="fa-solid fa-circle-exclamation fa-3x alert-colision-icon" aria-hidden="true" style="color: #e67e22;"></i>
                <h2 style="margin-bottom: 15px; color: var(--text-main);">¿Ir a la cita anterior?</h2>
                <p class="modal-colision-text" style="color: var(--gray-text); margin-bottom: 20px;">
                    Si vas a gestionar tu cita anterior, la reserva actual se descartará. ¿Deseas continuar?
                </p>
                <div class="modal-colision-actions">
                    <button id="btn-volver-opciones" class="btn btn--secundario btn-full-width btn-margin-bottom">
                        Cancelar (Volver a las opciones)
                    </button>
                    <button id="btn-ir-cita-anterior" class="btn btn--primario btn-full-width">
                        Sí, ir a mi cita anterior
                    </button>
                </div>
            `;

            document.getElementById('btn-volver-opciones').addEventListener('click', () => {
                this._restaurarModalColision();
            });

            document.getElementById('btn-ir-cita-anterior').addEventListener('click', () => {
                this.cerrarModalColision();
                this.gestionarConflicto(cita.codigo || '', cita.cedula, fechaISO, cita.id_cita);
            });
        },

        _restaurarModalColision() {
            const contentDiv = document.getElementById('colision-content-inner');
            if (contentDiv && this._colisionOriginalHtml) {
                contentDiv.innerHTML = this._colisionOriginalHtml;

                // Reasignar eventos con la cita guardada
                const cita = this._citaEnConflicto;
                document.getElementById('btn-colision-otra').addEventListener('click', () => {
                    this.cerrarModalColision();
                    this.resetearSeleccionOtraHora();
                });

                document.getElementById('btn-gestionar-cita').addEventListener('click', () => {
                    this._mostrarConfirmacionGestion(cita, '', '', '');   // fecha/hora no se usan en el mensaje de confirmación
                });
            }
        },

        mostrarConfirmacionCancelacion(idCita, callback) {
            // Reutilizar modal existente o crear uno nuevo
            let modal = document.getElementById('modal-confirmar-cancelacion');
            if (modal) modal.remove();

            modal = document.createElement('div');
            modal.id = 'modal-confirmar-cancelacion';
            modal.className = 'modal-overlay';
            modal.setAttribute('role', 'alertdialog');
            modal.setAttribute('aria-modal', 'true');

            // ── FASE 1: Advertencia (H5 - Prevención de Errores) ──
            // Muestra el mensaje de riesgo y dos botones claros antes de actuar.
            // .btn--peligro para la acción destructiva, .btn--secundario para el escape.
            modal.innerHTML = `
                <div class="modal-content modal-colision-content">
                    <i class="fa-solid fa-circle-exclamation fa-3x alert-colision-icon" aria-hidden="true"></i>
                    <h2 class="modal-colision-title">Cancelar Cita</h2>
                    <p class="modal-colision-text">
                        ¿Estás seguro de que deseas cancelar esta cita? Esta acción no se puede deshacer.
                    </p>
                    <div class="modal-colision-actions">
                        <button id="btn-cancelar-no" class="btn btn--secundario btn-full-width btn-margin-bottom">
                            No, mantener cita
                        </button>
                        <button id="btn-cancelar-si" class="btn btn--peligro btn-full-width">
                            Sí, cancelar cita
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Escape: cerrar sin acción
            document.getElementById('btn-cancelar-no').addEventListener('click', () => {
                modal.remove();
            });

            // Confirmar: Fase 2 → Fase 3 → Fase 4
            document.getElementById('btn-cancelar-si').addEventListener('click', () => {
                const btnSi = document.getElementById('btn-cancelar-si');
                const btnNo = document.getElementById('btn-cancelar-no');

                // ── FASE 2: Procesando (H1 - Visibilidad del Estado del Sistema) ──
                if (btnSi) { btnSi.disabled = true; btnSi.textContent = 'Cancelando...'; }
                if (btnNo) { btnNo.disabled = true; }

                // Simula latencia de red (800ms) antes de persistir el cambio
                setTimeout(() => {
                    // Ejecutar la lógica real de cancelación en localStorage
                    if (typeof callback === 'function') callback(idCita);

                    // ── FASE 3: Resolución / Punto Final (H4 - Consistencia) ──
                    // El modal NO se cierra automáticamente: transiciona al estado de éxito.
                    const contenido = modal.querySelector('.modal-content');
                    if (contenido) {
                        contenido.innerHTML = `
                            <i class="fa-solid fa-circle-check icono-exito-modal" aria-hidden="true"></i>
                            <h2 class="modal-colision-title">Cita Cancelada</h2>
                            <p class="modal-colision-text">
                                La cita ha sido cancelada exitosamente y el horario ha sido liberado.
                            </p>
                            <button id="btn-cerrar-resolucion" class="btn btn--primario btn-full-width">
                                Entendido
                            </button>
                        `;

                        // ── FASE 4: Cierre y Refresco (Feedback Controlado) ──
                        // El usuario controla cuándo sale. Al cerrar, se actualiza la lista.
                        document.getElementById('btn-cerrar-resolucion').addEventListener('click', () => {
                            modal.remove();
                            // Refrescar la lista de citas del dashboard si el módulo está activo
                            if (typeof app.salud?.renderizarCitas === 'function') {
                                app.salud.renderizarCitas(app.salud._filtroActual || 'proximas');
                            }
                        });
                    }
                }, 800);
            });
        },

        cerrarModalColision() {
            const modal = document.getElementById('modal-colision-cita');
            if (modal) modal.remove();
        },

        resetearSeleccionOtraHora() {
            // Limpiar selección de hora
            this._bloquearConfirmar();
            document.querySelectorAll('#citas-calendar-grid .time-slot--selected').forEach(el => el.classList.remove('time-slot--selected'));
            // Regresar al paso 2 si estaba en el 3
            if (this.pasoActual === 3) {
                this.mostrarPaso(2);
            }
        },

        _guardarEstadoParaLogin() {
            const paso = this.pasoActual;
            const data = { paso };
            if (paso === 3) {
                const nom = document.getElementById('citas-nombres')?.value.trim() || '';
                const ced = document.getElementById('citas-cedula')?.value.trim() || '';
                const cel = document.getElementById('citas-celular')?.value.trim() || '';
                data.formData = { nombres: nom, cedula: ced, celular: cel };
            }
            sessionStorage.setItem('citas_login_restore', JSON.stringify(data));
        },

        _restaurarEstadoPostLogin(restoreStr) {
            let restoreData;
            try { restoreData = JSON.parse(restoreStr); } catch (e) { return; }
            const { paso, formData } = restoreData;

            // Limpiar cualquier error visual
            document.querySelectorAll('#view-citas .error-msg').forEach(msg => msg.style.display = 'none');

            // Actualizar resumen del médico si es necesario
            const preCitaStr = sessionStorage.getItem('reservaCita_preseleccion');
            const especialidad = sessionStorage.getItem('especialidad_seleccionada');
            if (preCitaStr && especialidad) {
                try {
                    const preCita = JSON.parse(preCitaStr);
                    if (preCita.medico) {
                        this.prepararResumenMedico(preCita.medico, especialidad, preCita.imagen_url);
                    }
                } catch (e) { }
            }

            // Restaurar paso y limpiar historial
            this.pasoActual = paso;
            this.historialPasos = [];

            if (paso === 2) {
                this.generarCalendario();
                // Re‑seleccionar la hora previamente elegida
                const horaGuardada = sessionStorage.getItem('cita_hora_seleccionada');
                if (horaGuardada) {
                    this.horaSeleccionada = horaGuardada;
                    const fechaISO = sessionStorage.getItem('cita_fecha_iso');
                    this._seleccionarSlotVisual(horaGuardada, fechaISO);
                }
                this.mostrarPaso(2);  // ← necesario porque generamos calendario sin cambiar paso
            } else if (paso === 3) {
                // ── Usuario ya está logueado: saltar directamente a Resumen (Paso 4) ──
                if (!this.horaSeleccionada) {
                    const horaGuardada = sessionStorage.getItem('cita_hora_seleccionada');
                    if (horaGuardada) this.horaSeleccionada = horaGuardada;
                    const fechaISO = sessionStorage.getItem('cita_fecha_iso');
                    if (fechaISO) this.fechaISOSeleccionada = fechaISO;
                }
                this.modoProxy = false;

                if (this.horaSeleccionada) {
                    this.prepararResumenFinal(true);  // esto llama internamente a mostrarPaso(4)
                } else {
                    this.generarCalendario();
                    this.mostrarPaso(2);
                }
                // ⚠️ No se vuelve a llamar a mostrarPaso(paso) después de esta rama
            } else {
                // Para pasos 0, 1 o cualquier otro, simplemente se muestra el paso correspondiente
                this.mostrarPaso(paso);
            }
        },

        // Helper para encontrar y resaltar el slot visualmente
        _seleccionarSlotVisual(horaLabel, fechaISO) {
            const slots = document.querySelectorAll('#citas-calendar-grid .time-slot');
            for (const slot of slots) {
                const onclickAttr = slot.getAttribute('onclick');
                if (onclickAttr) {
                    // El formato del onclick es: app.citas.seleccionarHora(this, '${label}', '${fechaISO}')
                    const match = onclickAttr.match(/seleccionarHora\(this,\s*'([^']+)',\s*'([^']*)'\)/);
                    if (match && match[1] === horaLabel) {
                        slot.classList.add('time-slot--selected');
                        // Actualizar el botón de confirmación
                        const btnConfirmar = document.getElementById('btn-confirmar-cita');
                        if (btnConfirmar) {
                            btnConfirmar.style.opacity = '1';
                            btnConfirmar.style.pointerEvents = 'auto';
                            btnConfirmar.disabled = false;
                        }
                        break;
                    }
                }
            }
        },

        gestionarConflicto(codigo, cedula, fechaISO, idCita) {
            // 1. Limpiar flujo actual (igual que antes)
            this.horaSeleccionada = null;
            this.fechaISOSeleccionada = null;
            sessionStorage.removeItem('cita_hora_seleccionada');
            sessionStorage.removeItem('cita_fecha_iso');
            document.querySelectorAll('#citas-calendar-grid .time-slot--selected').forEach(el => el.classList.remove('time-slot--selected'));
            this._bloquearConfirmar();

            const estaLogueado = localStorage.getItem('usuarioLogueado') === 'true';

            if (!estaLogueado) {
                // Guardar el id de la cita para abrir su detalle automáticamente
                app.widgetInvitado._pendingDetailId = idCita;

                app.navegar('home');

                setTimeout(() => {
                    const inputCedula = document.getElementById('widget-cedula');
                    const inputFecha = document.getElementById('widget-fecha-cita');
                    if (inputCedula && inputFecha) {
                        inputCedula.value = cedula;
                        inputFecha.value = fechaISO;
                        inputCedula.classList.remove('input-error');
                        inputFecha.classList.remove('input-error');
                        if (app.widgetInvitado && typeof app.widgetInvitado.consultar === 'function') {
                            app.widgetInvitado.consultar();
                        }
                    }
                }, 100);
            } else {
                // Logueado: guardar deep link y navegar
                if (idCita) {
                    sessionStorage.setItem('abrir_detalle_pendiente', JSON.stringify({
                        id_cita: idCita,
                        codigo: codigo,
                        cedula: cedula,
                        fechaISO: fechaISO
                    }));
                }

                app.navegar('mi-salud');
            }
        },


        // Utilidad: Generar código único de cita (4 chars alfanuméricos con prefijo)
        generarCodigoCita() {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I/O/0/1 para evitar confusión
            let codigo = '';
            for (let i = 0; i < 4; i++) {
                codigo += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return 'CIT-' + codigo;
        },

        // Variable temporal para guardar el código de la cita actual (para el PDF)
        _ultimoCodigoCita: '',

        prepararResumenFinal(logueado) {
            const especialidad = sessionStorage.getItem('especialidad_seleccionada') || document.getElementById('citas-doctor-specialty').textContent;

            // Detección del Nombre del Médico
            let nombreMedico = '';
            if (this.medicoSeleccionado) nombreMedico = this.medicoSeleccionado;
            if (!nombreMedico) {
                const medicoUI = document.getElementById('citas-doctor-name');
                if (medicoUI && medicoUI.textContent.trim()) nombreMedico = medicoUI.textContent.trim();
            }
            if (!nombreMedico) {
                try {
                    const preCita = JSON.parse(sessionStorage.getItem('reservaCita_preseleccion'));
                    if (preCita && preCita.medico) nombreMedico = preCita.medico;
                } catch (e) { }
            }
            if (!nombreMedico) nombreMedico = "Médico Especialista";

            const fechaHora = this.horaSeleccionada;

            let paciente = "";
            let cedulaPaciente = "";
            let cedulaTitular = null;

            if (logueado && !this.modoProxy) {
                // ── Titular agendando para sí mismo ──
                // Resolución de Nombre (H2): cubre ambas convenciones de campo
                // (nombre_1 del usuario demo vs nombre1 del registro nuevo).
                try {
                    const userActivoStr = localStorage.getItem('usuarioActivo');
                    if (userActivoStr) {
                        const user = JSON.parse(userActivoStr);
                        const n1 = (user.nombre_1 || user.nombre1 || '').trim();
                        const n2 = (user.nombre_2 || user.nombre2 || '').trim();
                        const a1 = (user.apellido_1 || user.apellido1 || '').trim();
                        const a2 = (user.apellido_2 || user.apellido2 || '').trim();
                        // Formato: Nombre + Apellido (sin campos vacíos intermedios)
                        paciente = [n1, n2, a1, a2].filter(Boolean).join(' ') || 'Usuario Sanitas';
                        cedulaPaciente = user.identificacion || '';
                        cedulaTitular = user.identificacion || null;
                    }
                } catch (e) { }
                // Fallback de seguridad: si la sesión está corrupta, nombre digno
                if (!paciente) paciente = 'Usuario Sanitas';

            } else if (logueado && this.modoProxy) {
                // ── Titular agendando para un familiar (Proxy) ──
                // Cédula del titular se extrae del usuario logueado
                try {
                    const userActivoStr = localStorage.getItem('usuarioActivo');
                    if (userActivoStr) {
                        const user = JSON.parse(userActivoStr);
                        cedulaTitular = user.identificacion || null;
                    }
                } catch (e) { }
                // Nombre y cédula del paciente vienen del formulario del familiar
                const inputNombres = document.getElementById('citas-nombres');
                const inputCedula  = document.getElementById('citas-cedula');
                if (inputNombres) paciente      = inputNombres.value.trim() || 'Familiar';
                if (inputCedula)  cedulaPaciente = inputCedula.value.trim();

            } else {
                // ── Invitado sin cuenta ──
                const inputNombres   = document.getElementById('cita-nombres') || document.getElementById('citas-nombres');
                const inputApellidos = document.getElementById('cita-apellidos');
                const inputCedula    = document.getElementById('citas-cedula');
                const n = inputNombres   ? inputNombres.value.trim()   : '';
                const a = inputApellidos ? inputApellidos.value.trim() : '';
                paciente      = [n, a].filter(Boolean).join(' ') || 'Paciente';
                if (inputCedula) cedulaPaciente = inputCedula.value.trim();
                cedulaTitular = cedulaPaciente;
            }

            const fechaHoraStr = this.horaSeleccionada;
            let fecha = fechaHoraStr, hora = '';
            if (fechaHoraStr && fechaHoraStr.includes(',')) {
                const [datePart, timePart] = fechaHoraStr.split(', ');
                fecha = datePart;
                hora = timePart;
            }

            // Generar código interno (no se muestra al usuario)
            const codigoCita = this.generarCodigoCita();
            this._ultimoCodigoCita = codigoCita;
            const idCitaUnico = 'C' + Date.now().toString();

            const nuevaCita = {
                id: idCitaUnico,
                id_cita: idCitaUnico,
                codigo: codigoCita,
                medico: nombreMedico,
                especialidad: especialidad,
                fecha: fecha,
                hora: hora,
                paciente: paciente,
                cedula: cedulaPaciente,
                cedula_titular: cedulaTitular,
                lugar: 'Centro Médico Familiar Dra. Verónica Barahona',
                lugar_direccion: 'Tumbaco - Quito',
                seguro: 'Particular',
                estado: 'Próxima'
            };

            // Guardar la cita temporalmente en memoria y en sessionStorage (respaldo)
            this._citaTemporal = nuevaCita;
            sessionStorage.setItem('_citaTemporal_respaldo', JSON.stringify(nuevaCita));

            // Renderizar el paso de revisión (Paso 4)
            this._mostrarResumen(nuevaCita);
            this.mostrarPaso(4);

            // Limpiar sesión de pre-selección, pero NO de modificación aún
            sessionStorage.removeItem('reservaCita_preseleccion');
            sessionStorage.removeItem('especialidad_seleccionada');
            // No limpiar 'cita_modificacion' aquí, se usará en la confirmación final
        },

        // Muestra el resumen de la cita en el Paso 4
        _mostrarResumen(cita) {
            const summaryDiv = document.getElementById('review-summary-content');
            if (!summaryDiv) return;

            const fechaHora = cita.fecha + (cita.hora ? ', ' + cita.hora : '');
            const estaLogueado = localStorage.getItem('usuarioLogueado') === 'true';
            const proxyLinkContainer = document.getElementById('proxy-link-container');

            // Mostrar/ocultar enlace de proxy: solo si hay sesión y NO es modo proxy
            if (proxyLinkContainer) {
                proxyLinkContainer.style.display = (estaLogueado && !this.modoProxy) ? 'block' : 'none';
            }

            summaryDiv.innerHTML = `
                <div class="salud-det__row"><span class="salud-det__label">Especialidad</span><span class="salud-det__val">${cita.especialidad}</span></div>
                <div class="salud-det__row"><span class="salud-det__label">Médico</span><span class="salud-det__val">${cita.medico}</span></div>
                <div class="salud-det__row"><span class="salud-det__label">Fecha y Hora</span><span class="salud-det__val">${fechaHora}</span></div>
                <div class="salud-det__row"><span class="salud-det__label">Paciente</span><span class="salud-det__val">${cita.paciente}</span></div>
                <div class="salud-det__row"><span class="salud-det__label">Cédula</span><span class="salud-det__val">${cita.cedula || '—'}</span></div>
            `;

            // Configurar botón Volver
            // REGLA DE ORO: Delegar SIEMPRE a irAtras().
            // No asignar lógica local aquí: irAtras() es la única fuente de verdad.
            const backBtn = document.getElementById('btn-back-review');
            if (backBtn) {
                backBtn.onclick = () => app.citas.irAtras();
            }

            // Configurar botón Confirmar Cita
            const confirmBtn = document.getElementById('btn-confirmar-cita-definitivo');
            if (confirmBtn) {
                confirmBtn.onclick = () => {
                    this.confirmarCita();
                };
            }
        },

        // Guarda definitivamente la cita en localStorage y muestra éxito
        confirmarCita() {
            let cita = this._citaTemporal;
            // Respaldo: si se perdió la variable en memoria, recuperar de sessionStorage
            if (!cita) {
                try {
                    const respaldo = sessionStorage.getItem('_citaTemporal_respaldo');
                    if (respaldo) cita = JSON.parse(respaldo);
                } catch (e) { }
            }
            if (!cita) {
                alert('No hay datos de cita para confirmar.');
                return;
            }

            // --- VALIDACIÓN DE LÍMITE DIARIO (Titular agendando para sí mismo) ---
            const estaLogueado = localStorage.getItem('usuarioLogueado') === 'true';
            if (estaLogueado && !this.modoProxy) {
                // Es el titular confirmando su propia cita
                let cedulaTitular = '';
                try {
                    const user = JSON.parse(localStorage.getItem('usuarioActivo'));
                    cedulaTitular = user?.identificacion || '';
                } catch (e) { }
                const fechaISO = this.fechaISOSeleccionada || sessionStorage.getItem('cita_fecha_iso') || cita.fecha;
                const especialidad = cita.especialidad;
                let idExcluir = null;
                const modCtxStr = sessionStorage.getItem('cita_modificacion');
                if (modCtxStr) {
                    try { const modCtx = JSON.parse(modCtxStr); idExcluir = modCtx.id_cita; } catch (e) { }
                }
                // [BR-1 Debug] Auditoría Paso 4 — Titular
                console.log('[BR-1 Debug] Trigger Paso 4 (Titular)', { cedula: cedulaTitular, fechaISO, especialidad, idExcluir });
                if (cedulaTitular && this._verificarLimiteDiario(cedulaTitular, fechaISO, especialidad, idExcluir)) {
                    this._mostrarModalLimiteDiario(especialidad, fechaISO);
                    return;
                }

                // ── BR-2/BR-3 Titular en Paso 4 (Trigger de Identidad) ──
                // El titular confirmó la cita para sí mismo. Es el primer punto donde
                // su cédula es conocida con certeza → validamos colisión y buffer ahora.
                if (cedulaTitular) {
                    const horaStr = this.horaSeleccionada&&this.horaSeleccionada.includes(',') ? this.horaSeleccionada.split(', ')[1] : '';
                    const citasPublicasT = JSON.parse(localStorage.getItem('sanitas_citas') || '[]');

                    // BR-2: Colisión exacta (misma hora del paciente)
                    const colisionT = citasPublicasT.find(c =>
                        c.cedula === cedulaTitular &&
                        c.fecha === fechaISO &&
                        c.hora === horaStr &&
                        c.estado !== 'Cancelada' &&
                        !(idExcluir && (c.id_cita === idExcluir || c.id === idExcluir))
                    );
                    if (colisionT) {
                        this._mostrarModalColision(colisionT, fechaISO, horaStr, fechaISO);
                        return;
                    }

                    // BR-3: Buffer de 30 min bidireccional
                    const doc = this._doctorActual;
                    const duracionNueva = doc ? (doc.duracion_minutos || 30) : 30;
                    const [hN, mN] = horaStr.split(':').map(Number);
                    const inicioNueva = hN * 60 + mN;
                    const finNueva = inicioNueva + duracionNueva;
                    const citasMismoDiaT = citasPublicasT.filter(c =>
                        c.cedula === cedulaTitular &&
                        c.fecha === fechaISO &&
                        c.estado !== 'Cancelada' &&
                        !(idExcluir && (c.id_cita === idExcluir || c.id === idExcluir))
                    );
                    const dbT = JSON.parse(localStorage.getItem('sanitasFam_db'));
                    for (const citaT of citasMismoDiaT) {
                        let durExt = 30;
                        if (dbT && dbT.cartera_especialistas) {
                            const espT = dbT.cartera_especialistas.find(e => e.especialidad === citaT.especialidad);
                            if (espT) durExt = espT.duracion_minutos || 30;
                        }
                        const [hE, mE] = citaT.hora.split(':').map(Number);
                        const inicioExt = hE * 60 + mE;
                        const finExt = inicioExt + durExt;
                        if ((finNueva + 30 > inicioExt) && (finExt + 30 > inicioNueva)) {
                            const minSug = finExt + 30;
                            const hSug = Math.floor(minSug / 60);
                            const mSug = minSug % 60;
                            const horaSug = `${String(hSug).padStart(2, '0')}:${String(mSug).padStart(2, '0')}`;
                            const detalle = `${citaT.especialidad || 'Especialidad'} con ${citaT.medico || 'Médico'} a las ${citaT.hora}`;
                            this._mostrarModalBuffer(detalle, durExt, horaSug);
                            return;
                        }
                    }
                }
            } // fin if (estaLogueado && !this.modoProxy)

            // --- VALIDACIÓN DE LÍMITE DIARIO (Invitado o Proxy: red de seguridad en Paso 4) ---
            // Cubre el caso en que el Paso 3 fue omitido (ej. flujo de modificación directa).
            if (!estaLogueado || this.modoProxy) {
                const inputCed = document.getElementById('citas-cedula');
                // technical-requirements.md: cita usa 'cedula_paciente' como campo de identidad
                const cedulaPaciente = (inputCed ? inputCed.value.trim() : '') || cita.cedula_paciente || cita.cedula || '';
                if (cedulaPaciente) {
                    const fechaISO = this.fechaISOSeleccionada || sessionStorage.getItem('cita_fecha_iso') || cita.fecha;
                    const especialidad = cita.especialidad;
                    let idExcluir = null;
                    const modCtxStr2 = sessionStorage.getItem('cita_modificacion');
                    if (modCtxStr2) {
                        try { const modCtx2 = JSON.parse(modCtxStr2); idExcluir = modCtx2.id_cita; } catch (e) { }
                    }
                    // [BR-1 Debug] Auditoría Paso 4 — Invitado / Proxy
                    console.log('[BR-1 Debug] Trigger Paso 4 (Invitado/Proxy)', { cedula: cedulaPaciente, fechaISO, especialidad, idExcluir });
                    if (this._verificarLimiteDiario(cedulaPaciente, fechaISO, especialidad, idExcluir)) {
                        this._mostrarModalLimiteDiario(especialidad, fechaISO);
                        return;
                    }
                }
            }
            // --- FIN VALIDACIÓN ---

            const modCtxStr = sessionStorage.getItem('cita_modificacion');
            let modCtx = null;
            try { modCtx = JSON.parse(modCtxStr); } catch (e) { }
            // Capturar flag ANTES de que los removeItem borren cita_modificacion del sessionStorage
            const esModificacion = !!modCtx;

            const fechaHoraStr = this.horaSeleccionada; // Asegurar que tenemos la hora
            const fechaISO = this.fechaISOSeleccionada || sessionStorage.getItem('cita_fecha_iso') || cita.fecha;

            if (modCtx) {
                // MODO MODIFICACIÓN
                let citasPublicas = JSON.parse(localStorage.getItem('sanitas_citas') || '[]');
                let indexP = -1;
                if (modCtx.id_cita) {
                    indexP = citasPublicas.findIndex(cp => cp.id_cita === modCtx.id_cita);
                } else if (modCtx.origen === 'widget' && typeof modCtx.indexPublicas === 'number') {
                    indexP = modCtx.indexPublicas;
                } else {
                    indexP = citasPublicas.findIndex(cp => cp.cedula === modCtx.cedula && cp.medico === modCtx.medico);
                }
                if (indexP !== -1) {
                    const citaAntigua = citasPublicas[indexP];
                    citasPublicas[indexP] = {
                        ...citaAntigua,
                        fecha: fechaISO,
                        hora: cita.hora,
                        medico: cita.medico,
                        especialidad: cita.especialidad,
                        cedula_titular: cita.cedula_titular
                    };
                    localStorage.setItem('sanitas_citas', JSON.stringify(citasPublicas));
                }

                if (modCtx.id_cita || modCtx.idCita) {
                    const realId = modCtx.id_cita || modCtx.idCita;
                    let historial = JSON.parse(localStorage.getItem('sanitas_mis_citas') || '[]');
                    const indexH = historial.findIndex(h => (h.id || h._id) === realId || h.id_cita === realId);
                    if (indexH !== -1) {
                        const historialAntiguo = historial[indexH];
                        historial[indexH] = {
                            ...historialAntiguo,
                            fecha: cita.fecha,
                            hora: cita.hora,
                            medico: cita.medico,
                            especialidad: cita.especialidad,
                            estado: 'Próxima',
                            cedula_titular: cita.cedula_titular
                        };
                        localStorage.setItem('sanitas_mis_citas', JSON.stringify(historial));
                    }
                    // Sincronizar en memoria
                    if (app.salud && app.salud._citas) {
                        const indexSalud = app.salud._citas.findIndex(sc => (sc.id || sc._id) === realId || sc.id_cita === realId);
                        if (indexSalud !== -1) {
                            app.salud._citas[indexSalud] = {
                                ...app.salud._citas[indexSalud],
                                fecha: cita.fecha,
                                hora: cita.hora,
                                medico: cita.medico,
                                especialidad: cita.especialidad,
                                estado: 'Próxima'
                            };
                        }
                    }
                }
                sessionStorage.removeItem('cita_modificacion');
                // Reconstruir ocupadas
                this._reconstruirOcupadas();
            } else {
                // MODO CREACIÓN NORMAL
                let historial = JSON.parse(localStorage.getItem('sanitas_mis_citas') || '[]');
                historial.push(cita);
                localStorage.setItem('sanitas_mis_citas', JSON.stringify(historial));

                let citasPublicas = JSON.parse(localStorage.getItem('sanitas_citas') || '[]');
                citasPublicas.push({
                    id_cita: cita.id_cita,
                    codigo: cita.codigo,
                    cedula: cita.cedula,
                    medico: cita.medico,
                    especialidad: cita.especialidad,
                    fecha: fechaISO,
                    hora: cita.hora
                });
                localStorage.setItem('sanitas_citas', JSON.stringify(citasPublicas));

                const ocupadas = JSON.parse(localStorage.getItem('sanitas_citas_ocupadas') || '[]');
                ocupadas.push({
                    medico: cita.medico,
                    especialidad: cita.especialidad,
                    fecha: cita.fecha,
                    hora: cita.hora,
                    fechaHora: this.horaSeleccionada
                });
                localStorage.setItem('sanitas_citas_ocupadas', JSON.stringify(ocupadas));
            }

            // Limpiar datos temporales y mostrar éxito
            this._citaTemporal = null;
            this.modoProxy = false;
            sessionStorage.removeItem('cita_modificacion');

            // Llenar los elementos del paso 5
            document.getElementById('resumen-doctor-name').textContent = cita.medico;
            document.getElementById('resumen-doctor-specialty').textContent = cita.especialidad;
            document.getElementById('resumen-fecha').textContent = (cita.fecha || '') + (cita.hora ? ', ' + cita.hora : '');
            document.getElementById('resumen-paciente').textContent = cita.paciente;

            // ── Feedback Contextual y Adaptativo ──
            // Si la cita provino de un flujo de modificación, el título debe reflejar
            // la acción real: "Reagendada" en lugar del genérico "Agendada".
            // esModificacion se evaluó ANTES de que sessionStorage fuera limpiado.
            const tituloPaso5 = document.querySelector('#citas-step-5 h2');
            if (tituloPaso5) {
                tituloPaso5.textContent = esModificacion
                    ? '¡Cita reagendada con éxito!'
                    : '¡Cita agendada con éxito!';
            }

            this.mostrarPaso(5);
            sessionStorage.removeItem('_citaTemporal_respaldo');   // limpiar respaldo
        },

        // Reconstruir ocupadas a partir de sanitas_citas (evitar duplicados)
        _reconstruirOcupadas() {
            const citasPublicas = JSON.parse(localStorage.getItem('sanitas_citas') || '[]');
            const diasNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            let nuevasOcupadas = [];
            citasPublicas.forEach(c => {
                if (c.estado !== 'Cancelada') {
                    let d = new Date();
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

        // Activar modo proxy desde el resumen
        activarProxyDesdeResumen() {
            this.modoProxy = true;
            // Limpiar los campos del Paso 3 y mostrarlo
            ['citas-nombres', 'citas-cedula', 'citas-celular'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.value = '';
                    el.removeAttribute('readonly');
                    el.style.borderColor = '#ccc';
                }
            });
            const modMsg = document.getElementById('modificacion-msg');
            if (modMsg) modMsg.remove();
            // Reiniciar validadores
            if (!this.validadoresIniciados) {
                this.configurarValidadores();
                this.validadoresIniciados = true;
            } else {
                this.actualizarEstadoBotonSiguiente();
            }
            this.mostrarPaso(3);
        },

        _generarTicketHTML(medico, especialidad, fechaHora, paciente) {
            return `
                <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; text-align: center; font-family: sans-serif; box-sizing: border-box;">
                    <div style="margin-bottom: 20px;">
                        <h1 style="font-size: 1.8rem; color: #3B49A3; margin: 0 0 5px 0;">Centro Médico Familiar</h1>
                        <h2 style="font-size: 1.3rem; color: #0DA99F; margin: 0 0 10px 0;">Dra. Verónica Barahona</h2>
                        <p style="font-size: 1rem; color: #555; margin: 0;">Pifo, Ignacio Jarrín y Tulio Garzón · Quito, Ecuador</p>
                        <p style="font-size: 1rem; color: #555; margin: 5px 0 0 0;">Tel: 099 890 8034</p>
                    </div>
                    <h3 style="color: #3B49A3; font-size: 1.4rem; margin-bottom: 30px; border-bottom: 2px solid #0DA99F; padding-bottom: 10px; display: inline-block;">COMPROBANTE DE CITA MÉDICA</h3>
                    <div style="text-align: left; margin: 0 auto 30px auto; max-width: 400px; font-size: 1.1rem; line-height: 1.6; color: #333;">
                        <p style="margin: 0 0 10px 0;"><strong>Fecha y Hora:</strong> ${fechaHora}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Médico:</strong> ${medico}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Especialidad:</strong> ${especialidad}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Paciente:</strong> ${paciente}</p>
                    </div>
                    <div style="background: #fef9e7; border-left: 4px solid #FDAD34; padding: 15px; font-size: 0.9rem; color: #666; text-align: left; max-width: 600px; margin: 0 auto;">
                        <strong style="color: #c47f0a;">Importante:</strong> Presente este comprobante al momento de su consulta. Para cancelar o reprogramar, comuníquese con anticipación al 099 890 8034.
                    </div>
                    <p style="font-size: 0.8rem; color: #aaa; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
                        Documento generado electrónicamente · ${new Date().toLocaleDateString('es-EC')}
                    </p>
                </div>
            `;
        },

        // ── Descarga de Comprobante PDF (IFRAME – infalible) ──
        // ── Descarga de Comprobante PDF (jsPDF nativo, sin html2canvas) ──
        descargarComprobantePDF() {
            const medico = document.getElementById('resumen-doctor-name')?.textContent || '—';
            const especialidad = document.getElementById('resumen-doctor-specialty')?.textContent || '—';
            const fechaHora = document.getElementById('resumen-fecha')?.textContent || '—';
            const paciente = document.getElementById('resumen-paciente')?.textContent || '—';

            try {
                // Acceso universal a jsPDF (funciona con la librería standalone cargada)
                const { jsPDF } = window.jspdf || window;
                const doc = new jsPDF('p', 'mm', 'letter');

                const pageWidth = 215.9;
                const margin = 25;
                let y = margin;

                // Encabezado
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(18);
                doc.setTextColor(59, 73, 163);
                doc.text('Centro Médico Familiar', pageWidth / 2, y, { align: 'center' });
                y += 10;

                doc.setFontSize(13);
                doc.setTextColor(13, 169, 159);
                doc.text('Dra. Verónica Barahona', pageWidth / 2, y, { align: 'center' });
                y += 7;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(85, 85, 85);
                doc.text('Pifo, Ignacio Jarrín y Tulio Garzón · Quito, Ecuador', pageWidth / 2, y, { align: 'center' });
                y += 5;
                doc.text('Tel: 099 890 8034', pageWidth / 2, y, { align: 'center' });
                y += 12;

                // Línea separadora
                doc.setDrawColor(13, 169, 159);
                doc.setLineWidth(0.5);
                doc.line(margin, y, pageWidth - margin, y);
                y += 8;

                // Título
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.setTextColor(59, 73, 163);
                doc.text('COMPROBANTE DE CITA MÉDICA', pageWidth / 2, y, { align: 'center' });
                y += 12;

                // Detalles
                const leftX = margin + 10;
                const valueX = leftX + 45;
                doc.setFontSize(12);
                doc.setTextColor(33, 33, 33);

                const campos = [
                    { label: 'Fecha y Hora:', value: fechaHora },
                    { label: 'Médico:', value: medico },
                    { label: 'Especialidad:', value: especialidad },
                    { label: 'Paciente:', value: paciente }
                ];
                campos.forEach(campo => {
                    doc.setFont('helvetica', 'bold');
                    doc.text(campo.label, leftX, y);
                    doc.setFont('helvetica', 'normal');
                    doc.text(campo.value, valueX, y);
                    y += 10;
                });

                y += 6;

                // Nota
                doc.setFillColor(254, 249, 231);
                doc.rect(margin, y, pageWidth - 2 * margin, 20, 'F');
                doc.setDrawColor(253, 173, 52);
                doc.setLineWidth(1.2);
                doc.line(margin, y, margin, y + 20);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(196, 127, 10);
                doc.text('Importante:', margin + 6, y + 6);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(102, 102, 102);
                const nota = doc.splitTextToSize(
                    'Presente este comprobante al momento de su consulta. Para cancelar o reprogramar, comuníquese con anticipación al 099 890 8034.',
                    pageWidth - 2 * margin - 12
                );
                doc.text(nota, margin + 6, y + 12);
                y += 28;

                // Pie
                doc.setFontSize(9);
                doc.setTextColor(170);
                doc.text(`Documento generado electrónicamente · ${new Date().toLocaleDateString('es-EC')}`, pageWidth / 2, y, { align: 'center' });

                doc.save('Cita_Medica.pdf');
            } catch (e) {
                console.error('Error al generar PDF:', e);
                alert('Error al generar PDF. Asegúrate de haber cambiado la librería en index.html.');
            }
        },

        // ── Imprimir Comprobante Físico ──
        imprimirComprobante() {
            const medico = document.getElementById('resumen-doctor-name')?.textContent || '—';
            const especialidad = document.getElementById('resumen-doctor-specialty')?.textContent || '—';
            const fechaHora = document.getElementById('resumen-fecha')?.textContent || '—';
            const paciente = document.getElementById('resumen-paciente')?.textContent || '—';

            const ticketHTML = this._generarTicketHTML(medico, especialidad, fechaHora, paciente);

            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Imprimir Comprobante</title>
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            background: #fff;
                            display: flex;
                            justify-content: center;
                            align-items: flex-start;
                        }
                        @media print {
                            @page { size: letter; margin: 0.5in; }
                        }
                    </style>
                </head>
                <body>
                    ${ticketHTML}
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                window.close();
                            }, 500);
                        }
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        },
        actualizarBarraProgreso() {
            const indicator = document.getElementById('citas-progress-indicator');
            const estaLogueado = localStorage.getItem('usuarioLogueado');
            let hitos = [];
            if (estaLogueado) {
                hitos = [
                    { id: 0, label: 'Selección', steps: [0, 1] },
                    { id: 2, label: 'Cita', steps: [2] },
                    { id: 4, label: 'Revisión', steps: [4] },
                    { id: 5, label: 'Confirmación', steps: [5] }
                ];
            } else {
                hitos = [
                    { id: 0, label: 'Selección', steps: [0, 1] },
                    { id: 2, label: 'Cita', steps: [2] },
                    { id: 3, label: 'Datos', steps: [3] },
                    { id: 4, label: 'Revisión', steps: [4] },
                    { id: 5, label: 'Confirmación', steps: [5] }
                ];
            }

            let html = '';
            hitos.forEach((hito, index) => {
                const isActive = hito.steps.includes(this.pasoActual);
                let isCompleted = false;

                // Si el pasoActual es mayor que el paso más alto de este hito
                if (this.pasoActual > Math.max(...hito.steps)) {
                    isCompleted = true;
                }

                let classes = 'citas-progress-step';
                if (isActive) classes += ' active';
                if (isCompleted) classes += ' completed';

                let icon = '';
                if (isCompleted) icon = '<i class="fa-solid fa-check"></i>';
                else icon = index + 1;

                html += `
                    <div class="${classes}">
                        ${icon}
                        <span class="citas-progress-label">${hito.label}</span>
                    </div>
                `;
            });

            indicator.innerHTML = html;
        },

        // ======================================================================
        // MOTOR DE CALENDARIO SEMANAL (Reglas de Negocio del Centro Médico)
        // ======================================================================
        fechaBaseCalendario: new Date(),

        diaSeleccionadoMobile: 0,   // 0 = Lunes, 1 = Martes, …, 5 = Sábado
        modoProxy: false,
        // C1: Límite Dinámico de Retroceso — se fija tras el Smart Jump inicial.
        // Representa el primer día con disponibilidad real encontrado al cargar el calendario.
        // El usuario no puede retroceder más allá de esta fecha.
        fechaInicioDisponible: null,
        _citaTemporal: null,

        // Mapeo de duración (minutos) por especialidad
        duracionesPorEspecialidad: {
            "TRAUMATOLOGÍA": 60, "PSICOLOGÍA": 60,
            "GINECOLOGÍA": 40, "MEDICINA FAMILIAR": 40,
            "MEDICINA GENERAL": 35, "ODONTOLOGÍA": 35, "RADIODIÁGNOSTICO": 35,
            "UROLOGÍA": 30, "DERMATOLOGÍA": 30,
            "ENDOCRINOLOGÍA": 20,
            "ENFERMERÍA": 15,
            "LABORATORIO": 12
        },

        _obtenerDuracion() {
            const esp = (sessionStorage.getItem('especialidad_seleccionada') || '').toUpperCase();
            return this.duracionesPorEspecialidad[esp] || 30; // 30 min por defecto
        },

        _obtenerSlotsDia(diaDate, doctorSettings) {
            const { diasLaborables, horaInicio, horaFin, horaFinSabado, duracion } = doctorSettings;
            const diaSemanaIdx = diaDate.getDay(); // 0=Domingo..6=Sábado
            const diaLaboralNum = diaSemanaIdx === 0 ? 7 : diaSemanaIdx; // 1=Lunes..7=Domingo
            if (!diasLaborables.includes(diaLaboralNum)) return [];

            const esSabado = (diaSemanaIdx === 6);
            const [hI, mI] = horaInicio.split(':').map(Number);
            const [hF, mF] = (esSabado ? horaFinSabado : horaFin).split(':').map(Number);
            const ahora = new Date();
            const hoyStr = new Date().toDateString();
            const esPasado = diaDate < new Date(hoyStr);

            const slots = [];
            for (let m = hI * 60 + mI; m <= hF * 60 + mF; m += duracion) {
                const hh = Math.floor(m / 60);
                const mm = m % 60;
                const horaStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
                const slotDate = new Date(diaDate);
                slotDate.setHours(hh, mm, 0, 0);
                const yaPaso = esPasado || slotDate <= ahora;

                // Construir el mismo label y fechaISO que usa el código actual
                const diasNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                const label = `${diasNombres[diaSemanaIdx]} ${diaDate.getDate()} de ${meses[diaDate.getMonth()]}, ${horaStr}`;
                const fechaISO = `${diaDate.getFullYear()}-${String(diaDate.getMonth() + 1).padStart(2, '0')}-${String(diaDate.getDate()).padStart(2, '0')}`;

                const ocupadas = JSON.parse(localStorage.getItem('sanitas_citas_ocupadas') || '[]');
                const medicoActual = document.getElementById('citas-doctor-name')?.textContent || '';
                const estaOcupada = ocupadas.some(cita => cita.medico === medicoActual && cita.fechaHora === label);

                slots.push({ horaStr, label, fechaISO, yaPaso, estaOcupada });
            }
            return slots;
        },

        generarCalendario(autoSeek = false) {
            const grid = document.getElementById('citas-calendar-grid');
            if (!grid) return;


            // Obtener datos del médico seleccionado
            const doc = this._doctorActual;
            let duracion = 30; // fallback
            let diasLaborables = [1, 2, 3, 4, 5, 6]; // L-V + Sábado
            let horaInicio = "07:00";
            let horaFin = "16:30";
            let horaFinSabado = "12:30";

            if (doc) {
                duracion = doc.duracion_minutos || 30;
                if (doc.horarios_atencion) {
                    diasLaborables = doc.horarios_atencion.dias || diasLaborables;
                    horaInicio = doc.horarios_atencion.hora_inicio || horaInicio;
                    horaFin = doc.horarios_atencion.hora_fin || horaFin;
                    if (doc.horarios_atencion.hora_fin_sabado) {
                        horaFinSabado = doc.horarios_atencion.hora_fin_sabado;
                    }
                }
            }

            const hoy = new Date(this.fechaBaseCalendario);
            const diaSemana = hoy.getDay();
            const diffAlLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
            let lunes = new Date(hoy);
            lunes.setDate(hoy.getDate() + diffAlLunes);
            lunes.setHours(0, 0, 0, 0);

            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const labelMes = document.getElementById('citas-calendar-month-label');
            if (labelMes) labelMes.textContent = `${meses[lunes.getMonth()]} ${lunes.getFullYear()}`;

            const ahora = new Date();
            const diasNombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            let html = '';

            const esMobile = window.innerWidth <= 767;
            const labelDiaMobile = document.getElementById('citas-day-label-mobile');
            // ── Smart Default: avanzar al primer día con disponibilidad real ──
            if (autoSeek && doc) {
                // ── C2: Smart Jumps con Disponibilidad Real (H7) ──
                // Criterio de parada: el día debe ser laborable Y tener al menos
                // un slot cuya hora sea posterior al instante actual Y no esté ocupado.
                // Cálculo puramente lógico: sin escrituras al DOM dentro del bucle.
                const settings = { duracion, diasLaborables, horaInicio, horaFin, horaFinSabado };
                let diaActual = new Date(lunes);
                diaActual.setDate(lunes.getDate() + this.diaSeleccionadoMobile);
                let intentos = 0;

                // Función auxiliar interna: devuelve el conteo de slots interactuables
                // para un día dado, usando _obtenerSlotsDia() (lectura pura, sin DOM write).
                const contarDisponibles = (fecha) => {
                    const slots = this._obtenerSlotsDia(new Date(fecha), settings);
                    return slots.filter(s => !s.yaPaso && !s.estaOcupada).length;
                };

                // El bucle avanza mientras el día actual NO tenga slots reales disponibles.
                // Condición de escape estricta: máximo 14 iteraciones (2 semanas).
                while (contarDisponibles(diaActual) === 0 && intentos < 14) {
                    diaActual.setDate(diaActual.getDate() + 1);
                    // Recalcular el lunes de la semana en la que cae el nuevo día
                    const dSem = diaActual.getDay();
                    const diff = dSem === 0 ? -6 : 1 - dSem;
                    lunes = new Date(diaActual);
                    lunes.setDate(diaActual.getDate() + diff);
                    lunes.setHours(0, 0, 0, 0);
                    this.fechaBaseCalendario = new Date(lunes);
                    this.diaSeleccionadoMobile = Math.round((diaActual - lunes) / 86400000);
                    intentos++;
                }
                // Si el bucle agotó las 14 iteraciones sin encontrar disponibilidad,
                // se queda en la última fecha evaluada y mostrará el empty state.

                // ── C1: Fijar el Límite Dinámico de Retroceso ──
                // Se registra el día en el que aterrizó el Smart Jump como fecha mínima navegable.
                // Este valor persiste mientras el usuario no cambie de médico o especialidad.
                this.fechaInicioDisponible = new Date(diaActual);
                this.fechaInicioDisponible.setHours(0, 0, 0, 0);

                // Actualizar etiqueta del mes ya que lunes pudo haber cambiado
                if (labelMes) labelMes.textContent = `${meses[lunes.getMonth()]} ${lunes.getFullYear()}`;
                // Actualizar label del día en móvil
                const diaSelect = new Date(lunes);
                diaSelect.setDate(lunes.getDate() + this.diaSeleccionadoMobile);
                const nombreDia = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][diaSelect.getDay()];
                if (labelDiaMobile) labelDiaMobile.textContent = `${nombreDia} ${diaSelect.getDate()} de ${meses[diaSelect.getMonth()]}`;
            }

            const diaActivo = this.diaSeleccionadoMobile;
            if (labelDiaMobile && esMobile) {
                const diaSelect = new Date(lunes);
                diaSelect.setDate(lunes.getDate() + diaActivo);
                const nombreDia = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][diaSelect.getDay()];
                labelDiaMobile.textContent = `${nombreDia} ${diaSelect.getDate()} de ${meses[diaSelect.getMonth()]}`;
            }

            for (let i = 0; i < 6; i++) {
                if (!esMobile || (esMobile && i === diaActivo)) {
                    const dia = new Date(lunes);
                    dia.setDate(lunes.getDate() + i);
                    const diaSemanaIdx = dia.getDay(); // 0=Domingo..6=Sábado
                    const diaLaboralNum = diaSemanaIdx === 0 ? 7 : diaSemanaIdx; // convertimos a 1=Lunes..7=Domingo

                    // Solo mostrar día si está en el arreglo de días laborables
                    if (!diasLaborables.includes(diaLaboralNum)) {
                        if (esMobile && i === diaActivo) {
                            // En móvil, un solo día: no se muestra nada si no trabaja
                            html = '<p style="text-align:center; padding:20px;">No hay atención este día.</p>';
                        }
                        continue;
                    }

                    // Verificar si el día tiene al menos un slot disponible (para decidir empty state)
                    const slotsDia = this._obtenerSlotsDia(dia, { diasLaborables, horaInicio, horaFin, horaFinSabado, duracion });
                    const slotsDisponibles = slotsDia.filter(s => !s.yaPaso && !s.estaOcupada);
                    const esSabado = (i === 5);
                    const esPasado = dia < ahora && dia.toDateString() !== ahora.toDateString();
                    const diaNum = dia.getDate();
                    const mesCorto = meses[dia.getMonth()];
                    const esHoy = dia.toDateString() === ahora.toDateString();
                    const headerClass = esHoy ? 'calendar-day-header calendar-day-header--today' : 'calendar-day-header';

                    if (!esPasado && slotsDisponibles.length === 0) {
                        // Estado vacío minimalista
                        html += `<div class="calendar-day">`;
                        if (!esMobile) {   // ← SÓLO SE MUESTRA LA CABECERA EN ESCRITORIO
                            html += `<div class="${headerClass}">${diasNombres[i]}<br><strong>${diaNum} ${mesCorto}</strong></div>`;
                        }
                        html += `<div class="calendar-slots calendar-slots--empty">`;
                        html += `<p style="text-align:center; padding:20px; color: var(--gray-text);">
                <i class="fa-regular fa-calendar-xmark" style="font-size:1.5rem; display:block; margin-bottom:8px;"></i>
                No hay horarios disponibles para este día.
            </p>`;
                        if (esMobile) {
                            html += `<button class="btn btn--primario" style="margin:0 auto; display:block;" onclick="app.citas.irAlProximoDiaDisponible()">
                    Ir al próximo día disponible
                </button>`;
                        }
                        html += `</div></div>`;
                    } else {
                        if (esPasado) {
                            // ── C3: Empty State Estandarizado (H4) — día pasado ──
                            // Los días pasados usan el mismo diseño que los días sin slots.
                            html += `<div class="calendar-day calendar-day--past">`;
                            if (!esMobile) {
                                html += `<div class="${headerClass}">${diasNombres[i]}<br><strong>${diaNum} ${mesCorto}</strong></div>`;
                            }
                            html += `<div class="calendar-slots calendar-slots--empty">`;
                            html += `<div class="empty-state-diario" style="text-align:center; padding:20px; opacity:0.6;"><i class="fa-solid fa-calendar-xmark fa-2x"></i><p>No hay horarios disponibles para este día</p></div>`;
                            html += `</div></div>`;
                        } else {
                            // Renderizado normal con slots activos
                            html += `<div class="calendar-day">`;
                            html += `<div class="${headerClass}">${diasNombres[i]}<br><strong>${diaNum} ${mesCorto}</strong></div>`;
                            html += `<div class="calendar-slots">`;

                            const [hI, mI] = horaInicio.split(':').map(Number);
                            const inicioMin = hI * 60 + mI;
                            const [hF, mF] = (esSabado ? horaFinSabado : horaFin).split(':').map(Number);
                            const corteMin = hF * 60 + mF;

                            let slotCount = 0;
                            const maxSlots = 10;
                            for (let m = inicioMin; m <= corteMin; m += duracion) {
                                if (slotCount >= maxSlots) break;
                                const hh = Math.floor(m / 60);
                                const mm = m % 60;
                                const horaStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
                                const slotDate = new Date(dia);
                                slotDate.setHours(hh, mm, 0, 0);
                                const yaPaso = slotDate <= ahora;

                                const label = `${diasNombres[i]} ${diaNum} de ${mesCorto}, ${horaStr}`;
                                const fechaISO = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;

                                const medicoActual = document.getElementById('citas-doctor-name')?.textContent || '';
                                const ocupadas = JSON.parse(localStorage.getItem('sanitas_citas_ocupadas') || '[]');
                                const estaOcupada = ocupadas.some(cita => cita.medico === medicoActual && cita.fechaHora === label);

                                if (yaPaso || estaOcupada) {
                                    html += `<button class="time-slot time-slot--past" disabled>${horaStr}</button>`;
                                } else {
                                    html += `<button class="time-slot" onclick="app.citas.seleccionarHora(this, '${label}', '${fechaISO}')">${horaStr}</button>`;
                                }
                                slotCount++;
                            }
                            html += `</div></div>`;
                        }
                    }
                }
            }

            grid.innerHTML = html || '<p style="text-align:center; padding:20px;">No hay horarios disponibles esta semana.</p>';

            // ── C1 UI (Escritorio): Ocultar botón "Anterior" en la semana de inicio ──
            // Usa visibility:hidden (no display:none) para mantener el layout Flexbox estable.
            const hoyNorm = new Date();
            hoyNorm.setHours(0, 0, 0, 0);
            const lunesNorm = new Date(lunes);
            lunesNorm.setHours(0, 0, 0, 0);
            const btnAnterior = document.querySelector('.citas-calendar-header .calendar-nav-btn:first-child');
            if (btnAnterior) {
                btnAnterior.style.visibility = lunesNorm <= hoyNorm ? 'hidden' : 'visible';
            }

            // ── C1 UI (Móvil): Ocultar botón "Día anterior" en el origen de disponibilidad ──
            // visibility:hidden oculta el botón sin colapsar el espacio que ocupa en el flex,
            // evitando el salto visual que causaría display:none. El botón vuelve a 'visible'
            // en cuanto el usuario avanza a cualquier día posterior al límite mínimo.
            if (esMobile) {
                const diaVisibleMobile = new Date(lunes);
                diaVisibleMobile.setDate(lunes.getDate() + this.diaSeleccionadoMobile);
                diaVisibleMobile.setHours(0, 0, 0, 0);
                const limiteMinimo = this.fechaInicioDisponible
                    ? new Date(this.fechaInicioDisponible)
                    : (() => { const h = new Date(); h.setHours(0, 0, 0, 0); return h; })();
                const btnDiaAnterior = document.querySelector('.citas-day-nav-mobile .calendar-nav-btn:first-child');
                if (btnDiaAnterior) {
                    btnDiaAnterior.style.visibility = diaVisibleMobile <= limiteMinimo ? 'hidden' : 'visible';
                }
            }

            this._bloquearConfirmar();
        },

        cambiarSemana(direccion) {
            // ── C1: Bloqueo del Pasado (H5) ──
            // Si el usuario intenta ir hacia atrás, calculamos la nueva fecha base
            // y comparamos contra hoy normalizando las horas para no bloquear el día actual.
            if (direccion === -1) {
                const nuevaFecha = new Date(this.fechaBaseCalendario);
                nuevaFecha.setDate(nuevaFecha.getDate() - 7);
                nuevaFecha.setHours(0, 0, 0, 0);
                const hoyNorm = new Date();
                hoyNorm.setHours(0, 0, 0, 0);
                if (nuevaFecha < hoyNorm) return; // Abortar: no se puede ir al pasado
            }
            this.fechaBaseCalendario.setDate(this.fechaBaseCalendario.getDate() + (direccion * 7));
            this.generarCalendario();
        },

        cambiarDiaMobile(direccion) {
            const doc = this._doctorActual;
            const diasLaborables = (doc && doc.horarios_atencion && doc.horarios_atencion.dias)
                ? doc.horarios_atencion.dias
                : [1, 2, 3, 4, 5, 6];

            // ── Construir el día de inicio (el día actualmente visible) ──
            const hoyBase = new Date(this.fechaBaseCalendario);
            const diaSemanaBase = hoyBase.getDay();
            const diffBaseAlLunes = diaSemanaBase === 0 ? -6 : 1 - diaSemanaBase;
            let lunes = new Date(hoyBase);
            lunes.setDate(hoyBase.getDate() + diffBaseAlLunes);
            lunes.setHours(0, 0, 0, 0);

            let diaActual = new Date(lunes);
            diaActual.setDate(lunes.getDate() + this.diaSeleccionadoMobile);

            // ── C1: Blindaje del Límite Inferior (H5) ──
            // Compara el día visible ACTUAL (no el destino potencial) contra hoy.
            // Si el día que se muestra actualmente YA ES hoy, no hay a dónde retroceder.
            // Usa setHours(0,0,0,0) en ambos para eliminar errores de hora/minuto/segundo.
            if (direccion === -1) {
                const diaVisibleActual = new Date(lunes);
                diaVisibleActual.setDate(lunes.getDate() + this.diaSeleccionadoMobile);
                diaVisibleActual.setHours(0, 0, 0, 0);
                // ── C1 Lógico: Blindaje contra fechaInicioDisponible ──
                // El límite dinámico reemplaza la comparación contra "hoy".
                // Si el usuario ya está en el primer día con disponibilidad,
                // no tiene sentido retroceder (solo vería días sin slots).
                const limiteMinimo = this.fechaInicioDisponible
                    ? new Date(this.fechaInicioDisponible)
                    : (() => { const h = new Date(); h.setHours(0,0,0,0); return h; })();
                if (diaVisibleActual <= limiteMinimo) return; // Blindaje infranqueable
            }

            // ── Smart Jumps: avanzar/retroceder hasta el próximo día laborable ──
            let iteraciones = 0;
            const MAX_ITER = 14; // Límite de seguridad: máximo 2 semanas
            do {
                diaActual.setDate(diaActual.getDate() + direccion);

                // Recalcular el lunes de la semana en la que cae diaActual
                const dSem = diaActual.getDay();
                const diffAlLunes = dSem === 0 ? -6 : 1 - dSem;
                lunes = new Date(diaActual);
                lunes.setDate(diaActual.getDate() + diffAlLunes);
                lunes.setHours(0, 0, 0, 0);

                // Actualizar el estado del calendario con la nueva semana/día
                this.fechaBaseCalendario = new Date(lunes);
                const diffDias = Math.round((diaActual - lunes) / 86400000);
                this.diaSeleccionadoMobile = (diffDias >= 0 && diffDias <= 5) ? diffDias : 0;

                // Verificar si este día es laborable para el médico actual
                const diaSemanaIdx = diaActual.getDay(); // 0=Dom..6=Sáb
                const diaLaboralNum = diaSemanaIdx === 0 ? 7 : diaSemanaIdx; // 1=Lun..7=Dom
                if (diasLaborables.includes(diaLaboralNum)) break;

                iteraciones++;
            } while (iteraciones < MAX_ITER);
            // Si el bucle agotó las iteraciones sin encontrar un día válido,
            // se renderiza de todas formas (mostrará el empty state).

            this.generarCalendario();
        },


        irAlProximoDiaDisponible() {
            const doc = this._doctorActual;
            if (!doc) return;
            const settings = {
                duracion: doc.duracion_minutos || 30,
                diasLaborables: (doc.horarios_atencion && doc.horarios_atencion.dias) ? doc.horarios_atencion.dias : [1, 2, 3, 4, 5, 6],
                horaInicio: (doc.horarios_atencion && doc.horarios_atencion.hora_inicio) || '07:00',
                horaFin: (doc.horarios_atencion && doc.horarios_atencion.hora_fin) || '16:30',
                horaFinSabado: (doc.horarios_atencion && doc.horarios_atencion.hora_fin_sabado) || '12:30'
            };

            // Día actual que está seleccionado en móvil
            const hoy = new Date(this.fechaBaseCalendario);
            const diaSemana = hoy.getDay();
            const diffAlLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
            let lunes = new Date(hoy);
            lunes.setDate(hoy.getDate() + diffAlLunes);
            let diaActual = new Date(lunes);
            diaActual.setDate(lunes.getDate() + this.diaSeleccionadoMobile);

            let encontrado = false;
            for (let intento = 0; intento < 30; intento++) {
                diaActual.setDate(diaActual.getDate() + 1); // siguiente día

                // Recalcular en qué semana y día de la semana cae
                const dSem = diaActual.getDay();
                const diff = dSem === 0 ? -6 : 1 - dSem;
                let lunesSemana = new Date(diaActual);
                lunesSemana.setDate(diaActual.getDate() + diff);
                this.fechaBaseCalendario = new Date(lunesSemana);
                const diffDias = Math.round((diaActual - lunesSemana) / 86400000);
                if (diffDias >= 0 && diffDias <= 5) {
                    this.diaSeleccionadoMobile = diffDias;
                    const slots = this._obtenerSlotsDia(new Date(diaActual), settings);
                    const disponibles = slots.filter(s => !s.yaPaso && !s.estaOcupada);
                    if (disponibles.length > 0) {
                        encontrado = true;
                        break;
                    }
                }
            }
            // Renderizar con el nuevo día (incluso si no encontró, mostrará empty state)
            this.generarCalendario(false);
        },

        seleccionarHora(boton, label, fechaISO) {
            document.querySelectorAll('#citas-calendar-grid .time-slot--selected').forEach(el => {
                el.classList.remove('time-slot--selected');
            });
            boton.classList.add('time-slot--selected');
            this.horaSeleccionada = label;
            this.fechaISOSeleccionada = fechaISO || null;
            sessionStorage.setItem('cita_hora_seleccionada', label);
            if (fechaISO) sessionStorage.setItem('cita_fecha_iso', fechaISO);
            const btnConfirmar = document.getElementById('btn-confirmar-cita');
            if (btnConfirmar) {
                btnConfirmar.style.opacity = '1';
                btnConfirmar.style.pointerEvents = 'auto';
                btnConfirmar.disabled = false;
            }
        },

        _bloquearConfirmar() {
            this.horaSeleccionada = null;
            const btnConfirmar = document.getElementById('btn-confirmar-cita');
            if (btnConfirmar) {
                btnConfirmar.style.opacity = '0.5';
                btnConfirmar.style.pointerEvents = 'none';
                btnConfirmar.disabled = true;   // ← nuevo
            }
        },

        _configurarPaso3Modificacion() {
            const nomInput = document.getElementById('citas-nombres');
            const cedInput = document.getElementById('citas-cedula');
            const celInput = document.getElementById('citas-celular');

            // 1. Eliminar cualquier mensaje anterior (evita duplicados)
            const existente = document.getElementById('modificacion-msg');
            if (existente) existente.remove();

            // 2. Restaurar el formulario para citas nuevas
            if (nomInput) nomInput.removeAttribute('readonly');
            if (cedInput) cedInput.removeAttribute('readonly');
            if (celInput) celInput.removeAttribute('readonly');

            // 3. Detectar si estamos en modo *modificación*
            const modCtxStr = sessionStorage.getItem('cita_modificacion');
            if (!modCtxStr) return;   // flujo normal, termina

            let modCtx;
            try { modCtx = JSON.parse(modCtxStr); } catch (e) { return; }

            // 4. Recuperar los datos originales de la cita (nombre y cédula)
            const misCitas = JSON.parse(localStorage.getItem('sanitas_mis_citas') || '[]');
            let citaOriginal = null;
            if (modCtx.id_cita) {
                citaOriginal = misCitas.find(c => (c.id_cita === modCtx.id_cita || c.id === modCtx.id_cita || c._id === modCtx.id_cita));
            }
            if (!citaOriginal) {
                // fallback por coincidencia de datos
                citaOriginal = misCitas.find(c =>
                    c.cedula === modCtx.cedula && c.medico === modCtx.medico && c.fecha === modCtx.fechaVieja && c.hora === modCtx.horaVieja
                );
            }

            if (citaOriginal) {
                // 5. Prellenar la identidad del paciente
                if (nomInput) nomInput.value = citaOriginal.paciente || '';
                if (cedInput) cedInput.value = citaOriginal.cedula || '';

                // 6. Bloquear los campos de identidad (solo lectura)
                if (nomInput) nomInput.setAttribute('readonly', 'readonly');
                if (cedInput) cedInput.setAttribute('readonly', 'readonly');

                // 7. Inyectar mensaje de advertencia colorido
                const container = document.getElementById('citas-step-3');
                if (container) {
                    const msgDiv = document.createElement('div');
                    msgDiv.id = 'modificacion-msg';
                    msgDiv.className = 'modificacion-alert';
                    msgDiv.innerHTML = '<i class="fa-solid fa-circle-info" style="margin-right: 8px;"></i>Estás reprogramando una cita existente. Por seguridad, la identidad del paciente no puede ser modificada.';
                    container.insertBefore(msgDiv, container.firstChild);
                }
            }
        },

        // ------------------------------------------------------------------
        // Helpers de validación Paso 3 (Invitado)
        // ------------------------------------------------------------------

        // Valida lógicamente los campos del Paso 3.
        // Si mostrarErrores=true, pinta los campos con su estado en el blur.
        validarPaso3(mostrarErrores = false) {
            const nom = document.getElementById('citas-nombres');
            const ced = document.getElementById('citas-cedula');
            const cel = document.getElementById('citas-celular');

            const nomVal = (nom?.value || '').trim();
            const cedVal = (ced?.value || '').trim();
            const celVal = (cel?.value || '').trim();

            const nomOk = nomVal.length >= 3;
            const cedOk = /^\d{10}$/.test(cedVal) && this.validarCedulaEcuatoriana(cedVal);
            const celOk = /^09\d{8}$/.test(celVal);

            if (mostrarErrores) {
                // Nombres: mensaje en cascada según el tipo de error (incluye vacío)
                if (nomOk) {
                    this._setEstadoCampo(nom, 'error-nombres', true);
                } else if (nomVal.length === 0) {
                    // BUGFIX: campo vacío al perder foco → mensaje de obligatoriedad
                    this._setEstadoCampo(nom, 'error-nombres', false, 'El nombre es obligatorio.');
                } else {
                    const tieneNumeros = /\d/.test(nomVal);
                    this._setEstadoCampo(nom, 'error-nombres', false,
                        tieneNumeros ? 'Solo se aceptan letras.' : 'El nombre debe tener al menos 3 letras.');
                }

                // Cédula: mensaje en cascada según el tipo de error (incluye vacío)
                if (cedOk) {
                    this._setEstadoCampo(ced, 'error-cedula', true);
                } else if (cedVal.length === 0) {
                    // BUGFIX: campo vacío al perder foco → mensaje de obligatoriedad
                    this._setEstadoCampo(ced, 'error-cedula', false, 'La cédula es obligatoria.');
                } else {
                    this._setEstadoCampo(ced, 'error-cedula', false,
                        'La cédula no es válida. Verifica los 10 dígitos.');
                }

                // Celular: validación contextual en cascada (H9) – delegada a app._validarCelular()
                if (celOk) {
                    this._setEstadoCampo(cel, 'error-celular', true);
                } else {
                    // app._validarCelular() ya maneja el caso vacío con "El celular es obligatorio."
                    const mensajeCel = app._validarCelular(celVal) || 'El celular ingresado no es válido.';
                    this._setEstadoCampo(cel, 'error-celular', false, mensajeCel);
                }
            }

            return nomOk && cedOk && celOk;
        },

        // ------------------------------------------------------------------
        // Atomic Blur: Validación AISLADA de un solo campo.
        // Cumple el estándar "Aislamiento de Validación (Atomic Blur)" de
        // technical-requirements.md §6. Solo actúa sobre el inputId recibido;
        // nunca toca ni evalúa otros campos del formulario.
        // ------------------------------------------------------------------
        _validarCampoAislado(inputId, errId) {
            const el = document.getElementById(inputId);
            if (!el) return;
            const val = el.value.trim();

            if (inputId === 'citas-nombres') {
                const nomOk = val.length >= 3;
                if (nomOk) {
                    this._setEstadoCampo(el, errId, true);
                } else if (val.length === 0) {
                    this._setEstadoCampo(el, errId, false, 'El nombre es obligatorio.');
                } else {
                    const tieneNumeros = /\d/.test(val);
                    this._setEstadoCampo(el, errId, false,
                        tieneNumeros ? 'Solo se aceptan letras.' : 'El nombre debe tener al menos 3 letras.');
                }
                return;
            }

            if (inputId === 'citas-cedula') {
                const cedOk = /^\d{10}$/.test(val) && this.validarCedulaEcuatoriana(val);
                if (cedOk) {
                    this._setEstadoCampo(el, errId, true);
                } else if (val.length === 0) {
                    this._setEstadoCampo(el, errId, false, 'La cédula es obligatoria.');
                } else {
                    this._setEstadoCampo(el, errId, false, 'La cédula no es válida. Verifica los 10 dígitos.');
                }
                return;
            }

            if (inputId === 'citas-celular') {
                const celOk = /^09\d{8}$/.test(val);
                if (celOk) {
                    this._setEstadoCampo(el, errId, true);
                } else {
                    // app._validarCelular() maneja vacío → "El celular es obligatorio."
                    const msg = app._validarCelular(val) || 'El celular ingresado no es válido.';
                    this._setEstadoCampo(el, errId, false, msg);
                }
                return;
            }
        },

        // Helper único: aplica borde de color y mensaje de error al campo.
        _setEstadoCampo(input, errorId, esValido, mensaje = '') {
            if (!input) return;
            const error = document.getElementById(errorId);
            if (esValido) {
                input.style.borderColor = '#0DA99F';
                if (error) error.style.display = 'none';
            } else {
                input.style.borderColor = '#e74c3c';
                if (error) {
                    if (mensaje) error.textContent = mensaje;
                    error.style.display = 'block';
                }
            }
        },

        actualizarEstadoBotonSiguiente() {
            const btn = document.getElementById('btn-citas-siguiente');
            if (!btn) return;

            // Validamos solo la lógica (sin pintar errores rojos)
            const esValido = this.validarPaso3(false);

            if (esValido) {
                btn.style.opacity = "1";
                btn.style.pointerEvents = "auto";
                btn.style.cursor = "pointer";
                btn.style.backgroundColor = "#FDAD34";
            } else {
                btn.style.opacity = "0.5";
                btn.style.pointerEvents = "none";
                btn.style.cursor = "default";
            }
        },

        configurarValidadores() {
            const config = [
                { id: 'citas-nombres', err: 'error-nombres' },
                { id: 'citas-cedula', err: 'error-cedula' },
                { id: 'citas-celular', err: 'error-celular' }
            ];

            config.forEach(item => {
                const el = document.getElementById(item.id);
                if (!el) return;

                // AL ESCRIBIR (Input): Sanitización + habilitación silenciosa del botón.
                // Este listener NO debe pintar errores ni tocar otros campos.
                el.addEventListener('input', (e) => {
                    // Filtros de caracteres en tiempo real (Regex Whitelist)
                    if (item.id === 'citas-nombres') e.target.value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
                    else e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);

                    // Devolvemos el campo a estado neutral mientras el usuario escribe
                    el.style.borderColor = '#ccc';
                    const errorEl = document.getElementById(item.err);
                    if (errorEl) errorEl.style.display = 'none';

                    // Validación global SILENCIOSA: solo habilita/deshabilita el botón Siguiente
                    this.actualizarEstadoBotonSiguiente();
                });

                // AL SALIR DEL CAMPO (Blur): Validación ATÓMICA – solo actúa sobre e.target.
                // PROHIBIDO llamar a validarPaso3(true) aquí (afectaría campos no visitados).
                el.addEventListener('blur', () => {
                    this._validarCampoAislado(item.id, item.err);
                });
            });

            this.actualizarEstadoBotonSiguiente();
        },

        validarCedulaEcuatoriana(cedula) {
            if (cedula.length !== 10) return false;

            const digitoRegion = parseInt(cedula.substring(0, 2), 10);
            if (digitoRegion < 1 || digitoRegion > 24) return false;

            const tercerDigito = parseInt(cedula.substring(2, 3), 10);
            if (tercerDigito >= 6) return false;

            const digitosMagicos = [2, 1, 2, 1, 2, 1, 2, 1, 2];
            let suma = 0;

            for (let i = 0; i < 9; i++) {
                let valor = parseInt(cedula.charAt(i), 10) * digitosMagicos[i];
                if (valor >= 10) valor = valor - 9;
                suma += valor;
            }

            let digitoVerificador = suma % 10 === 0 ? 0 : 10 - (suma % 10);
            return digitoVerificador === parseInt(cedula.charAt(9), 10);
        },



        // Modal específico para conflicto de buffer
        _mostrarModalBuffer(detalleCitaPrevia, duracionMin, horaSugerida) {
            let modal = document.getElementById('modal-buffer-cita');
            if (modal) modal.remove();

            modal = document.createElement('div');
            modal.id = 'modal-buffer-cita';
            modal.className = 'modal-overlay';
            modal.setAttribute('role', 'alertdialog');
            modal.setAttribute('aria-modal', 'true');
            modal.style.display = 'flex';

            // Funciones internas que generan los dos estados del modal
            const renderState1 = () => `
                <div class="modal-content modal-colision-content" id="buffer-state-content">
                    <i class="fa-solid fa-clock fa-3x alert-colision-icon" aria-hidden="true" style="color: #e67e22;"></i>
                    <h2 class="modal-colision-title">Horario no disponible</h2>
                    <p class="modal-colision-text">
                        No puedes tomar este horario. Tienes una cita previa en <strong>${detalleCitaPrevia}.</strong>
                        <br>Dicha consulta dura <strong>${duracionMin} minutos</strong> y por políticas del centro médico debes dejar un margen de <strong>30 minutos</strong> para traslados.
                        <br><br>Intenta un horario posterior a las <strong>${horaSugerida}</strong>.
                    </p>
                    <div class="modal-colision-actions">
                        <button id="btn-buffer-elegir-otro" class="btn btn--primario btn-full-width btn-margin-bottom">
                            Elegir otro horario
                        </button>
                        <button id="btn-buffer-abandonar" class="btn btn--secundario btn-full-width">
                            Abandonar reserva
                        </button>
                    </div>
                </div>
            `;

            const renderState2 = () => `
                <div class="modal-content modal-colision-content" id="buffer-state-content">
                    <i class="fa-solid fa-triangle-exclamation fa-3x alert-colision-icon" aria-hidden="true" style="color: #e67e22;"></i>
                    <h2 class="modal-colision-title">¿Abandonar reserva?</h2>
                    <p class="modal-colision-text" style="margin-bottom: 20px;">
                        ⚠️ Atención: Estás a punto de salir del agendamiento. Los datos que ingresaste se borrarán. ¿Deseas continuar?
                    </p>
                    <div class="modal-colision-actions">
                        <button id="btn-buffer-no-volver" class="btn btn--primario btn-full-width btn-margin-bottom">
                            No, volver
                        </button>
                        <button id="btn-buffer-si-salir" class="btn btn--peligro btn-full-width">
                            Sí, salir y borrar datos
                        </button>
                    </div>
                </div>
            `;

            // Inyectar estado 1
            modal.innerHTML = renderState1();
            document.body.appendChild(modal);

            // Asociar handlers del estado 1
            this._bindState1Handlers(modal, renderState1, renderState2);
        },

        _mostrarModalLimiteDiario(especialidad, fecha) {
            let modal = document.getElementById('modal-limite-diario');
            if (modal) modal.remove();

            modal = document.createElement('div');
            modal.id = 'modal-limite-diario';
            modal.className = 'modal-overlay';
            modal.setAttribute('role', 'alertdialog');
            modal.setAttribute('aria-modal', 'true');
            modal.style.display = 'flex';

            // ESTADO 1: Aviso de Límite Alcanzado
            const renderState1 = () => `
                <div class="modal-content modal-colision-content">
                    <i class="fa-solid fa-circle-exclamation fa-3x alert-colision-icon" aria-hidden="true" style="color: #e67e22;"></i>
                    <h2 class="modal-colision-title">Límite diario alcanzado</h2>
                    <p class="modal-colision-text">
                        ⚠️ El paciente ya cuenta con una cita programada en <strong>${especialidad}</strong> para el <strong>${fecha}</strong>.
                        Por políticas del centro médico, solo se permite una reserva por especialidad al día.
                    </p>
                    <div class="modal-colision-actions">
                        <button id="btn-limite-entendido" class="btn btn--primario btn-full-width btn-margin-bottom">
                            Entendido, elegir otro día
                        </button>
                        <button id="btn-limite-abandonar" class="btn btn--secundario btn-full-width">
                            Abandonar reserva
                        </button>
                    </div>
                </div>
            `;

            // ESTADO 2: Confirmación de Abandono (Prevención de Errores)
            const renderState2 = () => `
                <div class="modal-content modal-colision-content">
                    <i class="fa-solid fa-triangle-exclamation fa-3x alert-colision-icon" aria-hidden="true" style="color: #e67e22;"></i>
                    <h2 class="modal-colision-title">¿Abandonar reserva?</h2>
                    <p class="modal-colision-text" style="margin-bottom: 20px;">
                        ⚠️ Atención: Estás a punto de salir del agendamiento. Los datos ingresados se borrarán. ¿Deseas continuar?
                    </p>
                    <div class="modal-colision-actions">
                        <button id="btn-limite-no-volver" class="btn btn--primario btn-full-width btn-margin-bottom">
                            No, volver
                        </button>
                        <button id="btn-limite-si-salir" class="btn btn--peligro btn-full-width">
                            Sí, salir y borrar datos
                        </button>
                    </div>
                </div>
            `;

            modal.innerHTML = renderState1();
            document.body.appendChild(modal);

            // Controlador de Eventos Dinámicos
            const bindEvents = () => {
                // Acción 1: Volver al calendario
                document.getElementById('btn-limite-entendido').addEventListener('click', () => {
                    this._cerrarModalLimiteDiario();
                    this._bloquearConfirmar();
                    document.querySelectorAll('#citas-calendar-grid .time-slot--selected')
                        .forEach(el => el.classList.remove('time-slot--selected'));
                    this.horaSeleccionada = null;
                    this.mostrarPaso(2);
                    this.generarCalendario();
                });

                // Acción 2: Intentar abandonar
                const btnAbandonar = document.getElementById('btn-limite-abandonar');
                if (btnAbandonar) {
                    btnAbandonar.addEventListener('click', () => {
                        modal.innerHTML = renderState2(); // Cambio de contexto en línea

                        // Acción 2.1: Arrepentirse y volver al aviso
                        document.getElementById('btn-limite-no-volver').addEventListener('click', () => {
                            modal.innerHTML = renderState1();
                            bindEvents(); // Re-atar eventos
                        });

                        // Acción 2.2: Confirmar abandono (Hard Reset)
                        document.getElementById('btn-limite-si-salir').addEventListener('click', () => {
                            ['reservaCita_preseleccion', 'especialidad_seleccionada', 'cita_modificacion', 'cita_hora_seleccionada', 'cita_fecha_iso', 'temp_datos_recuperacion'].forEach(key => sessionStorage.removeItem(key));
                            ['citas-nombres', 'citas-cedula', 'citas-celular'].forEach(id => {
                                const el = document.getElementById(id);
                                if (el) { el.value = ''; el.style.borderColor = '#ccc'; }
                            });
                            this._cerrarModalLimiteDiario();
                            app.navegar('home');
                        });
                    });
                }
            };

            bindEvents();
        },
        _cerrarModalLimiteDiario() {
            const modal = document.getElementById('modal-limite-diario');
            if (modal) modal.remove();
        },

        // NUEVA FUNCIÓN AUXILIAR (colócala justo después de _mostrarModalBuffer)
        _bindState1Handlers(modal, renderState1, renderState2) {
            // ── Acción: Elegir otro horario (retención de contexto) ──
            const btnElegir = document.getElementById('btn-buffer-elegir-otro');
            if (btnElegir) {
                btnElegir.onclick = () => {
                    // Guardar datos actuales del Paso 3 para no perderlos
                    const nom = document.getElementById('citas-nombres');
                    const ced = document.getElementById('citas-cedula');
                    const cel = document.getElementById('citas-celular');
                    const tempData = {
                        nombres: nom ? nom.value.trim() : '',
                        cedula: ced ? ced.value.trim() : '',
                        celular: cel ? cel.value.trim() : ''
                    };
                    sessionStorage.setItem('temp_datos_recuperacion', JSON.stringify(tempData));
                    this.cerrarModalBuffer();
                    // Resetear selección de hora y retroceder al calendario
                    document.querySelectorAll('#citas-calendar-grid .time-slot--selected')
                        .forEach(el => el.classList.remove('time-slot--selected'));
                    this.horaSeleccionada = null;
                    this.mostrarPaso(2);
                    this.generarCalendario();
                };
            }

            // ── Acción: Abandonar reserva (ahora abre confirmación inline) ──
            const btnAbandonar = document.getElementById('btn-buffer-abandonar');
            if (btnAbandonar) {
                btnAbandonar.onclick = () => {
                    // Transformar el modal al Estado 2
                    modal.innerHTML = renderState2();

                    // Configurar botones del estado 2
                    document.getElementById('btn-buffer-no-volver').onclick = () => {
                        // Restaurar estado 1 y sus handlers
                        modal.innerHTML = renderState1();
                        this._bindState1Handlers(modal, renderState1, renderState2);
                    };

                    document.getElementById('btn-buffer-si-salir').onclick = () => {
                        // Hard Reset: eliminar todo rastro de la reserva
                        [
                            'reservaCita_preseleccion',
                            'especialidad_seleccionada',
                            'cita_modificacion',
                            'cita_hora_seleccionada',
                            'cita_fecha_iso',
                            'temp_datos_recuperacion'
                        ].forEach(key => sessionStorage.removeItem(key));

                        // Limpiar campos visuales del Paso 3
                        ['citas-nombres', 'citas-cedula', 'citas-celular'].forEach(id => {
                            const el = document.getElementById(id);
                            if (el) {
                                el.value = '';
                                el.style.borderColor = '#ccc';
                            }
                        });

                        this.cerrarModalBuffer();
                        app.navegar('home');
                    };
                };
            }
        },

        cerrarModalBuffer() {
            const modal = document.getElementById('modal-buffer-cita');
            if (modal) modal.remove();
        },
    },

    // ======================================================================
    // 0. UTILIDADES TRANSVERSALES (Validación Cédula, Restricción Edad)
    // ======================================================================
    utilidades: {
        /**
         * Algoritmo oficial del Módulo 10 para cédulas ecuatorianas.
         * Acepta 10 dígitos o 13 (RUC persona natural – valida primeros 10).
         * @param {string} cedula
         * @returns {boolean}
         */
        validarCedulaEcuatoriana(cedula) {
            if (!cedula) return false;
            const digitos = cedula.replace(/\D/g, '');
            if (digitos.length !== 10 && digitos.length !== 13) return false;

            // Si es RUC 13 dígitos, los últimos 3 deben ser 001 (persona natural)
            if (digitos.length === 13 && digitos.substring(10) !== '001') return false;

            const base = digitos.substring(0, 10);
            const digitoRegion = parseInt(base.substring(0, 2), 10);
            if (digitoRegion < 1 || digitoRegion > 24) return false;

            const tercerDigito = parseInt(base.charAt(2), 10);
            if (tercerDigito >= 6) return false;

            const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
            let suma = 0;
            for (let i = 0; i < 9; i++) {
                let valor = parseInt(base.charAt(i), 10) * coeficientes[i];
                if (valor >= 10) valor -= 9;
                suma += valor;
            }
            const digitoVerificador = suma % 10 === 0 ? 0 : 10 - (suma % 10);
            return digitoVerificador === parseInt(base.charAt(9), 10);
        },

        /**
         * Restringe un input type="date" a un rango de edad entre 18 y 60 años.
         * @param {string} inputId - id del elemento <input type="date">
         */
        aplicarRestriccionEdad(inputId) {
            const input = document.getElementById(inputId);
            if (!input) return;

            const hoy = new Date();
            const maxDate = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate());
            const minDate = new Date(hoy.getFullYear() - 60, hoy.getMonth(), hoy.getDate());

            const format = d => d.toISOString().split('T')[0];
            input.setAttribute('min', format(minDate));
            input.setAttribute('max', format(maxDate));
        },

        /**
         * Imprime el área indicada usando el diálogo nativo del navegador.
         * El @media print en styles.css se encarga de ocultar header, footer,
         * .bottom-nav y botones de acción automáticamente.
         * @param {string} idContenedor - ID del elemento a imprimir.
         */
        imprimirArea(idContenedor) {
            const contenedor = document.getElementById(idContenedor);
            if (!contenedor) {
                console.warn(`[app.utilidades] imprimirArea: no se encontró el contenedor "${idContenedor}".`);
                return;
            }
            window.print();
        },

        /**
         * Genera y descarga un PDF del contenedor indicado usando html2pdf.js (CDN).
         * Configuración: margen 10mm, formato A4, calidad de imagen óptima.
         * @param {string} idContenedor  - ID del elemento a exportar.
         * @param {string} nombreArchivo - Nombre del archivo descargado (sin extensión).
         */
        descargarPDF(idContenedor, nombreArchivo) {
            const contenedor = document.getElementById(idContenedor);
            if (!contenedor) {
                console.warn(`[app.utilidades] descargarPDF: no se encontró el contenedor "${idContenedor}".`);
                return;
            }

            if (typeof html2pdf === 'undefined') {
                console.error('[app.utilidades] descargarPDF: la librería html2pdf.js no está cargada.');
                return;
            }

            const opciones = {
                margin:       10,
                filename:     `${nombreArchivo || 'documento'}.pdf`,
                image:        { type: 'jpeg', quality: 0.95 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            html2pdf().set(opciones).from(contenedor).save();
        },

        /**
         * Genera HTML de ticket/comprobante a partir de un objeto cita.
         * Adaptado de app.citas._generarTicketHTML para recibir un objeto cita
         * en lugar de parámetros sueltos.
         * @param {Object} cita - Objeto con {medico, especialidad, fecha, hora, paciente}
         * @returns {string} HTML del ticket
         */
        _generarTicketHTML(cita) {
            const medico = cita.medico || '—';
            const especialidad = cita.especialidad || '—';
            const fechaHora = (cita.fecha || '') + (cita.hora ? ', ' + cita.hora : '');
            const paciente = cita.paciente || '—';

            return `
                <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; text-align: center; font-family: sans-serif; box-sizing: border-box;">
                    <div style="margin-bottom: 20px;">
                        <h1 style="font-size: 1.8rem; color: #3B49A3; margin: 0 0 5px 0;">Centro Médico Familiar</h1>
                        <h2 style="font-size: 1.3rem; color: #0DA99F; margin: 0 0 10px 0;">Dra. Verónica Barahona</h2>
                        <p style="font-size: 1rem; color: #555; margin: 0;">Pifo, Ignacio Jarrín y Tulio Garzón · Quito, Ecuador</p>
                        <p style="font-size: 1rem; color: #555; margin: 5px 0 0 0;">Tel: 099 890 8034</p>
                    </div>
                    <h3 style="color: #3B49A3; font-size: 1.4rem; margin-bottom: 30px; border-bottom: 2px solid #0DA99F; padding-bottom: 10px; display: inline-block;">COMPROBANTE DE CITA MÉDICA</h3>
                    <div style="text-align: left; margin: 0 auto 30px auto; max-width: 400px; font-size: 1.1rem; line-height: 1.6; color: #333;">
                        <p style="margin: 0 0 10px 0;"><strong>Fecha y Hora:</strong> ${fechaHora}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Médico:</strong> ${medico}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Especialidad:</strong> ${especialidad}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Paciente:</strong> ${paciente}</p>
                    </div>
                    <div style="background: #fef9e7; border-left: 4px solid #FDAD34; padding: 15px; font-size: 0.9rem; color: #666; text-align: left; max-width: 600px; margin: 0 auto;">
                        <strong style="color: #c47f0a;">Importante:</strong> Presente este comprobante al momento de su consulta. Para cancelar o reprogramar, comuníquese con anticipación al 099 890 8034.
                    </div>
                    <p style="font-size: 0.8rem; color: #aaa; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
                        Documento generado electrónicamente · ${new Date().toLocaleDateString('es-EC')}
                    </p>
                </div>
            `;
        },

        /**
         * Imprime un comprobante de cita usando window.open (sistema limpio, sin sidebar).
         * Clona la lógica exacta de app.citas.imprimirComprobante.
         * @param {Object} cita - Objeto cita con {medico, especialidad, fecha, hora, paciente}
         */
        imprimirCita(cita) {
            const ticketHTML = this._generarTicketHTML(cita);
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Imprimir Comprobante</title>
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            background: #fff;
                            display: flex;
                            justify-content: center;
                            align-items: flex-start;
                        }
                        @media print {
                            @page { size: letter; margin: 0.5in; }
                        }
                    </style>
                </head>
                <body>
                    ${ticketHTML}
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                window.close();
                            }, 500);
                        }
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        },

        /**
         * Descarga un PDF de comprobante de cita usando jsPDF nativo (sin html2canvas).
         * Clona la lógica exacta de app.citas.descargarComprobantePDF.
         * @param {Object} cita - Objeto cita con {medico, especialidad, fecha, hora, paciente}
         */
        descargarPDFCita(cita) {
            const medico = cita.medico || '—';
            const especialidad = cita.especialidad || '—';
            const fechaHora = (cita.fecha || '') + (cita.hora ? ', ' + cita.hora : '');
            const paciente = cita.paciente || '—';

            try {
                const { jsPDF } = window.jspdf || window;
                const doc = new jsPDF('p', 'mm', 'letter');

                const pageWidth = 215.9;
                const margin = 25;
                let y = margin;

                // Encabezado
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(18);
                doc.setTextColor(59, 73, 163);
                doc.text('Centro Médico Familiar', pageWidth / 2, y, { align: 'center' });
                y += 10;

                doc.setFontSize(13);
                doc.setTextColor(13, 169, 159);
                doc.text('Dra. Verónica Barahona', pageWidth / 2, y, { align: 'center' });
                y += 7;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(85, 85, 85);
                doc.text('Pifo, Ignacio Jarrín y Tulio Garzón · Quito, Ecuador', pageWidth / 2, y, { align: 'center' });
                y += 5;
                doc.text('Tel: 099 890 8034', pageWidth / 2, y, { align: 'center' });
                y += 12;

                // Línea separadora
                doc.setDrawColor(13, 169, 159);
                doc.setLineWidth(0.5);
                doc.line(margin, y, pageWidth - margin, y);
                y += 8;

                // Título
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.setTextColor(59, 73, 163);
                doc.text('COMPROBANTE DE CITA MÉDICA', pageWidth / 2, y, { align: 'center' });
                y += 12;

                // Detalles
                const leftX = margin + 10;
                const valueX = leftX + 45;
                doc.setFontSize(12);
                doc.setTextColor(33, 33, 33);

                const campos = [
                    { label: 'Fecha y Hora:', value: fechaHora },
                    { label: 'Médico:', value: medico },
                    { label: 'Especialidad:', value: especialidad },
                    { label: 'Paciente:', value: paciente }
                ];
                campos.forEach(campo => {
                    doc.setFont('helvetica', 'bold');
                    doc.text(campo.label, leftX, y);
                    doc.setFont('helvetica', 'normal');
                    doc.text(campo.value, valueX, y);
                    y += 10;
                });

                y += 6;

                // Nota
                doc.setFillColor(254, 249, 231);
                doc.rect(margin, y, pageWidth - 2 * margin, 20, 'F');
                doc.setDrawColor(253, 173, 52);
                doc.setLineWidth(1.2);
                doc.line(margin, y, margin, y + 20);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(196, 127, 10);
                doc.text('Importante:', margin + 6, y + 6);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(102, 102, 102);
                const nota = doc.splitTextToSize(
                    'Presente este comprobante al momento de su consulta. Para cancelar o reprogramar, comuníquese con anticipación al 099 890 8034.',
                    pageWidth - 2 * margin - 12
                );
                doc.text(nota, margin + 6, y + 12);
                y += 28;

                // Pie
                doc.setFontSize(9);
                doc.setTextColor(170);
                doc.text(`Documento generado electrónicamente · ${new Date().toLocaleDateString('es-EC')}`, pageWidth / 2, y, { align: 'center' });

                doc.save('Cita_Medica.pdf');
            } catch (e) {
                console.error('Error al generar PDF:', e);
                alert('Error al generar PDF. Asegúrate de que la librería jsPDF esté cargada.');
            }
        },

        /**
         * Genera HTML profesional de receta médica a partir de un objeto receta.
         * Incluye membrete, info paciente, diagnóstico y tabla de medicamentos.
         * @param {Object} receta - Objeto con {medico, fecha, diagnostico[], medicamentos[]}
         * @returns {string} HTML de la receta
         */
        _generarRecetaHTML(receta) {
            const medico = receta.medico || '—';
            const fechaFmt = receta.fecha
                ? receta.fecha.split('-').reverse().join('/')
                : '—';
            const diags = (receta.diagnostico || []).join(', ') || '—';

            const filaMeds = (receta.medicamentos || []).map((m, i) => `
                <tr>
                    <td style="padding:8px 10px; border-bottom:1px solid #e0e0e0; font-size:0.95rem;">${i + 1}</td>
                    <td style="padding:8px 10px; border-bottom:1px solid #e0e0e0; font-size:0.95rem; font-weight:600;">${m.nombre}</td>
                    <td style="padding:8px 10px; border-bottom:1px solid #e0e0e0; font-size:0.85rem;">${m.dosis}</td>
                    <td style="padding:8px 10px; border-bottom:1px solid #e0e0e0; font-size:0.95rem; text-align:center;">${m.cantidad || '—'}</td>
                    <td style="padding:8px 10px; border-bottom:1px solid #e0e0e0; font-size:0.9rem;">${m.via}</td>
                </tr>
            `).join('');

            return `
                <div style="max-width:700px; margin:0 auto; padding:30px 25px; font-family:sans-serif; box-sizing:border-box; color:#333;">
                    <!-- Membrete -->
                    <div style="text-align:center; margin-bottom:15px;">
                        <h1 style="font-size:1.8rem; color:#3B49A3; margin:0 0 5px 0;">Centro Médico Familiar</h1>
                        <h2 style="font-size:1.3rem; color:#0DA99F; margin:0 0 8px 0;">Dra. Verónica Barahona</h2>
                        <p style="font-size:0.95rem; color:#555; margin:0;">Pifo, Ignacio Jarrín y Tulio Garzón · Quito, Ecuador</p>
                        <p style="font-size:0.95rem; color:#555; margin:3px 0 0 0;">Tel: 099 890 8034</p>
                    </div>
                    <h3 style="color:#3B49A3; font-size:1.3rem; margin-bottom:20px; border-bottom:2px solid #0DA99F; padding-bottom:8px; text-align:center; display:inline-block; width:100%;">RECETA MÉDICA</h3>

                    <!-- Info del paciente / receta -->
                    <div style="margin-bottom:18px; font-size:1.05rem; line-height:1.6;">
                        <p style="margin:0 0 6px 0;"><strong>Médico prescriptor:</strong> ${medico}</p>
                        <p style="margin:0 0 6px 0;"><strong>Fecha:</strong> ${fechaFmt}</p>
                        <p style="margin:0 0 6px 0;"><strong>Diagnóstico:</strong> ${diags}</p>
                    </div>

                    <!-- Tabla de medicamentos -->
                    <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
                        <thead>
                            <tr style="background:#3B49A3; color:#fff;">
                                <th style="padding:8px 10px; text-align:left; font-size:0.9rem;">#</th>
                                <th style="padding:8px 10px; text-align:left; font-size:0.9rem;">Medicamento</th>
                                <th style="padding:8px 10px; text-align:left; font-size:0.9rem;">Dosis / Indicación</th>
                                <th style="padding:8px 10px; text-align:center; font-size:0.9rem;">Cant.</th>
                                <th style="padding:8px 10px; text-align:left; font-size:0.9rem;">Vía</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filaMeds}
                        </tbody>
                    </table>

                    <!-- Nota -->
                    <div style="background:#fef9e7; border-left:4px solid #FDAD34; padding:12px 15px; font-size:0.85rem; color:#666;">
                        <strong style="color:#c47f0a;">Importante:</strong> Esta receta es de uso exclusivo del paciente. No se automedique. Consulte a su médico ante cualquier reacción adversa.
                    </div>
                    <p style="font-size:0.8rem; color:#aaa; margin-top:30px; border-top:1px solid #eee; padding-top:15px; text-align:center;">
                        Documento generado electrónicamente · ${new Date().toLocaleDateString('es-EC')}
                    </p>
                </div>
            `;
        },

        /**
         * Imprime una receta médica usando window.open (sistema limpio, sin sidebar).
         * @param {Object} receta - Objeto receta
         */
        imprimirReceta(receta) {
            const recetaHTML = this._generarRecetaHTML(receta);
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Imprimir Receta Médica</title>
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            background: #fff;
                            display: flex;
                            justify-content: center;
                            align-items: flex-start;
                        }
                        @media print {
                            @page { size: letter; margin: 0.5in; }
                        }
                    </style>
                </head>
                <body>
                    ${recetaHTML}
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                window.close();
                            }, 500);
                        }
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        },

        /**
         * Descarga un PDF de receta médica usando jsPDF nativo.
         * Control estricto del eje Y para iterar medicamentos sin superposición.
         * @param {Object} receta - Objeto receta con {medico, fecha, diagnostico[], medicamentos[]}
         */
        descargarPDFReceta(receta) {
            const medico = receta.medico || '—';
            const fechaFmt = receta.fecha
                ? receta.fecha.split('-').reverse().join('/')
                : '—';
            const diags = (receta.diagnostico || []).join(', ') || '—';

            try {
                const { jsPDF } = window.jspdf || window;
                const doc = new jsPDF('p', 'mm', 'letter');

                const pageWidth = 215.9;
                const pageHeight = 279.4;
                const margin = 20;
                const contentWidth = pageWidth - 2 * margin;
                let y = margin;

                // ── Encabezado ──
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(18);
                doc.setTextColor(59, 73, 163);
                doc.text('Centro Médico Familiar', pageWidth / 2, y, { align: 'center' });
                y += 9;

                doc.setFontSize(13);
                doc.setTextColor(13, 169, 159);
                doc.text('Dra. Verónica Barahona', pageWidth / 2, y, { align: 'center' });
                y += 6;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(85, 85, 85);
                doc.text('Pifo, Ignacio Jarrín y Tulio Garzón · Quito, Ecuador', pageWidth / 2, y, { align: 'center' });
                y += 4;
                doc.text('Tel: 099 890 8034', pageWidth / 2, y, { align: 'center' });
                y += 8;

                // Línea separadora
                doc.setDrawColor(13, 169, 159);
                doc.setLineWidth(0.5);
                doc.line(margin, y, pageWidth - margin, y);
                y += 7;

                // Título
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(15);
                doc.setTextColor(59, 73, 163);
                doc.text('RECETA MÉDICA', pageWidth / 2, y, { align: 'center' });
                y += 10;

                // ── Info de la receta ──
                doc.setFontSize(11);
                doc.setTextColor(33, 33, 33);
                doc.setFont('helvetica', 'bold');
                doc.text('Médico prescriptor:', margin, y);
                doc.setFont('helvetica', 'normal');
                doc.text(medico, margin + 43, y);
                y += 7;

                doc.setFont('helvetica', 'bold');
                doc.text('Fecha:', margin, y);
                doc.setFont('helvetica', 'normal');
                doc.text(fechaFmt, margin + 43, y);
                y += 7;

                doc.setFont('helvetica', 'bold');
                doc.text('Diagnóstico:', margin, y);
                doc.setFont('helvetica', 'normal');
                const diagLines = doc.splitTextToSize(diags, contentWidth - 43);
                doc.text(diagLines, margin + 43, y);
                y += diagLines.length * 5 + 5;

                // ── Tabla de medicamentos ──
                // Cabecera
                doc.setFillColor(59, 73, 163);
                doc.rect(margin, y, contentWidth, 8, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(255, 255, 255);

                const col1 = margin + 2;
                const col2 = margin + 10;
                const col3 = margin + 75;
                const col4 = margin + 140;
                const col5 = margin + 155;

                doc.text('#', col1, y + 5.5);
                doc.text('Medicamento', col2, y + 5.5);
                doc.text('Dosis / Indicación', col3, y + 5.5);
                doc.text('Cant.', col4, y + 5.5);
                doc.text('Vía', col5, y + 5.5);
                y += 10;

                // Filas de medicamentos — control estricto del eje Y
                doc.setTextColor(33, 33, 33);
                const meds = receta.medicamentos || [];
                meds.forEach((m, idx) => {
                    // Calcular altura necesaria para esta fila
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(9);
                    const nombreLines = doc.splitTextToSize(m.nombre || '', 62);
                    doc.setFont('helvetica', 'normal');
                    const dosisLines = doc.splitTextToSize(m.dosis || '', 62);
                    const maxLines = Math.max(nombreLines.length, dosisLines.length, 1);
                    const rowHeight = maxLines * 4.5 + 4;

                    // Salto de página si no cabe
                    if (y + rowHeight > pageHeight - 30) {
                        doc.addPage();
                        y = margin;
                    }

                    // Fondo alterno
                    if (idx % 2 === 0) {
                        doc.setFillColor(245, 245, 250);
                        doc.rect(margin, y, contentWidth, rowHeight, 'F');
                    }

                    const textY = y + 4.5;
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(9);
                    doc.text(String(idx + 1), col1, textY);

                    doc.setFont('helvetica', 'bold');
                    doc.text(nombreLines, col2, textY);

                    doc.setFont('helvetica', 'normal');
                    doc.text(dosisLines, col3, textY);
                    doc.text(String(m.cantidad || '—'), col4 + 3, textY);
                    doc.text(m.via || '—', col5, textY);

                    y += rowHeight;
                });

                y += 8;

                // ── Nota ──
                if (y + 25 > pageHeight - 20) {
                    doc.addPage();
                    y = margin;
                }
                doc.setFillColor(254, 249, 231);
                doc.rect(margin, y, contentWidth, 18, 'F');
                doc.setDrawColor(253, 173, 52);
                doc.setLineWidth(1.2);
                doc.line(margin, y, margin, y + 18);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(196, 127, 10);
                doc.text('Importante:', margin + 5, y + 5);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(102, 102, 102);
                const nota = doc.splitTextToSize(
                    'Esta receta es de uso exclusivo del paciente. No se automedique. Consulte a su médico ante cualquier reacción adversa.',
                    contentWidth - 10
                );
                doc.text(nota, margin + 5, y + 10);
                y += 24;

                // ── Pie ──
                doc.setFontSize(8);
                doc.setTextColor(170);
                doc.text(`Documento generado electrónicamente · ${new Date().toLocaleDateString('es-EC')}`, pageWidth / 2, y + 5, { align: 'center' });

                doc.save('Receta_Medica.pdf');
            } catch (e) {
                console.error('Error al generar PDF de receta:', e);
                alert('Error al generar PDF. Asegúrate de que la librería jsPDF esté cargada.');
            }
        }
    },

    // ======================================================================
    // 7. DIRECTORIO DE ESPECIALISTAS (Búsqueda y Modal)
    // ======================================================================
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
            document.getElementById('modal-med-title').textContent = comercial;
            document.getElementById('modal-med-generic').textContent = generico;
            document.getElementById('modal-med-presentacion').textContent = presentacion || '—';
            document.getElementById('modal-med-precio').textContent = `$${precio}`;
            const stockMsg = stock === '0' ? 'Agotado' : `${stock} unidades`;
            document.getElementById('modal-med-stock').textContent = stockMsg;
            document.getElementById('modal-med-img').src = imagen;
            const recetaEl = document.getElementById('modal-med-receta');
            if (recetaEl) {
                recetaEl.style.display = (requiereReceta === 'true') ? 'flex' : 'none';
            }
            document.getElementById('modal-medicamento').style.display = 'flex';
            setTimeout(() => {
                const closeBtn = document.querySelector('#modal-medicamento .modal-close');
                if (closeBtn) closeBtn.focus();
            }, 100);
        },

        cerrarModalMedicamento() {
            document.getElementById('modal-medicamento').style.display = 'none';
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
                if (!app.utilidades.validarCedulaEcuatoriana(identificacion)) {
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
            app.utilidades.aplicarRestriccionEdad('reg-fecha-nac');

            // Deshabilitar identificación hasta que se elija tipo de documento
            const identInput = document.getElementById('reg-identificacion');
            if (identInput) {
                identInput.disabled = true;
                identInput.value = '';
            }

            // Bloquear letras en teléfonos (input)
            ['reg-celular', 'reg-fijo'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', e => {
                    e.target.value = e.target.value.replace(/\D/g, '');
                });
            });

            // Bloquear letras en cédula (input)
            const regIdent = document.getElementById('reg-identificacion');
            if (regIdent) regIdent.addEventListener('input', e => {
                if (this._tipoDoc === 'Cédula') {
                    e.target.value = e.target.value.replace(/\D/g, '');
                }
            });

            // ── ON-BLUR (valida) + ON-INPUT (limpia error al instante) ──
            // La lista es la misma para ambos eventos.
            const camposConBlur = [
                'reg-identificacion',
                'reg-nombre1',
                'reg-nombre2',
                'reg-apellido1',
                'reg-apellido2',
                'reg-fecha-nac',
                'reg-celular',
                'reg-email',
                'reg-password'
            ];

            camposConBlur.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;

                // — Eliminar handlers previos (evita duplicados al re-inicializar) —
                el.removeEventListener('blur', el._blurHandler);
                el.removeEventListener('input', el._inputHandler);
                el.removeEventListener('change', el._changeHandler);

                // BLUR → valida el campo al salir
                el._blurHandler = () => this._validarCampo(id);
                el.addEventListener('blur', el._blurHandler);

                // INPUT → limpia el error en cuanto el usuario empieza a escribir
                // Excepción: fecha usa 'change' porque no tiene 'input' en todos los browsers
                if (id === 'reg-fecha-nac') {
                    el._changeHandler = () => this._limpiarError('reg-fecha');
                    el.addEventListener('change', el._changeHandler);
                } else {
                    // Para identificación el errorId es 'reg-ident', no el id del input
                    const errorId = id === 'reg-identificacion' ? 'reg-ident' : id;
                    el._inputHandler = () => this._limpiarError(errorId);
                    el.addEventListener('input', el._inputHandler);
                }
            });

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
                // Validación contextual en cascada (H9) – delegada a app._validarCelular()
                case 'reg-celular': {
                    const val = (document.getElementById(id)?.value || '').trim();
                    const errorCelular = app._validarCelular(val);
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

            // 5. Avanzar al paso de verificación de código (Paso 3)
            this.mostrarPaso(3);
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
        // 11.4 Ir a la vista de edición: carga datos y navega
        // ------------------------------------------------------------------
        irAEditar() {
            const raw = localStorage.getItem('usuarioActivo');
            if (!raw) { app.navegar('login'); return; }

            const u = JSON.parse(raw);

            // Rellenar inputs con los datos actuales (soporta ambas claves)
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

            // Ocultar mensaje de éxito anterior
            const msg = document.getElementById('edit-success-msg');
            if (msg) msg.style.display = 'none';

            // Limpiar estilos de error previos
            ['edit-nombre1', 'edit-nombre2', 'edit-apellido1', 'edit-apellido2',
                'edit-celular', 'edit-email'].forEach(id => {
                    const el = document.getElementById(id);
                    const sp = document.getElementById(`${id}-error`);
                    if (el) el.style.borderColor = '';
                    if (sp) { sp.textContent = ''; sp.style.display = 'none'; }
                });

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
    // 12. MÓDULO SALUD — Dashboard Mis Citas / Mis Recetas
    // ======================================================================
    salud: {
        _citas: [],
        _recetas: [],
        _filtroActual: 'proximas',
        _seccionActual: 'citas',

        // ------------------------------------------------------------------
        // Datos de prototipo
        // ------------------------------------------------------------------
        _citasDemo: [
            {
                id: 'c1', medico: 'Dra. María Del Carmen Terán Pineida', especialidad: 'DERMATOLOGÍA',
                fecha: '2026-04-29', hora: '19:20', tipo: 'Consulta Externa',
                motivo: 'Control de acné', centro: 'Centro Médico Familiar Dra. Verónica Barahona',
                direccion: 'Tumbaco - Quito'
            },
            {
                id: 'c2', medico: 'Dra. María Del Carmen Terán Pineida', especialidad: 'DERMATOLOGÍA',
                fecha: '2026-01-28', hora: '19:00', tipo: 'Consulta Externa',
                motivo: 'Seguimiento tratamiento', centro: 'Centro Médico Familiar Dra. Verónica Barahona',
                direccion: 'Tumbaco - Quito'
            },
            {
                id: 'c3', medico: 'Dra. María Del Carmen Terán Pineida', especialidad: 'DERMATOLOGÍA',
                fecha: '2025-12-17', hora: '19:20', tipo: 'Consulta Externa',
                motivo: 'Evaluación dermatológica', centro: 'Centro Médico Familiar Dra. Verónica Barahona',
                direccion: 'Tumbaco - Quito'
            },
            {
                id: 'c4', medico: 'Dra. Verónica Del Pilar Barahona Charfuelan', especialidad: 'MEDICINA FAMILIAR',
                fecha: '2025-10-29', hora: '17:00', tipo: 'Consulta Externa',
                motivo: 'Revisión general', centro: 'Centro Médico Familiar Dra. Verónica Barahona',
                direccion: 'Tumbaco - Quito'
            },
            {
                id: 'c5', medico: 'Dr. Oscar Bladimir Poma Sumba', especialidad: 'MEDICINA GENERAL',
                fecha: '2025-09-04', hora: '08:20', tipo: 'Consulta Externa',
                motivo: 'Primera consulta', centro: 'Centro Médico Familiar Dra. Verónica Barahona',
                direccion: 'Tumbaco - Quito'
            },
            {
                id: 'c6', medico: 'Dr. Oscar Bladimir Poma Sumba', especialidad: 'MEDICINA GENERAL',
                fecha: '2025-07-31', hora: '09:00', tipo: 'Consulta Externa',
                motivo: 'Control de salud', centro: 'Centro Médico Familiar Dra. Verónica Barahona',
                direccion: 'Tumbaco - Quito'
            },
            {
                id: 'c7', medico: 'Dr. José Fernando Guerrero Grijalva', especialidad: 'ENDOCRINOLOGÍA',
                fecha: '2025-05-22', hora: '19:00', tipo: 'Consulta Externa',
                motivo: 'Revisión anual', centro: 'Centro Médico Familiar Dra. Verónica Barahona',
                direccion: 'Tumbaco - Quito'
            }
        ],
        _recetasDemo: [
            {
                id: 'r1', medico: 'Dra. María Del Carmen Terán Pineida', fecha: '2026-01-28',
                diagnostico: ['ACNE VULGAR', 'DERMATITIS SEBORREICA'],
                medicamentos: [
                    { nombre: 'AC LAC (ACIDO LACTICO 90GR) JABON', dosis: 'Uso diario', cantidad: 1, via: 'Tópico - Jabón' },
                    { nombre: 'ACTIVA ANTICASPA CHAMPU', dosis: 'USAR PARA EL LAVADO DEL CUERO CABELLUDO DEJAR ACTUAR 3 MINUTOS Y ENJUAGAR', cantidad: 1, via: 'Tópico - Champú' },
                    { nombre: 'URIAGE DESODORANTE', dosis: 'COLOCAR EN AXILAS TODOS LOS DIAS', cantidad: 1, via: 'Tópico - Roll-on' }
                ]
            },
            {
                id: 'r2', medico: 'Dr. Oscar Bladimir Poma Sumba', fecha: '2025-12-17',
                diagnostico: ['GASTRITIS CRONICA', 'INFECCION POR HELICOBACTER PYLORI'],
                medicamentos: [
                    { nombre: 'PACK TRIGASTRO - ESOMAX (ESOMEPRAZOL 20MG)', dosis: 'TOMAR UNA CÁPSULA CADA 12 HORAS (30 MINUTOS ANTES DEL DESAYUNO Y 30 MINUTOS ANTES DE LA CENA)', cantidad: 14, via: 'Oral - Cápsula' },
                    { nombre: 'PACK TRIGASTRO - ACROMOX', dosis: 'TOMAR UN COMPRIMIDO CADA 12 HORAS (DESPUÉS DEL DESAYUNO Y DESPUÉS DE LA CENA)', cantidad: 14, via: 'Oral - Comprimido' },
                    { nombre: 'PACK TRIGASTRO - LALEVO', dosis: 'TOMAR UN COMPRIMIDO DESPUES DEL ALMUERZO', cantidad: 7, via: 'Oral - Comprimido' },
                    { nombre: 'DIETA', dosis: 'NO ACIDOS, NI GASEOSAS, NI COLORANTES. 5 COMIDAS AL DIA.', cantidad: 0, via: 'Indicación Médica' }
                ]
            },
            {
                id: 'r3', medico: 'Dra. Marcela Paulina Pantoja Vargas', fecha: '2025-10-29',
                diagnostico: ['CANDIDIASIS VAGINAL', 'CONTROL RUTINARIO'],
                medicamentos: [
                    { nombre: 'FLUCONACX (FLUCONAZOL 150MG) TABLETAS', dosis: '150MG (Dosis única)', cantidad: 4, via: 'Oral - Tableta' },
                    { nombre: 'VAGIRAL (CLOTRIMAZOL 200MG) OVULOS', dosis: '1 Óvulo por la noche', cantidad: 6, via: 'Vaginal - Óvulo' },
                    { nombre: 'PH LAC (ACIDO LACTICO + LACTOSUERO) SOLUCION', dosis: 'Aseo íntimo diario', cantidad: 1, via: 'Tópico - Solución' }
                ]
            },
            {
                id: 'r4', medico: 'Dra. Verónica Del Pilar Barahona Charfuelan', fecha: '2025-07-31',
                diagnostico: ['FARINGOAMIGDALITIS AGUDA'],
                medicamentos: [
                    { nombre: 'CURAM 1000MG (AMOXICILINA 875MG + ACIDO CLAVULANICO 125MG) TABLETAS', dosis: '1 Tableta cada 12 horas por 7 días', cantidad: 14, via: 'Oral - Tableta' },
                    { nombre: 'ELBRUS (PARACETAMOL 1GR) SOBRES', dosis: '1 Sobre cada 8 horas en caso de fiebre o dolor', cantidad: 6, via: 'Oral - Polvo' },
                    { nombre: 'TUSSOLVINA FIT JARABE', dosis: '10 ML CADA 8 HORAS DESPUES DE LAS COMIDAS PRINCIPALES', cantidad: 1, via: 'Oral - Jarabe' },
                    { nombre: 'REMEDIO CASERO', dosis: 'GARGARAS CON AGUA DE MANZANILLA + PIZCA DE BICARBONATO 2 VECES AL DIA', cantidad: 0, via: 'Tópico bucal' }
                ]
            },
            {
                id: 'r5', medico: 'Dr. Mario Lenin Moran Molina', fecha: '2025-05-22',
                diagnostico: ['INFECCION DE VIAS URINARIAS'],
                medicamentos: [
                    { nombre: 'UVAMIN RETARD (NITROFURANTOINA 100MG) TABLETAS', dosis: '1 Tableta cada 12 horas por 10 días', cantidad: 20, via: 'Oral - Tableta' },
                    { nombre: 'DOLORGESIC (IBUPROFENO 400MG) CAPSULAS', dosis: '1 Cápsula cada 8 horas', cantidad: 12, via: 'Oral - Cápsula' },
                    { nombre: 'HIDRATACION', dosis: 'LIQUIDOS ABUNDANTES AL CLIMA', cantidad: 0, via: 'Indicación Médica' }
                ]
            }
        ],

        _parsearFechaHoraCita(cita) {
            try {
                const hora = cita.hora || '00:00';
                let fechaDate = null;
                // caso 1: formato ISO YYYY-MM-DD
                if (/^\d{4}-\d{2}-\d{2}$/.test(cita.fecha)) {
                    fechaDate = new Date(cita.fecha + 'T' + hora);
                } else {
                    // caso 2: "Martes 26 de Mayo, 07:30" o similar
                    const match = cita.fecha.match(/(\d{1,2})\s+de\s+(\w+)/i);
                    if (match) {
                        const dia = parseInt(match[1], 10);
                        const mesStr = match[2].toLowerCase();
                        const meses = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
                        if (meses[mesStr] !== undefined) {
                            const [h, m] = hora.split(':').map(Number);
                            fechaDate = new Date(new Date().getFullYear(), meses[mesStr], dia, h, m, 0);
                        }
                    }
                }
                return fechaDate && !isNaN(fechaDate) ? fechaDate : null;
            } catch (_) {
                return null;
            }
        },
        // ------------------------------------------------------------------
        // 12.1 Inicializar: cargar datos y mostrar estado inicial
        // ------------------------------------------------------------------
        inicializar() {
            const rawCitas = localStorage.getItem('sanitas_mis_citas');
            const rawRecetas = localStorage.getItem('sanitas_mis_recetas');
            this._citas = rawCitas ? JSON.parse(rawCitas) : this._citasDemo;
            this._recetas = rawRecetas ? JSON.parse(rawRecetas) : this._recetasDemo;

            // ── FILTRO POR USUARIO AUTENTICADO ──
            const usuarioLogueado = localStorage.getItem('usuarioLogueado') === 'true';
            if (usuarioLogueado) {
                try {
                    const user = JSON.parse(localStorage.getItem('usuarioActivo'));
                    if (user && user.identificacion) {
                        const idTitular = user.identificacion;
                        this._citas = this._citas.filter(cita => {
                            return cita.cedula === idTitular || cita.cedula_titular === idTitular;
                        });
                    }
                } catch (e) { }
            }

            this._filtroActual = 'proximas';
            this._seccionActual = 'citas';
            this.mostrarSeccion('citas');

            // ── Deep linking desde colisión de horarios ──
            const deepLinkStr = sessionStorage.getItem('abrir_detalle_pendiente');
            if (deepLinkStr) {
                sessionStorage.removeItem('abrir_detalle_pendiente');
                try {
                    const deepData = JSON.parse(deepLinkStr);
                    const id = deepData.id_cita;
                    const cita = this._citas.find(c => (c.id_cita === id || c.id === id || c._id === id));
                    if (cita) {
                        this.verDetalleCita(cita.id || cita._id || id);
                    }
                } catch (e) { }
            }
        },

        // ------------------------------------------------------------------
        // 12.2 Cambiar entre secciones del sidenav
        // ------------------------------------------------------------------
        mostrarSeccion(seccion) {
            this._seccionActual = seccion;

            // Secciones
            document.getElementById('salud-sec-citas').style.display = seccion === 'citas' ? 'block' : 'none';
            document.getElementById('salud-sec-recetas').style.display = seccion === 'recetas' ? 'block' : 'none';

            // Sidenav botones
            const btnCitas = document.getElementById('salud-nav-citas');
            const btnRecetas = document.getElementById('salud-nav-recetas');
            btnCitas.classList.toggle('salud-sidenav__btn--active', seccion === 'citas');
            btnCitas.setAttribute('aria-pressed', seccion === 'citas');
            btnRecetas.classList.toggle('salud-sidenav__btn--active', seccion === 'recetas');
            btnRecetas.setAttribute('aria-pressed', seccion === 'recetas');

            if (seccion === 'citas') this.filtrarCitas(this._filtroActual);
            if (seccion === 'recetas') this.renderizarRecetas();
        },

        // ------------------------------------------------------------------
        // 12.3 Tabs de citas
        // ------------------------------------------------------------------
        filtrarCitas(filtro) {
            this._filtroActual = filtro;
            document.getElementById('tab-proximas').classList.toggle('salud-tab--active', filtro === 'proximas');
            document.getElementById('tab-proximas').setAttribute('aria-selected', filtro === 'proximas');
            document.getElementById('tab-anteriores').classList.toggle('salud-tab--active', filtro === 'anteriores');
            document.getElementById('tab-anteriores').setAttribute('aria-selected', filtro === 'anteriores');

            // Ocultar detalle si está visible
            document.getElementById('salud-cita-detalle').style.display = 'none';
            document.getElementById('salud-citas-lista').style.display = 'block';

            this.renderizarCitas(filtro);
        },

        // ------------------------------------------------------------------
        // 12.4 Renderizar lista de citas
        // ------------------------------------------------------------------
        renderizarCitas(filtro) {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            const ahora = new Date();
            const filtradas = this._citas.filter(c => {
                if (c.estado === 'Cancelada') {
                    return filtro === 'anteriores';
                }
                const fechaCita = this._parsearFechaHoraCita(c);
                let esProxima = true;
                if (fechaCita) {
                    esProxima = fechaCita >= ahora;
                } else {
                    // fallback si no se puede interpretar fecha+hora
                    esProxima = (c.estado === 'Próxima');
                }
                return filtro === 'proximas' ? esProxima : !esProxima;
            });

            const estaLogueado = localStorage.getItem('usuarioLogueado') === 'true';
            let nombreTitular = '';
            if (estaLogueado) {
                try {
                    const user = JSON.parse(localStorage.getItem('usuarioActivo'));
                    if (user) {
                        const nom1 = user.nombre1 || user.nombre_1 || '';
                        const ape1 = user.apellido1 || user.apellido_1 || '';
                        nombreTitular = (nom1 + ' ' + ape1).trim();
                    }
                } catch (e) { }
            }

            const contenedor = document.getElementById('salud-citas-lista');
            if (!filtradas.length) {
                contenedor.innerHTML = '<p class="salud-empty">No hay citas en esta sección.</p>';
                return;
            }

            contenedor.innerHTML = filtradas.map(c => {
                const fechaFmt = /^\d{4}-\d{2}-\d{2}$/.test(c.fecha)
                    ? c.fecha.split('-').reverse().join('/')
                    : c.fecha;
                const idCita = c.id || c._id || String(Date.now());
                const esCancelada = c.estado === 'Cancelada';
                const badgeHtml = esCancelada
                    ? '<span class="cita-estado-badge cita-estado-badge--cancelada">Cancelada</span>'
                    : '';

                // ── Añadir línea de paciente si es distinto al titular ──
                let lineaPaciente = '';
                if (estaLogueado && nombreTitular && c.paciente && c.paciente.trim() !== '') {
                    // Normalizar: quitar espacios múltiples y comparar en minúsculas
                    const nombrePaciente = c.paciente.replace(/\s+/g, ' ').trim();
                    const nombreTitularNorm = nombreTitular.replace(/\s+/g, ' ').trim();
                    if (nombrePaciente.toLowerCase() !== nombreTitularNorm.toLowerCase()) {
                        lineaPaciente = `<span class="salud-item__sub" style="font-style:italic;color:#0DA99F;"><i class="fa-solid fa-user" style="margin-right:4px;"></i>Paciente: ${nombrePaciente}</span>`;
                    }
                }

                return `
                <div class="salud-item${esCancelada ? ' salud-item--cancelada' : ''}" role="listitem" tabindex="0"
                    onclick="app.salud.verDetalleCita('${idCita}')"
                    onkeydown="if(event.key==='Enter')app.salud.verDetalleCita('${idCita}')">
                    <div class="salud-item__info">
                        <strong class="salud-item__nombre">${c.medico || 'Médico Especialista'}</strong>
                        <span class="salud-item__sub">${c.especialidad || 'Consulta General'}</span>
                        ${lineaPaciente}
                        <span class="salud-item__fecha">${fechaFmt}${c.hora ? ' – ' + c.hora : ''} ${badgeHtml}</span>
                    </div>
                    <i class="fa-solid fa-chevron-right salud-item__arrow" aria-hidden="true"></i>
                </div>`;
            }).join('');
        },

        // ------------------------------------------------------------------
        // 12.5 Ver detalle de una cita (Maestro → Detalle)
        // ------------------------------------------------------------------
        verDetalleCita(id) {
            const idNum = isNaN(id) ? id : Number(id);
            const cita = this._citas.find(c => c.id === id || c.id === idNum || c._id === id);
            if (!cita) return;
            const fechaFmt = /^\d{4}-\d{2}-\d{2}$/.test(cita.fecha)
                ? cita.fecha.split('-').reverse().join('/')
                : cita.fecha;

            const idCita = cita.id || cita._id;
            const esCancelada = cita.estado === 'Cancelada';
            const estadoBadge = esCancelada
                ? '<span class="cita-estado-badge cita-estado-badge--cancelada">Cancelada</span>'
                : '<span class="cita-estado-badge cita-estado-badge--activa">Activa</span>';

            // Botones CRUD solo si la cita NO está cancelada
            const accionesHtml = !esCancelada ? `
                <div class="cita-acciones" role="group" aria-label="Acciones de cita">
                    <button type="button" class="cita-acciones__btn cita-acciones__btn--modificar"
                        onclick="app.salud.prepararModificacion('${idCita}')">
                        <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Cambiar Fecha/Hora
                    </button>
                    <button type="button" class="cita-acciones__btn cita-acciones__btn--cancelar"
                        onclick="app.salud.cancelarCita('${idCita}')">
                        <i class="fa-solid fa-ban" aria-hidden="true"></i> Cancelar Cita
                    </button>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
                    <button class="btn btn--documento"
                        onclick="app.salud.imprimirCitaActiva('${idCita}')">
                        <i class="fa-solid fa-print" aria-hidden="true"></i> Imprimir
                    </button>
                    <button class="btn btn--documento"
                        onclick="app.salud.descargarCitaActiva('${idCita}')">
                        <i class="fa-solid fa-file-pdf" aria-hidden="true"></i> Descargar PDF
                    </button>
                </div>` : '';

            document.getElementById('salud-cita-detalle-body').innerHTML = `
                <div class="salud-det__row">
                    <span class="salud-det__label">Estado</span>
                    <span class="salud-det__val">${estadoBadge}</span>
                </div>
                <div class="salud-det__row">
                    <span class="salud-det__label">Fecha</span>
                    <span class="salud-det__val">${fechaFmt}</span>
                </div>
                ${cita.hora ? `
                <div class="salud-det__row">
                    <span class="salud-det__label">Hora</span>
                    <span class="salud-det__val">${cita.hora}</span>
                </div>` : ''}
                <div class="salud-det__row">
                    <span class="salud-det__label">Médico tratante</span>
                    <span class="salud-det__val salud-det__val--bold">${cita.medico || 'Médico Especialista'}</span>
                </div>
                <div class="salud-det__row">
                    <span class="salud-det__label">Especialidad</span>
                    <span class="salud-det__val">${cita.especialidad || 'Consulta General'}</span>
                </div>
                ${cita.tipo ? `
                <div class="salud-det__row">
                    <span class="salud-det__label">Tipo</span>
                    <span class="salud-det__val">${cita.tipo}</span>
                </div>` : ''}
                ${cita.motivo ? `
                <div class="salud-det__row">
                    <span class="salud-det__label">Motivo</span>
                    <span class="salud-det__val">${cita.motivo}</span>
                </div>` : ''}
                ${cita.centro ? `
                <div class="salud-det__row">
                    <span class="salud-det__label">Centro Médico</span>
                    <span class="salud-det__val">${cita.centro}</span>
                </div>` : ''}
                ${cita.direccion ? `
                <div class="salud-det__row">
                    <span class="salud-det__label">Dirección</span>
                    <span class="salud-det__val">${cita.direccion}</span>
                </div>` : ''}
                ${accionesHtml}`;

            document.getElementById('salud-citas-header').style.display = 'none';
            document.getElementById('salud-citas-lista').style.display = 'none';
            document.getElementById('salud-cita-detalle').style.display = 'block';
        },

        /**
         * Imprime el comprobante de una cita activa usando el sistema nativo
         * (window.open + print), delegando a app.utilidades.imprimirCita.
         * @param {string|number} id - ID de la cita en this._citas
         */
        imprimirCitaActiva(id) {
            const idNum = isNaN(id) ? id : Number(id);
            const cita = this._citas.find(c => c.id === id || c.id === idNum || c._id === id);
            if (!cita) {
                console.warn('[app.salud] imprimirCitaActiva: cita no encontrada con ID', id);
                return;
            }
            app.utilidades.imprimirCita(cita);
        },

        /**
         * Descarga el PDF de una cita activa usando jsPDF nativo,
         * delegando a app.utilidades.descargarPDFCita.
         * @param {string|number} id - ID de la cita en this._citas
         */
        descargarCitaActiva(id) {
            const idNum = isNaN(id) ? id : Number(id);
            const cita = this._citas.find(c => c.id === id || c.id === idNum || c._id === id);
            if (!cita) {
                console.warn('[app.salud] descargarCitaActiva: cita no encontrada con ID', id);
                return;
            }
            app.utilidades.descargarPDFCita(cita);
        },

        // ------------------------------------------------------------------
        // 12.6 Renderizar lista de recetas
        // ------------------------------------------------------------------
        renderizarRecetas() {
            const contenedor = document.getElementById('salud-recetas-lista');
            if (!this._recetas.length) {
                contenedor.innerHTML = '<p class="salud-empty">No hay recetas disponibles.</p>';
                return;
            }
            contenedor.innerHTML = this._recetas.map(r => {
                const fechaFmt = r.fecha.split('-').reverse().join('/');
                const diags = r.diagnostico.map(d => `<span class="salud-item__sub">• ${d}</span>`).join('');
                return `
                <div class="salud-item" role="listitem" tabindex="0"
                     onclick="app.salud.verDetalleReceta('${r.id}')"
                     onkeydown="if(event.key==='Enter')app.salud.verDetalleReceta('${r.id}')">
                    <div class="salud-item__info">
                        <strong class="salud-item__nombre">${r.medico}</strong>
                        ${diags}
                        <span class="salud-item__fecha">${fechaFmt}</span>
                    </div>
                    <i class="fa-solid fa-chevron-right salud-item__arrow" aria-hidden="true"></i>
                </div>`;
            }).join('');
        },

        // ------------------------------------------------------------------
        // 12.7 Ver detalle de receta
        // ------------------------------------------------------------------
        verDetalleReceta(id) {
            const r = this._recetas.find(x => x.id === id);
            if (!r) return;
            const fechaFmt = r.fecha.split('-').reverse().join('/');
            const diags = r.diagnostico.map(d => `<li>– ${d}</li>`).join('');
            const meds = r.medicamentos.map(m => `
                <div class="salud-med">
                    <p class="salud-med__nombre">${m.nombre}</p>
                    <div class="salud-det__row"><span class="salud-det__label">Dosis</span><span class="salud-det__val">${m.dosis}</span></div>
                    <div class="salud-det__row"><span class="salud-det__label">Cantidad</span><span class="salud-det__val">${m.cantidad}</span></div>
                    <div class="salud-det__row"><span class="salud-det__label">Vía de administración</span><span class="salud-det__val salud-det__val--bold">${m.via}</span></div>
                </div>`).join('');

            document.getElementById('salud-receta-detalle-body').innerHTML = `
                <div class="salud-det__row">
                    <span class="salud-det__label">Fecha</span>
                    <span class="salud-det__val">${fechaFmt}</span>
                </div>
                <div class="salud-det__row">
                    <span class="salud-det__label">Médico tratante</span>
                    <span class="salud-det__val salud-det__val--bold">${r.medico}</span>
                </div>
                <div class="salud-det__section-title">Diagnóstico</div>
                <ul class="salud-det__diag">${diags}</ul>
                <hr class="salud-det__hr">
                ${meds}
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:16px;">
                    <button class="btn btn--documento"
                        onclick="app.salud.imprimirRecetaActiva('${r.id}')">
                        <i class="fa-solid fa-print" aria-hidden="true"></i> Imprimir
                    </button>
                    <button class="btn btn--documento"
                        onclick="app.salud.descargarRecetaActiva('${r.id}')">
                        <i class="fa-solid fa-file-pdf" aria-hidden="true"></i> Descargar PDF
                    </button>
                </div>`;

            document.getElementById('salud-recetas-header').style.display = 'none';
            document.getElementById('salud-recetas-lista').style.display = 'none';
            document.getElementById('salud-receta-detalle').style.display = 'block';
        },

        /**
         * Imprime el comprobante de una receta activa usando el sistema nativo
         * (window.open + print), delegando a app.utilidades.imprimirReceta.
         * @param {string} id - ID de la receta en this._recetas
         */
        imprimirRecetaActiva(id) {
            const receta = this._recetas.find(x => x.id === id);
            if (!receta) {
                console.warn('[app.salud] imprimirRecetaActiva: receta no encontrada con ID', id);
                return;
            }
            app.utilidades.imprimirReceta(receta);
        },

        /**
         * Descarga el PDF de una receta activa usando jsPDF nativo,
         * delegando a app.utilidades.descargarPDFReceta.
         * @param {string} id - ID de la receta en this._recetas
         */
        descargarRecetaActiva(id) {
            const receta = this._recetas.find(x => x.id === id);
            if (!receta) {
                console.warn('[app.salud] descargarRecetaActiva: receta no encontrada con ID', id);
                return;
            }
            app.utilidades.descargarPDFReceta(receta);
        },

        // ------------------------------------------------------------------
        // 12.8 Volver a la lista
        // ------------------------------------------------------------------
        volverALista(tipo) {
            if (tipo === 'citas') {
                document.getElementById('salud-cita-detalle').style.display = 'none';
                document.getElementById('salud-citas-header').style.display = 'block';
                document.getElementById('salud-citas-lista').style.display = 'block';
                // H1: Re-renderizar la lista para reflejar cambios
                this.renderizarCitas(this._filtroActual);
            } else {
                document.getElementById('salud-receta-detalle').style.display = 'none';
                document.getElementById('salud-recetas-header').style.display = 'block';
                document.getElementById('salud-recetas-lista').style.display = 'block';
            }
        },

        // ------------------------------------------------------------------
        // 12.9 CRUD: Cancelar cita (Bloque A – H3: Control y Libertad)
        // ------------------------------------------------------------------
        cancelarCita(idCita) {
            console.log("Iniciando proceso de cancelación para:", idCita);
            app.citas.mostrarConfirmacionCancelacion(idCita, (idCancelado) => {
                // Buscar en _citas (memoria)
                const cita = this._citas.find(c => (c.id || c._id) === idCita);
                if (!cita) return;

                // Soft-delete: marcar como cancelada sin borrar
                cita.estado = 'Cancelada';

                // Persistir el cambio en sanitas_mis_citas
                localStorage.setItem('sanitas_mis_citas', JSON.stringify(this._citas));

                // Sincronizar con sanitas_citas (store público)
                app._sincronizarCancelacion(cita);

                // H1: Refrescar la vista y la lista inmediatamente
                this.verDetalleCita(idCita);
                this.renderizarCitas(this._filtroActual || 'proximas');
            });
        },

        // ------------------------------------------------------------------
        // 12.10 CRUD: Preparar modificación de cita (Bloque B)
        // ------------------------------------------------------------------
        prepararModificacion(idCita) {
            console.log('Modificando cita:', idCita);
            const cita = this._citas.find(c => (c.id || c._id) === idCita);
            if (!cita) return;

            sessionStorage.setItem('cita_modificacion', JSON.stringify({
                id_cita: idCita,
                medico: cita.medico,
                especialidad: cita.especialidad,
                cedula: cita.cedula,
                origen: 'dashboard',
                fechaVieja: cita.fecha,
                horaVieja: cita.hora
            }));

            sessionStorage.setItem('reservaCita_preseleccion', JSON.stringify({
                medico: cita.medico,
                especialidad: cita.especialidad
            }));
            sessionStorage.setItem('especialidad_seleccionada', cita.especialidad);

            app.navegar('citas');
            setTimeout(() => {
                app.citas.mostrarPaso(2);
            }, 100);
        }
    },

    // ======================================================================
    // 13. WIDGET INVITADO — Consulta de Cita para usuarios no logueados
    // ======================================================================
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
        }
    }
};

// Arrancar la aplicación cuando el árbol DOM esté completamente construido
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});