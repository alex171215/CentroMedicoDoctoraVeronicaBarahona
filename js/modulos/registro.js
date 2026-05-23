/**
 * js/modulos/registro.js
 * TR-118: Ciclo de vida del temporizador OTP y reenvío en app.registro.
 * Control de intervalos, reset a 02:00 y notificación in-app al reenviar.
 */

const EMAILJS_PUBLIC_KEY = 'kk20Q6x-B6giGcqcU';
const EMAILJS_SERVICE_ID = 'service_y7c5ugc';
const EMAILJS_TEMPLATE_ID = 'template_kf8kpt8';

/** Límite original del cronómetro (120 s = 02:00) — TR-118 §2 */
const OTP_SEGUNDOS_INICIO = 120;

/** @param {string} correo */
function _enmascararCorreo(correo) {
    const val = String(correo || '').trim();
    const arroba = val.indexOf('@');
    if (arroba <= 1) return val || 'tu correo';
    const usuario = val.slice(0, arroba);
    const dominio = val.slice(arroba);
    const visible = usuario.slice(0, Math.min(2, usuario.length));
    return `${visible}${'*'.repeat(Math.max(1, usuario.length - visible.length))}${dominio}`;
}

/**
 * Métodos de temporizador y reenvío OTP para mezclar en app.registro.
 * @type {Record<string, Function>}
 */
