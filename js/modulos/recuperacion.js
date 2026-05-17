/**
 * js/modulos/recuperacion.js
 * TR-39: Módulo de recuperación de contraseña — Máquina de 3 fases.
 * TR-40: Usa EmailJS para el envío real del OTP (sin alert()).
 *
 * ─── IDs de EmailJS que debes rellenar ─────────────────────────────────────
 *   EMAILJS_PUBLIC_KEY   → tu Public Key (panel EmailJS → Account → API Keys)
 *   EMAILJS_SERVICE_ID   → ID del servicio de correo (panel EmailJS → Email Services)
 *   EMAILJS_TEMPLATE_ID  → ID de la plantilla (panel EmailJS → Email Templates)
 *                          La plantilla debe tener las variables (TR-40 §1):
 *                            {{correo_destino}} → destinatario
 *                            {{nombre_usuario}} → nombre del paciente
 *                            {{codigo_otp}}     → el código de 6 dígitos
 * ────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from '../supabaseClient.js';

// ── Constantes EmailJS — RELLENAR con tus IDs reales ────────────────────────
const EMAILJS_PUBLIC_KEY = 'kk20Q6x-B6giGcqcU';
const EMAILJS_SERVICE_ID = 'service_y7c5ugc';
const EMAILJS_TEMPLATE_ID = 'template_kf8kpt8';

// ── Inicializar EmailJS (se ejecuta una vez al cargar el módulo) ─────────────
if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_PUBLIC_KEY);
} else {
    console.warn('[EmailJS] SDK no cargado. Asegúrate de que el script CDN esté en el <head>.');
}

// ── Estado interno de la máquina de fases ───────────────────────────────────
let _otpGenerado = '';
let _correoUsuario = '';
let _cedulaUsuario = '';
let _countdownInterval = null;
let _faseActual = 1;           // TR-54: rastreamos la fase activa para irAtras()
let _suppressHistorialPush = false; // TR-54: bandera anti-bucle del popstate

// ────────────────────────────────────────────────────────────────────────────
// UTILIDADES DE UI
// ────────────────────────────────────────────────────────────────────────────

function _mostrarFase(n) {
    [1, 2, 3].forEach(i => {
        const el = document.getElementById(`rec-fase-${i}`);
        if (el) el.style.display = (i === n) ? 'block' : 'none';
    });
    _faseActual = n;
    // TR-54: registrar avance en el historial (se omite si venimos del popstate)
    if (!_suppressHistorialPush) {
        history.pushState({ tipo: 'formulario-recuperar', paso: n }, '', '');
    }
}

function _mostrarError(idCampo, msg) {
    const span = document.getElementById(`${idCampo}-error`);
    const input = document.getElementById(idCampo);
    if (span) { span.textContent = msg; span.style.display = 'block'; }
    if (input) {
        input.style.borderColor = '#c0392b';
        // TR-48: Scroll suave + foco al campo erróneo (WCAG 2.2 / H1)
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        requestAnimationFrame(() => input.focus({ preventScroll: true }));
    }
}

function _limpiarError(idCampo) {
    const span = document.getElementById(`${idCampo}-error`);
    const input = document.getElementById(idCampo);
    if (span) { span.textContent = ''; span.style.display = 'none'; }
    if (input) { input.style.borderColor = ''; }
}

function _setBtnLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Un momento…';
    } else {
        btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
    }
}

// ────────────────────────────────────────────────────────────────────────────
// COUNTDOWN PARA EL OTP
// ────────────────────────────────────────────────────────────────────────────

function _iniciarCountdown(segundos) {
    clearInterval(_countdownInterval);
    const spanCd = document.getElementById('rec-countdown');
    const resendTxt = document.getElementById('rec-resend-txt');

    let restante = segundos;
    const actualizar = () => {
        const m = String(Math.floor(restante / 60)).padStart(2, '0');
        const s = String(restante % 60).padStart(2, '0');
        if (spanCd) spanCd.textContent = `${m}:${s}`;
        if (restante === 0) {
            clearInterval(_countdownInterval);
            if (resendTxt) {
                resendTxt.innerHTML =
                    '¿No recibiste el código? ' +
                    '<a href="javascript:void(0)" ' +
                    'onclick="recuperacion.reenviarCodigo()" ' +
                    'style="color:var(--action-color);font-weight:600;">' +
                    'Solicitar nuevo código</a>';
            }
        }
        restante--;
    };
    actualizar();
    _countdownInterval = setInterval(actualizar, 1000);
}

// ────────────────────────────────────────────────────────────────────────────
// ENVÍO DE OTP POR EMAILJS (TR-40)
// ────────────────────────────────────────────────────────────────────────────

async function _enviarOTP(correo, nombrePaciente, codigo) {
    // Siempre logueamos el código en consola para QA/desarrollo
    console.log(`[QA OTP Recuperación] código: ${codigo} | correo: ${correo}`);

    if (typeof emailjs === 'undefined') {
        console.warn('[EmailJS] No disponible. El código está en consola.');
        return;
    }

    try {
        // TR-40 §1: Contrato estricto de llaves — coincide con la plantilla.
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            nombre_usuario: nombrePaciente || 'Usuario',
            correo_destino: correo,
            codigo_otp:     codigo
        });
        console.log('[EmailJS] Código enviado correctamente a', correo);
    } catch (err) {
        // No interrumpimos el flujo por un fallo de correo; el código está en consola.
        console.error('[EmailJS] Error al enviar:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 1: Buscar usuario por correo electrónico (TR-44 §1: canal exclusivo)
// ─────────────────────────────────────────────────────────────────────────────

async function buscarUsuario() {
    _limpiarError('rec-ident');
    const correo = (document.getElementById('rec-identificador')?.value || '').trim();

    // Campo vacío
    if (!correo) {
        _mostrarError('rec-ident', 'Por favor, ingresa tu correo electrónico.');
        return;
    }

    // TR-44 §2: Validación de formato de correo antes de consultar Supabase
    const esEmailValido = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo);
    if (!esEmailValido) {
        _mostrarError('rec-ident', 'Ingresa un correo válido (ej: nombre@dominio.com).');
        return;
    }

    _setBtnLoading('rec-btn-fase1', true);

    try {
        const { data, error } = await supabase
            .from('pacientes')
            .select('cedula, nombres, apellidos, correo')
            .eq('correo', correo)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            // TR-44 §3: Modal de Rescate — el correo no existe en el sistema
            _setBtnLoading('rec-btn-fase1', false);
            abrirModalRescate();
            return;
        }

        // Usuario encontrado — guardar estado y avanzar a Fase 2
        _cedulaUsuario = data.cedula;
        _correoUsuario = data.correo || '';
        _otpGenerado = String(Math.floor(100000 + Math.random() * 900000));

        // TR-41: Usar el nombre real de la BD. Queda prohibido el fallback 'Usuario'.
        const nombreMostrar = (data.nombres || '').split(' ')[0];
        if (!nombreMostrar) console.warn('[TR-41] Paciente sin nombre en BD:', _cedulaUsuario);

        // Mostrar correo enmascarado en la UI
        const correoShow = document.getElementById('rec-correo-show');
        if (correoShow) correoShow.textContent = _correoUsuario;

        // Enviar OTP por EmailJS (TR-40)
        await _enviarOTP(_correoUsuario, nombreMostrar, _otpGenerado);

        _mostrarFase(2);
        _iniciarCountdown(90);

    } catch (err) {
        console.error('[Recuperación Fase 1]', err);
        _mostrarError('rec-ident',
            'Ocurrió un error al verificar tus datos. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
        _setBtnLoading('rec-btn-fase1', false);
    }
}

// ────────────────────────────────────────────────────────────────────────────
// FASE 2: Validar OTP y actualizar contraseña
// ────────────────────────────────────────────────────────────────────────────

async function validarYActualizar() {
    _limpiarError('rec-codigo');
    _limpiarError('rec-new-password');

    const codigoIngresado = (document.getElementById('rec-codigo')?.value || '').trim();
    const nuevaPass = document.getElementById('rec-new-password')?.value || '';

    let ok = true;

    if (codigoIngresado.length !== 6) {
        _mostrarError('rec-codigo', 'El código debe tener exactamente 6 dígitos.');
        ok = false;
    } else if (codigoIngresado !== _otpGenerado) {
        _mostrarError('rec-codigo',
            'El código ingresado no coincide. Verifica el correo y cópialo exactamente.');
        ok = false;
    }

    if (nuevaPass.length < 6) {
        _mostrarError('rec-new-password', 'La contraseña debe tener al menos 6 caracteres.');
        ok = false;
    }

    if (!ok) return;

    _setBtnLoading('rec-btn-fase2', true);

    try {
        // TR-39 §2 Fase 3: UPDATE en Supabase con try/catch explícito.
        // Si falla, NO avanzamos a la pantalla de éxito (TR-37 / TR-35).
        const { error: supaError } = await supabase
            .from('pacientes')
            .update({ password: nuevaPass })
            .eq('cedula', _cedulaUsuario);

        if (supaError) {
            // TR-35: Transparencia total — mostrar el error real de Supabase.
            console.error('[Supabase] Actualizar contraseña:', supaError);
            _mostrarError('rec-codigo',
                'Error al actualizar la contraseña: ' + supaError.message +
                '. Intenta nuevamente o contacta al administrador.');
            return; // ← No avanzar a Fase 3
        }

        // Supabase respondió OK → avanzar a pantalla de éxito
        clearInterval(_countdownInterval);
        _otpGenerado = '';
        _cedulaUsuario = '';
        _correoUsuario = '';
        _mostrarFase(3);

    } catch (err) {
        console.error('[Recuperación Fase 2]', err);
        _mostrarError('rec-codigo',
            'Error inesperado. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
        _setBtnLoading('rec-btn-fase2', false);
    }
}

// ────────────────────────────────────────────────────────────────────────────
// REENVÍO DE CÓDIGO
// ────────────────────────────────────────────────────────────────────────────

async function reenviarCodigo() {
    if (!_correoUsuario || !_cedulaUsuario) return;

    _otpGenerado = String(Math.floor(100000 + Math.random() * 900000));
    _limpiarError('rec-codigo');

    const resendTxt = document.getElementById('rec-resend-txt');
    if (resendTxt) resendTxt.textContent = '¿No recibiste el código?';

    await _enviarOTP(_correoUsuario, '', _otpGenerado);
    _iniciarCountdown(90);
}

// ────────────────────────────────────────────────────────────────────────────
// TOGGLE CONTRASEÑA
// ────────────────────────────────────────────────────────────────────────────

function _togglePassword() {
    const input = document.getElementById('rec-new-password');
    const icon = document.getElementById('rec-eye-icon');
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon?.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon?.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TR-44 §3: MODAL DE RESCATE — abrir y cerrar
// ─────────────────────────────────────────────────────────────────────────────

function abrirModalRescate() {
    const overlay = document.getElementById('modal-rescate-overlay');
    if (!overlay) return;
    // TR-54: ancla en historial para que Atrás nativo cierre este modal
    history.pushState({ tipo: 'modal', id: 'modal-rescate-overlay' }, '', '');
    overlay.style.display = 'flex';
    // Foco inicial en el primer botón para accesibilidad (WCAG 2.4.3)
    const primerBtn = overlay.querySelector('button');
    if (primerBtn) primerBtn.focus();
    // H3: cierre por clic en el overlay (fuera del cuadro blanco)
    overlay.addEventListener('click', _onOverlayClick);
}

function cerrarModalRescate() {
    const overlay = document.getElementById('modal-rescate-overlay');
    if (!overlay) return;
    overlay.style.display = 'none';
    overlay.removeEventListener('click', _onOverlayClick);
    // TR-54: limpiar ancla del historial al cerrar con botón visual
    if (history.state && history.state.id === 'modal-rescate-overlay') history.back();
    // Devolver foco al input de correo (H3)
    document.getElementById('rec-identificador')?.focus();
}

function _onOverlayClick(e) {
    // Solo cerrar si el clic fue directamente en el overlay, no en el modal hijo
    if (e.target === e.currentTarget) cerrarModalRescate();
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTAR API GLOBAL (accesible desde atributos onclick en el HTML)
// ─────────────────────────────────────────────────────────────────────────────

window.recuperacion = {
    buscarUsuario,
    validarYActualizar,
    reenviarCodigo,
    _togglePassword,
    cerrarModalRescate,
    // TR-54: función de retroceso delegada por el popstate global
    irAtras() {
        if (_faseActual <= 1) return; // Ya estamos en la fase inicial, no retroceder más
        const faseDest = _faseActual - 1;
        _suppressHistorialPush = true;
        try {
            _mostrarFase(faseDest);
            // Limpiar estado OTP si retrocedemos de fase 2 a fase 1 (privacidad)
            if (faseDest === 1) {
                _otpGenerado = '';
                clearInterval(_countdownInterval);
            }
        } finally {
            _suppressHistorialPush = false;
        }
    }
};

// ────────────────────────────────────────────────────────────────────────────
// TR-42 §1: SANITIZACIÓN EN TIEMPO REAL — Evento input sobre #rec-identificador
// Lista blanca: alfanumérico + @ . _ -
// Bloquea: espacios, <, >, ', ", ; y cualquier otro caracter XSS/SQLi
// ────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

    // ── #rec-identificador: sanitización + blur de formato ──────────────────
    const inputIdent = document.getElementById('rec-identificador');
    if (inputIdent) {
        // TR-44 §1: Sanitización en tiempo real — whitelist de caracteres válidos para correo
        // Bloquea: espacios, <, >, ', ", ;, y cualquier caracter XSS/SQLi.
        inputIdent.addEventListener('input', (e) => {
            const antes = e.target.value;
            const despues = antes.replace(/[^a-zA-Z0-9@._+-]/g, '');
            if (antes !== despues) {
                const pos = e.target.selectionStart;
                e.target.value = despues;
                e.target.classList.add('input-rechazado');
                try { e.target.setSelectionRange(pos - 1, pos - 1); } catch (_) {}
                setTimeout(() => e.target.classList.remove('input-rechazado'), 400);
            }
        });

        // TR-46 §1: Validación de formato de correo en blur (H5 – feedback inmediato)
        inputIdent.addEventListener('blur', (e) => {
            const val = e.target.value.trim();
            e.target.value = val; // sanitizar espacios residuales
            if (val.length === 0) return; // campo vacío: el submit lo captura
            const esEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val);
            if (!esEmail) {
                _mostrarError('rec-ident', 'Ingresa un correo válido (ej: nombre@dominio.com).');
            } else {
                _limpiarError('rec-ident');
            }
        });
    }

    // ── #rec-codigo: sanitización física — solo dígitos (TR-46 §2) ──────────
    const inputCodigo = document.getElementById('rec-codigo');
    if (inputCodigo) {
        inputCodigo.addEventListener('input', (e) => {
            const antes = e.target.value;
            const despues = antes.replace(/[^0-9]/g, '');
            if (antes !== despues) {
                e.target.value = despues;
            }
        });
    }
});

// TR-54: Inicializar en Fase 1 sin crear entrada extra en el historial.
// _suppressHistorialPush evita que _mostrarFase() llame a pushState en el arranque.
// replaceState sella la entrada actual del historial con el estado correcto.
_suppressHistorialPush = true;
_mostrarFase(1);
_suppressHistorialPush = false;
history.replaceState({ tipo: 'formulario-recuperar', paso: 1 }, '', '');
