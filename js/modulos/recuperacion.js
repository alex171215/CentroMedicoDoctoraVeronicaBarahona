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

// ────────────────────────────────────────────────────────────────────────────
// UTILIDADES DE UI
// ────────────────────────────────────────────────────────────────────────────

function _mostrarFase(n) {
    [1, 2, 3].forEach(i => {
        const el = document.getElementById(`rec-fase-${i}`);
        if (el) el.style.display = (i === n) ? 'block' : 'none';
    });
}

function _mostrarError(idCampo, msg) {
    const span = document.getElementById(`${idCampo}-error`);
    const input = document.getElementById(idCampo);
    if (span) { span.textContent = msg; span.style.display = 'block'; }
    if (input) { input.style.borderColor = '#c0392b'; }
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

// ────────────────────────────────────────────────────────────────────────────
// FASE 1: Buscar usuario por cédula o correo
// ────────────────────────────────────────────────────────────────────────────

async function buscarUsuario() {
    _limpiarError('rec-ident');
    const identificador = (document.getElementById('rec-identificador')?.value || '').trim();

    if (!identificador) {
        _mostrarError('rec-ident', 'Por favor, ingresa tu cédula o correo registrado.');
        return;
    }

    _setBtnLoading('rec-btn-fase1', true);

    try {
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identificador);

        let query = supabase
            .from('pacientes')
            .select('cedula, nombres, apellidos, correo');

        if (isEmail) {
            query = query.eq('correo', identificador);
        } else {
            query = query.eq('cedula', identificador);
        }

        const { data, error } = await query.maybeSingle();

        if (error) throw error;

        if (!data) {
            _mostrarError('rec-ident',
                isEmail
                    ? 'No encontramos ninguna cuenta con ese correo. Verifica que lo hayas escrito bien.'
                    : 'No encontramos ninguna cuenta con esa cédula. Verifica el número.');
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

// ────────────────────────────────────────────────────────────────────────────
// EXPORTAR API GLOBAL (accesible desde atributos onclick en el HTML)
// ────────────────────────────────────────────────────────────────────────────

window.recuperacion = {
    buscarUsuario,
    validarYActualizar,
    reenviarCodigo,
    _togglePassword
};

// Inicializar: mostrar solo Fase 1
_mostrarFase(1);