export const registroOtpControl = {

    _OTP_SEGUNDOS_INICIO: OTP_SEGUNDOS_INICIO,

    /**
     * TR-118 §2: pinta la cuenta regresiva y restaura el enlace de reenvío al expirar.
     * @param {number} segundos
     */
    _iniciarCountdown(segundos) {
        clearInterval(this._countdownInterval);
        this._countdownInterval = null;

        const resendTxt = document.getElementById('reg-resend-txt');
        const btn = document.getElementById('reg-validar-btn');
        if (btn) btn.disabled = false;

        if (resendTxt) {
            resendTxt.innerHTML =
                'Solicitar código nuevamente en ' +
                '<span id="reg-countdown" aria-live="polite" aria-atomic="true">--:--</span>';
        }

        let restante = segundos;

        const actualizar = () => {
            const spanCd = document.getElementById('reg-countdown');
            const m = String(Math.floor(restante / 60)).padStart(2, '0');
            const s = String(restante % 60).padStart(2, '0');
            if (spanCd) spanCd.textContent = `${m}:${s}`;

            if (restante <= 0) {
                clearInterval(this._countdownInterval);
                this._countdownInterval = null;
                const rt = document.getElementById('reg-resend-txt');
                if (rt) {
                    rt.innerHTML =
                        '<a href="javascript:void(0)" onclick="app.registro._renovarOTP()" ' +
                        'style="color:var(--action-color);font-weight:600;">' +
                        'Solicitar código nuevamente</a>';
                }
                return;
            }
            restante--;
        };

        actualizar();
        this._countdownInterval = setInterval(actualizar, 1000);
    },

    /**
     * TR-118 §3: genera OTP de 6 dígitos y envía por EmailJS.
     * @returns {Promise<{ email: string, simulado?: boolean }>}
     */
    _refrescarCodigoOTPSimulado() {
        const emailVal = (document.getElementById('reg-email')?.value || '').trim();
        const codigo = String(Math.floor(100000 + Math.random() * 900000));
        this._codigoOTPGenerado = codigo;

        const nombreReal = (document.getElementById('reg-nombre1')?.value || '').trim();
        console.log('[QA OTP Registro] Nuevo código:', codigo, '| correo:', emailVal, '| nombre:', nombreReal);

        if (typeof emailjs === 'undefined') {
            console.warn('[EmailJS] SDK no disponible. Código en consola (arriba).');
            return Promise.resolve({ email: emailVal, simulado: true });
        }

        emailjs.init(EMAILJS_PUBLIC_KEY);
        return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            nombre_usuario: nombreReal,
            correo_destino: emailVal,
            codigo_otp: codigo
        }).then(() => {
            console.log('[EmailJS] OTP de reenvío enviado a', emailVal);
            return { email: emailVal };
        }).catch((err) => {
            console.error('[EmailJS] Error al reenviar OTP de registro:', err);
            throw err;
        });
    },

    /** Cierra el toast flotante de OTP si existe. */
    _cerrarToastOTP() {
        clearTimeout(this._otpToastTimer);
        const previo = document.getElementById('reg-otp-toast');
        if (previo) previo.remove();
    },

    /**
     * Notificación in-app visible (toast + banda en el paso 3).
     * La alerta push de Gmail depende del celular; esto confirma el envío desde la app.
     * @param {string|null} email
     * @param {boolean} exito
     */
    _notificarEnvioOTPEnApp(email, exito = true) {
        this._cerrarToastOTP();

        const correoMask = _enmascararCorreo(email);
        const titulo = exito ? 'Código reenviado con éxito' : 'No se pudo reenviar el código';
        const detalle = exito
            ? `Revisa la bandeja de ${correoMask}. Si no lo ves, busca en spam o promociones.`
            : 'Comprueba tu conexión e inténtalo de nuevo en unos segundos.';

        const el = document.createElement('div');
        el.id = 'reg-otp-toast';
        el.className = exito ? 'reg-otp-toast reg-otp-toast--ok' : 'reg-otp-toast reg-otp-toast--error';
        el.setAttribute('role', 'alert');
        el.setAttribute('aria-live', 'assertive');
        el.innerHTML =
            `<i class="fa-solid ${exito ? 'fa-circle-check' : 'fa-circle-exclamation'}" aria-hidden="true"></i>` +
            `<div class="reg-otp-toast__body">` +
            `<strong class="reg-otp-toast__title">${titulo}</strong>` +
            `<span class="reg-otp-toast__detail">${detalle}</span>` +
            `</div>` +
            `<button type="button" class="reg-otp-toast__close" aria-label="Cerrar aviso">` +
            `<i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;

        document.body.appendChild(el);

        el.querySelector('.reg-otp-toast__close')?.addEventListener('click', () => {
            this._cerrarToastOTP();
        });

        if (exito && typeof navigator.vibrate === 'function') {
            try {
                navigator.vibrate([120, 60, 120]);
            } catch (_) { /* algunos navegadores bloquean vibración */ }
        }

        let feedback = document.getElementById('reg-otp-reenvio-feedback');
        if (!feedback) {
            feedback = document.createElement('p');
            feedback.id = 'reg-otp-reenvio-feedback';
            feedback.className = 'reg-otp-inline-banner';
            feedback.setAttribute('role', 'status');
            feedback.setAttribute('aria-live', 'polite');
            const ancla = document.getElementById('reg-resend-txt');
            if (ancla?.parentNode) {
                ancla.parentNode.insertBefore(feedback, ancla);
            }
        }
        feedback.className = exito
            ? 'reg-otp-inline-banner reg-otp-inline-banner--ok'
            : 'reg-otp-inline-banner reg-otp-inline-banner--error';
        feedback.textContent = exito
            ? `✓ Nuevo código enviado a ${correoMask}. Revisa tu correo.`
            : '✗ Error al reenviar. Pulsa «Solicitar código nuevamente» otra vez.';

        this._otpToastTimer = setTimeout(() => this._cerrarToastOTP(), exito ? 7000 : 9000);
    },

    /**
     * TR-118: clausura de intervalos huérfanos, reset a 02:00 y reenvío determinista.
     */
    _renovarOTP() {
        clearInterval(this._countdownInterval);
        this._countdownInterval = null;

        const resendTxt = document.getElementById('reg-resend-txt');
        if (resendTxt) {
            resendTxt.innerHTML =
                '<span class="reg-otp-enviando"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> ' +
                'Enviando código a tu correo…</span>';
        }

        this._refrescarCodigoOTPSimulado()
            .then(({ email }) => {
                this._notificarEnvioOTPEnApp(email, true);
                this._iniciarCountdown(this._OTP_SEGUNDOS_INICIO);
            })
            .catch(() => {
                this._notificarEnvioOTPEnApp(
                    document.getElementById('reg-email')?.value || '',
                    false
                );
                if (resendTxt) {
                    resendTxt.innerHTML =
                        '<a href="javascript:void(0)" onclick="app.registro._renovarOTP()" ' +
                        'style="color:var(--action-color);font-weight:600;">' +
                        'Solicitar código nuevamente</a>';
                }
            });
    }
};
