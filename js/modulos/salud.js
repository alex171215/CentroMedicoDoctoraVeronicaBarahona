import { utilidades } from './utilidades.js';
import { estado } from '../estado.js';
import { clasificarDisponibilidadReceta } from './inventarioFarmacia.js';
import { conCargaGlobal, fetchCitasMiSaludPorCedula, fetchCitaPorIdCliente } from './supabaseServicio.js';

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export const salud = {
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
        // 12.1 Inicializar: recetas locales; citas desde Supabase (sesión)
        // ------------------------------------------------------------------
        async inicializar() {
            if (!document.getElementById('view-mi-salud')) return;

            const rawRecetas = localStorage.getItem('sanitas_mis_recetas');
            estado.recetas = rawRecetas ? JSON.parse(rawRecetas) : this._recetasDemo;
            estado.citas = [];

            this._filtroActual = 'proximas';
            this._seccionActual = 'citas';
            await this.mostrarSeccion('citas');

            const deepLinkStr = sessionStorage.getItem('abrir_detalle_pendiente');
            if (deepLinkStr) {
                sessionStorage.removeItem('abrir_detalle_pendiente');
                try {
                    const deepData = JSON.parse(deepLinkStr);
                    const id = deepData.id_cita;
                    await this.verDetalleCita(id);
                } catch (e) { }
            }

            const abrirDetalleId = sessionStorage.getItem('sanitas_abrir_detalle_id');
            if (abrirDetalleId) {
                sessionStorage.removeItem('sanitas_abrir_detalle_id');
                await this.verDetalleCita(String(abrirDetalleId).trim());
            }
        },

        // ------------------------------------------------------------------
        // 12.2 Cambiar entre secciones del sidenav
        // ------------------------------------------------------------------
        async mostrarSeccion(seccion) {
            this._seccionActual = seccion;

            const secCitas = document.getElementById('salud-sec-citas');
            const secRecetas = document.getElementById('salud-sec-recetas');
            if (!secCitas || !secRecetas) return;

            secCitas.style.display = seccion === 'citas' ? 'block' : 'none';
            secRecetas.style.display = seccion === 'recetas' ? 'block' : 'none';

            // Sidenav botones
            const btnCitas = document.getElementById('salud-nav-citas');
            const btnRecetas = document.getElementById('salud-nav-recetas');
            if (!btnCitas || !btnRecetas) return;
            btnCitas.classList.toggle('salud-sidenav__btn--active', seccion === 'citas');
            btnCitas.setAttribute('aria-selected', seccion === 'citas');
            btnRecetas.classList.toggle('salud-sidenav__btn--active', seccion === 'recetas');
            btnRecetas.setAttribute('aria-selected', seccion === 'recetas');

            if (seccion === 'citas') await this.filtrarCitas(this._filtroActual);
            if (seccion === 'recetas') this.renderizarRecetas();

            // ── WAI-ARIA APG: Registro único de teclado para el sidenav ──
            if (!this._sidenavKeyboardInited) {
                this._sidenavKeyboardInited = true;
                const tabs = [btnCitas, btnRecetas];
                tabs.forEach((btn, idx) => {
                    btn.setAttribute('role', 'tab');
                    btn.addEventListener('keydown', (e) => {
                        let next = null;
                        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                            next = tabs[(idx + 1) % tabs.length];
                        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                            next = tabs[(idx - 1 + tabs.length) % tabs.length];
                        } else if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            btn.click();
                            return;
                        }
                        if (next) { e.preventDefault(); next.focus(); next.click(); }
                    });
                });
            }
        },

        // ------------------------------------------------------------------
        // 12.3 Tabs de citas (Próximas / Anteriores) — WAI-ARIA APG
        // ------------------------------------------------------------------
        async filtrarCitas(filtro) {
            this._filtroActual = filtro;
            const tabProximas   = document.getElementById('tab-proximas');
            const tabAnteriores = document.getElementById('tab-anteriores');
            if (!tabProximas || !tabAnteriores) return;

            tabProximas.classList.toggle('salud-tab--active', filtro === 'proximas');
            tabProximas.setAttribute('aria-selected', filtro === 'proximas');
            tabAnteriores.classList.toggle('salud-tab--active', filtro === 'anteriores');
            tabAnteriores.setAttribute('aria-selected', filtro === 'anteriores');

            // Ocultar detalle si está visible
            const detalle = document.getElementById('salud-cita-detalle');
            const lista = document.getElementById('salud-citas-lista');
            if (detalle) detalle.style.display = 'none';
            if (lista) lista.style.display = 'block';

            await this.renderizarCitas(filtro);

            // ── WAI-ARIA APG: Teclado en tabs Próximas / Anteriores ──
            if (!this._citasTabKeyboardInited) {
                this._citasTabKeyboardInited = true;
                const tabs = [tabProximas, tabAnteriores];
                const filtros = ['proximas', 'anteriores'];
                tabs.forEach((tab, idx) => {
                    tab.addEventListener('keydown', (e) => {
                        let next = null;
                        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                            next = idx + 1 < tabs.length ? idx + 1 : 0;
                        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                            next = idx - 1 >= 0 ? idx - 1 : tabs.length - 1;
                        } else if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            void app.salud.filtrarCitas(filtros[idx]);
                            return;
                        }
                        if (next !== null) {
                            e.preventDefault();
                            tabs[next].focus();
                            void app.salud.filtrarCitas(filtros[next]);
                        }
                    });
                });
            }
        },

        // ------------------------------------------------------------------
        // 12.4 Renderizar lista de citas
        // ------------------------------------------------------------------
        async renderizarCitas(filtro) {
            const contenedor = document.getElementById('salud-citas-lista');
            if (!contenedor) return;

            const usuarioLogueado = localStorage.getItem('usuarioLogueado') === 'true';
            if (!usuarioLogueado) {
                contenedor.innerHTML = '<p class="salud-empty">Inicia sesión para ver tus citas médicas.</p>';
                return;
            }

            try {
                const user = JSON.parse(localStorage.getItem('usuarioActivo'));
                const cedula = user?.cedula || user?.identificacion;
                if (!cedula) {
                    contenedor.innerHTML = '<p class="salud-empty">No hay sesión de paciente.</p>';
                    return;
                }
                await conCargaGlobal(
                    async () => {
                        estado.citas = await fetchCitasMiSaludPorCedula(cedula);
                    },
                    'Cargando citas…'
                );
            } catch (e) {
                console.error('[Mi Salud] citas Supabase:', e);
                contenedor.innerHTML = '<p class="salud-empty">No se pudieron cargar las citas. Intenta de nuevo.</p>';
                return;
            }

            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            const ahora = new Date();
            const filtradas = estado.citas.filter(c => {
                if (c.estado === 'Cancelada') {
                    return filtro === 'anteriores';
                }
                const fechaCita = this._parsearFechaHoraCita(c);
                let esProxima = true;
                if (fechaCita) {
                    esProxima = fechaCita >= ahora;
                } else {
                    esProxima = (c.estado === 'Próxima');
                }
                return filtro === 'proximas' ? esProxima : !esProxima;
            });

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

                const nombrePacienteTarjeta = escapeHtml(c.paciente || c.nombres || 'No especificado');
                const nombreMedicoTarjeta = escapeHtml(c.medico || 'No especificado');
                const espTarjeta = escapeHtml(c.especialidad || 'No especificado');
                const fechaTarjeta = escapeHtml(`${fechaFmt}${c.hora ? ' – ' + c.hora : ''}`);

                return `
                <div class="salud-item${esCancelada ? ' salud-item--cancelada' : ''}" role="listitem" tabindex="0"
                    onclick="void app.salud.verDetalleCita('${idCita}')"
                    onkeydown="if(event.key==='Enter')void app.salud.verDetalleCita('${idCita}')">
                    <div class="salud-item__info">
                        <strong class="salud-item__nombre">${nombreMedicoTarjeta}</strong>
                        <span class="salud-item__sub">${espTarjeta}</span>
                        <p class="cita-card__paciente"><strong>Paciente:</strong> ${nombrePacienteTarjeta}</p>
                        <span class="salud-item__fecha">${fechaTarjeta} ${badgeHtml}</span>
                    </div>
                    <i class="fa-solid fa-chevron-right salud-item__arrow" aria-hidden="true"></i>
                </div>`;
            }).join('');
        },

        // ------------------------------------------------------------------
        // 12.5 Ver detalle de una cita (Maestro → Detalle)
        // ------------------------------------------------------------------
        async verDetalleCita(id) {
            const idStr = String(id ?? '').trim();
            const idNum = isNaN(idStr) ? idStr : Number(idStr);
            let cita = null;

            if (localStorage.getItem('usuarioLogueado') === 'true') {
                try {
                    await conCargaGlobal(async () => {
                        const fresh = await fetchCitaPorIdCliente(idStr);
                        if (fresh) {
                            cita = fresh;
                            const ix = estado.citas.findIndex(c =>
                                String(c.id_cita ?? '') === idStr || String(c.id ?? '') === idStr || String(c._id ?? '') === idStr);
                            if (ix >= 0) estado.citas[ix] = fresh;
                            else estado.citas.push(fresh);
                        }
                    }, 'Cargando cita…');
                } catch (e) {
                    console.error('[Mi Salud] detalle cita:', e);
                }
            }

            if (!cita) {
                cita = estado.citas.find(c => c.id === idStr || c.id === idNum || c._id === idStr);
            }
            if (!cita) return;

            const fechaFmt = /^\d{4}-\d{2}-\d{2}$/.test(cita.fecha)
                ? cita.fecha.split('-').reverse().join('/')
                : cita.fecha;

            const idCita = cita.id || cita._id;
            const esCancelada = cita.estado === 'Cancelada';
            const estadoBadge = esCancelada
                ? '<span class="cita-estado-badge cita-estado-badge--cancelada">Cancelada</span>'
                : '<span class="cita-estado-badge cita-estado-badge--activa">Activa</span>';

            const detBody = document.getElementById('salud-cita-detalle-body');
            if (!detBody) return;

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

            detBody.innerHTML = `
                <div class="salud-det__row">
                    <span class="salud-det__label">Estado</span>
                    <span class="salud-det__val">${estadoBadge}</span>
                </div>
                <div class="salud-det__row">
                    <span class="salud-det__label">Fecha</span>
                    <span class="salud-det__val">${escapeHtml(fechaFmt)}</span>
                </div>
                ${cita.hora ? `
                <div class="salud-det__row">
                    <span class="salud-det__label">Hora</span>
                    <span class="salud-det__val">${escapeHtml(cita.hora)}</span>
                </div>` : ''}
                <div class="salud-det__row">
                    <span class="salud-det__label">Médico tratante</span>
                    <span class="salud-det__val salud-det__val--bold">${escapeHtml(cita.medico || 'No especificado')}</span>
                </div>
                <div class="salud-det__row">
                    <span class="salud-det__label">Especialidad</span>
                    <span class="salud-det__val">${escapeHtml(cita.especialidad || 'No especificado')}</span>
                </div>
                <div class="salud-det__row">
                    <span class="salud-det__label">Paciente</span>
                    <span class="salud-det__val">${escapeHtml(cita.paciente || cita.nombres || 'No especificado')}</span>
                </div>
                ${cita.tipo ? `
                <div class="salud-det__row">
                    <span class="salud-det__label">Tipo</span>
                    <span class="salud-det__val">${escapeHtml(cita.tipo)}</span>
                </div>` : ''}
                ${cita.motivo ? `
                <div class="salud-det__row">
                    <span class="salud-det__label">Motivo</span>
                    <span class="salud-det__val">${escapeHtml(cita.motivo)}</span>
                </div>` : ''}
                ${cita.centro ? `
                <div class="salud-det__row">
                    <span class="salud-det__label">Centro Médico</span>
                    <span class="salud-det__val">${escapeHtml(cita.centro)}</span>
                </div>` : ''}
                ${cita.direccion ? `
                <div class="salud-det__row">
                    <span class="salud-det__label">Dirección</span>
                    <span class="salud-det__val">${escapeHtml(cita.direccion)}</span>
                </div>` : ''}
                ${accionesHtml}`;

            const h = document.getElementById('salud-citas-header');
            const lista = document.getElementById('salud-citas-lista');
            const det = document.getElementById('salud-cita-detalle');
            if (h) h.style.display = 'none';
            if (lista) lista.style.display = 'none';
            if (det) det.style.display = 'block';
        },

        /**
         * Imprime el comprobante de una cita activa usando el sistema nativo
         * (window.open + print), delegando a utilidades.imprimirCita.
         * @param {string|number} id - ID de la cita en estado.citas
         */
        imprimirCitaActiva(id) {
            const idNum = isNaN(id) ? id : Number(id);
            const cita = estado.citas.find(c => c.id === id || c.id === idNum || c._id === id);
            if (!cita) {
                console.warn('[app.salud] imprimirCitaActiva: cita no encontrada con ID', id);
                return;
            }
            utilidades.imprimirCita(cita);
        },

        /**
         * Descarga el PDF de una cita activa usando jsPDF nativo,
         * delegando a utilidades.descargarPDFCita.
         * @param {string|number} id - ID de la cita en estado.citas
         */
        descargarCitaActiva(id) {
            const idNum = isNaN(id) ? id : Number(id);
            const cita = estado.citas.find(c => c.id === id || c.id === idNum || c._id === id);
            if (!cita) {
                console.warn('[app.salud] descargarCitaActiva: cita no encontrada con ID', id);
                return;
            }
            utilidades.descargarPDFCita(cita);
        },

        // ------------------------------------------------------------------
        // 12.6 Renderizar lista de recetas
        // ------------------------------------------------------------------
        renderizarRecetas() {
            const contenedor = document.getElementById('salud-recetas-lista');
            if (!contenedor) return;
            if (!estado.recetas.length) {
                contenedor.innerHTML = '<p class="salud-empty">No hay recetas disponibles.</p>';
                return;
            }
            contenedor.innerHTML = estado.recetas.map(r => {
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
            const r = estado.recetas.find(x => x.id === id);
            if (!r) return;
            const bodyEl = document.getElementById('salud-receta-detalle-body');
            if (!bodyEl) return;
            const fechaFmt = r.fecha.split('-').reverse().join('/');
            const diags = r.diagnostico.map(d => `<li>– ${d}</li>`).join('');
            const meds = r.medicamentos.map(m => {
                const inv = clasificarDisponibilidadReceta(m);
                const badgeClass = inv.tipo === 'disponible'
                    ? 'salud-receta-inv salud-receta-inv--ok'
                    : inv.tipo === 'no_aplica'
                        ? 'salud-receta-inv salud-receta-inv--na'
                        : 'salud-receta-inv salud-receta-inv--no';
                const icono = inv.tipo === 'disponible' ? '✅' : inv.tipo === 'no_aplica' ? 'ℹ️' : '❌';
                const badgeHtml = `<span class="${badgeClass}" aria-label="${escapeHtml(inv.ariaLabel)}"><span aria-hidden="true">${icono}</span> ${escapeHtml(inv.etiquetaVisible)}</span>`;
                return `
                <div class="salud-med">
                    <p class="salud-med__nombre salud-med__nombre--con-badge">${escapeHtml(m.nombre)} ${badgeHtml}</p>
                    <div class="salud-det__row"><span class="salud-det__label">Dosis</span><span class="salud-det__val">${escapeHtml(m.dosis)}</span></div>
                    <div class="salud-det__row"><span class="salud-det__label">Cantidad</span><span class="salud-det__val">${m.cantidad}</span></div>
                    <div class="salud-det__row"><span class="salud-det__label">Vía de administración</span><span class="salud-det__val salud-det__val--bold">${escapeHtml(m.via)}</span></div>
                </div>`;
            }).join('');

            bodyEl.innerHTML = `
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

            const rh = document.getElementById('salud-recetas-header');
            const rl = document.getElementById('salud-recetas-lista');
            const rd = document.getElementById('salud-receta-detalle');
            if (rh) rh.style.display = 'none';
            if (rl) rl.style.display = 'none';
            if (rd) rd.style.display = 'block';
        },

        /**
         * Imprime el comprobante de una receta activa usando el sistema nativo
         * (window.open + print), delegando a utilidades.imprimirReceta.
         * @param {string} id - ID de la receta en estado.recetas
         */
        imprimirRecetaActiva(id) {
            const receta = estado.recetas.find(x => x.id === id);
            if (!receta) {
                console.warn('[app.salud] imprimirRecetaActiva: receta no encontrada con ID', id);
                return;
            }
            utilidades.imprimirReceta(receta);
        },

        /**
         * Descarga el PDF de una receta activa usando jsPDF nativo,
         * delegando a utilidades.descargarPDFReceta.
         * @param {string} id - ID de la receta en estado.recetas
         */
        descargarRecetaActiva(id) {
            const receta = estado.recetas.find(x => x.id === id);
            if (!receta) {
                console.warn('[app.salud] descargarRecetaActiva: receta no encontrada con ID', id);
                return;
            }
            utilidades.descargarPDFReceta(receta);
        },

        // ------------------------------------------------------------------
        // 12.8 Volver a la lista
        // ------------------------------------------------------------------
        async volverALista(tipo) {
            if (tipo === 'citas') {
                const d1 = document.getElementById('salud-cita-detalle');
                const h1 = document.getElementById('salud-citas-header');
                const l1 = document.getElementById('salud-citas-lista');
                if (d1) d1.style.display = 'none';
                if (h1) h1.style.display = 'block';
                if (l1) l1.style.display = 'block';
                await this.renderizarCitas(this._filtroActual);
            } else {
                const d2 = document.getElementById('salud-receta-detalle');
                const h2 = document.getElementById('salud-recetas-header');
                const l2 = document.getElementById('salud-recetas-lista');
                if (d2) d2.style.display = 'none';
                if (h2) h2.style.display = 'block';
                if (l2) l2.style.display = 'block';
            }
        },

        // ------------------------------------------------------------------
        // 12.9 CRUD: Cancelar cita (Bloque A – H3: Control y Libertad)
        // ------------------------------------------------------------------
        cancelarCita(idCita) {
            console.log("Iniciando proceso de cancelación para:", idCita);
            window.app.citas.mostrarConfirmacionCancelacion(idCita, async (idCancelado) => {
                const cita = estado.citas.find(c => (c.id || c._id) === idCita || c.id_cita === idCita);
                if (!cita) return;

                cita.estado = 'Cancelada';

                try {
                    await window.app._sincronizarCancelacion(cita);
                } catch (e) {
                    console.error(e);
                }
            });
        },

        // ------------------------------------------------------------------
        // 12.10 CRUD: Preparar modificación de cita (Bloque B)
        // ------------------------------------------------------------------
        prepararModificacion(idCita) {
            console.log('Modificando cita:', idCita);
            const cita = estado.citas.find(c => (c.id || c._id) === idCita);
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

            window.app.navegar('citas');
            setTimeout(() => {
                window.app.citas.mostrarPaso(2);
            }, 100);
        }
};
