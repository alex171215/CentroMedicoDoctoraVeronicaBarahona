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
