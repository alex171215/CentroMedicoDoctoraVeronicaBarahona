/**
 * Acceso a Supabase: citas, pacientes, especialistas y overlay de carga (IHC #1).
 * Requiere en PostgreSQL la columna pacientes.es_invitado (BOOLEAN, default false).
 */
import { supabase } from '../supabaseClient.js';

const LOADING_ID = 'app-supabase-loading-overlay';

function ensureLoadingOverlay() {
    let el = document.getElementById(LOADING_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = LOADING_ID;
    el.className = 'app-supabase-loading';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-busy', 'true');
    el.innerHTML =
        '<div class="app-supabase-loading__box">' +
        '<span class="app-supabase-loading__spinner" aria-hidden="true"></span>' +
        '<p class="app-supabase-loading__text">Cargando…</p>' +
        '</div>';
    document.body.appendChild(el);
    return el;
}

/**
 * @param {() => Promise<T>} fn
 * @param {string} [mensaje]
 * @returns {Promise<T>}
 * @template T
 */
export async function conCargaGlobal(fn, mensaje = 'Cargando…') {
    const el = ensureLoadingOverlay();
    const txt = el.querySelector('.app-supabase-loading__text');
    if (txt) txt.textContent = mensaje;
    el.classList.add('app-supabase-loading--visible');
    try {
        return await fn();
    } finally {
        el.classList.remove('app-supabase-loading--visible');
    }
}

/** Fila citas → objeto usado por Mi Salud / agendamiento (compat. localStorage). */
export function mapCitaDesdeDb(row) {
    if (!row) return null;
    const idCita = row.id_cita || row.id;
    const fechaVal = row.fecha == null ? '' : typeof row.fecha === 'string' ? row.fecha : String(row.fecha).slice(0, 10);
    return {
        id: idCita,
        id_cita: row.id_cita || idCita,
        _id: row.id_cita || idCita,
        codigo: row.codigo,
        medico: row.medico,
        especialidad: row.especialidad,
        fecha: fechaVal,
        hora: row.hora,
        tipo: row.tipo,
        motivo: row.motivo,
        centro: row.centro,
        direccion: row.direccion,
        lugar: row.lugar,
        lugar_direccion: row.lugar_direccion,
        seguro: row.seguro,
        estado: row.estado || 'Próxima',
        paciente: row.paciente,
        nombres: row.nombres,
        cedula: row.cedula || row.cedula_paciente,
        cedula_paciente: row.cedula_paciente || row.cedula,
        cedula_titular: row.cedula_titular,
        id_especialista: row.id_especialista
    };
}

export async function fetchTodasLasCitasAgenda() {
    const { data, error } = await supabase.from('citas').select('*');
    if (error) throw error;
    return (data || []).map(mapCitaDesdeDb);
}

export async function fetchCitasMiSaludPorCedula(cedula) {
    if (!cedula) return [];
    const { data, error } = await supabase
        .from('citas')
        .select('*')
        .eq('cedula_paciente', cedula);
    if (error) throw error;
    return (data || []).map(mapCitaDesdeDb);
}

export async function fetchCitaPorIdCliente(idCliente) {
    const id = String(idCliente || '').trim();
    if (!id) return null;
    const { data, error } = await supabase.from('citas').select('*').eq('id_cita', id).maybeSingle();
    if (error) throw error;
    return mapCitaDesdeDb(data);
}

export async function insertCitaSupabase(payload) {
    const { data, error } = await supabase.from('citas').insert([payload]).select().maybeSingle();
    if (error) throw error;
    return data;
}

export async function updateCitaSupabasePorIdCita(idCita, patch) {
    const { error } = await supabase.from('citas').update(patch).eq('id_cita', idCita);
    if (error) throw error;
}

export async function loginPacientePorCedulaYPassword(cedula, password) {
    const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .eq('cedula', cedula)
        .eq('password', password)
        .maybeSingle();
    if (error) throw error;
    return data;
}

export async function insertPacienteSupabase(row) {
    const { data, error } = await supabase.from('pacientes').insert([row]).select().maybeSingle();
    if (error) throw error;
    return data;
}

export async function updatePacientePorCedula(cedula, patch) {
    if (!cedula) return;
    const { error } = await supabase.from('pacientes').update(patch).eq('cedula', cedula);
    if (error) throw error;
}

export async function upsertPacienteInvitadoSiNoExiste(cedula, nombresPaciente) {
    const { data: existente, error: e0 } = await supabase.from('pacientes').select('cedula').eq('cedula', cedula).maybeSingle();
    if (e0) throw e0;
    if (existente) return existente;
    const row = {
        cedula,
        nombre1: 'Invitado',
        apellido1: '—',
        nombres: (nombresPaciente || 'Invitado').trim() || 'Invitado',
        password: `invitado_${cedula}`,
        email: `invitado_${cedula}@guest.centromedico.local`,
        es_invitado: true
    };
    return insertPacienteSupabase(row);
}

export async function fetchEspecialistasSupabase() {
    const { data, error } = await supabase.from('especialistas').select('*').order('id');
    if (error) throw error;
    return data || [];
}

export function mergeCarteraEnSanitasFamDb(cartera) {
    let db;
    try {
        db = JSON.parse(localStorage.getItem('sanitasFam_db') || '{}');
    } catch (_) {
        db = {};
    }
    db.cartera_especialistas = cartera;
    localStorage.setItem('sanitasFam_db', JSON.stringify(db));
}

/** Convierte fila pacientes (DB) al objeto usuarioActivo del cliente. */
export function mapPacienteAUsuarioActivo(row) {
    if (!row) return null;
    const ced = row.cedula;
    return {
        identificacion: ced,
        cedula: ced,
        tipoDoc: row.tipoDoc ?? row.tipo_doc ?? 'Cédula',
        nombre1: row.nombre1 ?? row.nombre_1 ?? '',
        nombre2: row.nombre2 ?? row.nombre_2 ?? '',
        apellido1: row.apellido1 ?? row.apellido_1 ?? '',
        apellido2: row.apellido2 ?? row.apellido_2 ?? '',
        nombre_1: row.nombre_1 ?? row.nombre1 ?? '',
        nombre_2: row.nombre_2 ?? row.nombre2 ?? '',
        apellido_1: row.apellido_1 ?? row.apellido1 ?? '',
        apellido_2: row.apellido_2 ?? row.apellido2 ?? '',
        fechaNac: row.fechaNac ?? row.fecha_nacimiento ?? '',
        fecha_nacimiento: row.fecha_nacimiento ?? row.fechaNac ?? '',
        sexo: row.sexo ?? '',
        celular: row.celular ?? '',
        fijo: row.fijo ?? '',
        email: row.email ?? '',
        password: row.password ?? '',
        nombres: row.nombres ?? '',
        es_invitado: !!row.es_invitado
    };
}

export function pacienteDesdeRegistroLocal(nuevoUsuario) {
    return {
        cedula: nuevoUsuario.identificacion,
        password: nuevoUsuario.password,
        tipo_doc: nuevoUsuario.tipoDoc,
        nombre1: nuevoUsuario.nombre1,
        nombre2: nuevoUsuario.nombre2,
        apellido1: nuevoUsuario.apellido1,
        apellido2: nuevoUsuario.apellido2,
        fecha_nacimiento: nuevoUsuario.fechaNac || null,
        sexo: nuevoUsuario.sexo,
        celular: nuevoUsuario.celular,
        fijo: nuevoUsuario.fijo,
        email: nuevoUsuario.email,
        nombres: nuevoUsuario.nombres,
        es_invitado: false
    };
}
