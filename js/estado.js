/**
 * Claves sessionStorage del flujo de citas (TR-14, MPA).
 * `sanitas_cita_en_progreso`: snapshot JSON del agendamiento (paso, médico, hora, citaTemporal, etc.).
 * `cita_flujo_post_login`: bandera de un solo uso tras login exitoso desde citas.
 */
export const STORAGE_CITA_EN_PROGRESO = 'sanitas_cita_en_progreso';
export const STORAGE_CITA_POST_LOGIN = 'cita_flujo_post_login';
/** TR-22: deep link temporal tras agendamiento invitado (cédula + fecha + id) para el widget en index. */
export const STORAGE_AUTO_CONSULTA_INVITADO = 'sanitas_auto_consulta_invitado';

/**
 * Estado compartido entre Mi Salud, sincronización de cancelación y otros módulos.
 * `citas` / `recetas` son las listas en memoria del dashboard (no confundir con app.citas de agendamiento).
 */
export const estado = {
    usuarioActivo: null,
    /** Citas visibles en Mi Salud (misma referencia que usa salud.js) */
    citas: [],
    /** Recetas en Mi Salud */
    recetas: []
};

export function leerUsuarioActivoDesdeStorage() {
    try {
        const raw = localStorage.getItem('usuarioActivo');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (_) {
        return null;
    }
}
