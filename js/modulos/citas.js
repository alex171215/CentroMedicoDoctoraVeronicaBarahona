import { utilidades } from './utilidades.js';
import { estado } from '../estado.js';

/**
 * Módulo de agendamiento: calendario, colisiones, flujo por pasos.
 * Usa window.app para navegación y otros submódulos ya montados en main.
 */
export function createCitas() {
    return {
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
                window.app.navegar('home');
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
                            if (typeof window.app.salud?.renderizarCitas === 'function') {
                                window.app.salud.renderizarCitas(window.app.salud._filtroActual || 'proximas');
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
                window.app.widgetInvitado._pendingDetailId = idCita;

                window.app.navegar('home');

                setTimeout(() => {
                    const inputCedula = document.getElementById('widget-cedula');
                    const inputFecha = document.getElementById('widget-fecha-cita');
                    if (inputCedula && inputFecha) {
                        inputCedula.value = cedula;
                        inputFecha.value = fechaISO;
                        inputCedula.classList.remove('input-error');
                        inputFecha.classList.remove('input-error');
                        if (window.app.widgetInvitado && typeof window.app.widgetInvitado.consultar === 'function') {
                            window.app.widgetInvitado.consultar();
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

                window.app.navegar('mi-salud');
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
                backBtn.onclick = () => window.app.citas.irAtras();
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
                    if (estado.citas && estado.citas.length) {
                        const indexSalud = estado.citas.findIndex(sc => (sc.id || sc._id) === realId || sc.id_cita === realId);
                        if (indexSalud !== -1) {
                            estado.citas[indexSalud] = {
                                ...estado.citas[indexSalud],
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

        descargarComprobantePDF() {
            const medico = document.getElementById('resumen-doctor-name')?.textContent || '—';
            const especialidad = document.getElementById('resumen-doctor-specialty')?.textContent || '—';
            const fechaHora = document.getElementById('resumen-fecha')?.textContent || '—';
            const paciente = document.getElementById('resumen-paciente')?.textContent || '—';
            utilidades.descargarPDFCita({ medico, especialidad, fecha: fechaHora, hora: '', paciente });
        },

        imprimirComprobante() {
            const medico = document.getElementById('resumen-doctor-name')?.textContent || '—';
            const especialidad = document.getElementById('resumen-doctor-specialty')?.textContent || '—';
            const fechaHora = document.getElementById('resumen-fecha')?.textContent || '—';
            const paciente = document.getElementById('resumen-paciente')?.textContent || '—';
            utilidades.imprimirCita({ medico, especialidad, fecha: fechaHora, hora: '', paciente });
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
                if (isCompleted) icon = '<i class="fa-solid fa-check" aria-hidden="true"></i><span class="sr-only">Completado</span>';
                else icon = `<span aria-hidden="true">${index + 1}</span>`;

                const ariaCurrent = isActive ? ' aria-current="step"' : '';

                html += `
                    <div class="${classes}"${ariaCurrent}>
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

                // Celular: validación contextual en cascada (H9) – delegada a utilidades.validarCelular()
                if (celOk) {
                    this._setEstadoCampo(cel, 'error-celular', true);
                } else {
                    // utilidades.validarCelular() ya maneja el caso vacío con "El celular es obligatorio."
                    const mensajeCel = utilidades.validarCelular(celVal) || 'El celular ingresado no es válido.';
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
                    // utilidades.validarCelular() maneja vacío → "El celular es obligatorio."
                    const msg = utilidades.validarCelular(val) || 'El celular ingresado no es válido.';
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
                            window.app.navegar('home');
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
                        window.app.navegar('home');
                    };
                };
            }
        },

        cerrarModalBuffer() {
            const modal = document.getElementById('modal-buffer-cita');
            if (modal) modal.remove();
        },
    };
}
