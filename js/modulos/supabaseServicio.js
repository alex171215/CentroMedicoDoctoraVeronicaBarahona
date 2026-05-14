/**
 * Acceso a Supabase: citas, pacientes, especialistas y overlay de carga (IHC #1).
 * Columnas alineadas al esquema real: pacientes (cedula, nombres, apellidos, correo, …),
 * especialistas (id_especialista, nombre_completo, …), citas (id_cita, cedula_paciente, …).
 */
import { supabase } from '../supabaseClient.js';

const LOADING_ID = 'app-supabase-loading-overlay';

/** Fuerza cierre del overlay si un flujo asíncrono queda inconsistente tras error. */
export function ocultarCargaGlobalForzado() {
    const el = document.getElementById(LOADING_ID);
    if (el) el.classList.remove('app-supabase-loading--visible');
}

function buscarEspecialistaEnCacheLocal(idEspecialista) {
    if (idEspecialista == null || idEspecialista === '') return null;
    try {
        const db = JSON.parse(localStorage.getItem('sanitasFam_db') || '{}');
        const list = db.cartera_especialistas || [];
        const idStr = String(idEspecialista);
        const idNum = Number(idStr);
        return (
            list.find(
                (e) =>
                    e.id_especialista === idEspecialista ||
                    e.id_especialista === idStr ||
                    e.id_especialista === idNum ||
                    e.id === idEspecialista ||
                    e.id === idStr ||
                    e.id === idNum
            ) || null
        );
    } catch (_) {
        return null;
    }
}

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
    const doc = buscarEspecialistaEnCacheLocal(row.id_especialista);
    const medico =
        row.medico ||
        (doc && (doc.nombre_completo || doc.doctor?.nombre_completo)) ||
        '';
    const especialidad = row.especialidad || (doc && doc.especialidad) || '';
    const tipoConsulta = row.tipo_consulta || row.tipo || '';
    return {
        id: idCita,
        id_cita: row.id_cita || idCita,
        _id: row.id_cita || idCita,
        codigo: row.codigo,
        medico,
        especialidad,
        fecha: fechaVal,
        hora: row.hora,
        tipo: tipoConsulta,
        tipo_consulta: row.tipo_consulta,
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

const SELECT_CITAS =
    'id_cita, cedula_paciente, id_especialista, fecha, hora, estado, motivo, tipo_consulta';

export async function fetchTodasLasCitasAgenda() {
    const { data, error } = await supabase.from('citas').select(SELECT_CITAS);
    if (error) throw error;
    return (data || []).map(mapCitaDesdeDb);
}

export async function fetchCitasMiSaludPorCedula(cedula) {
    if (!cedula) return [];
    const { data, error } = await supabase
        .from('citas')
        .select(SELECT_CITAS)
        .eq('cedula_paciente', cedula);
    if (error) throw error;
    return (data || []).map(mapCitaDesdeDb);
}

export async function fetchCitaPorIdCliente(idCliente) {
    const id = String(idCliente || '').trim();
    if (!id) return null;
    const { data, error } = await supabase.from('citas').select(SELECT_CITAS).eq('id_cita', id).maybeSingle();
    if (error) throw error;
    return mapCitaDesdeDb(data);
}

export async function insertCitaSupabase(payload) {
    const { data, error } = await supabase.from('citas').insert([payload]).select(SELECT_CITAS).maybeSingle();
    if (error) throw error;
    return data;
}

export async function updateCitaSupabasePorIdCita(idCita, patch) {
    const { error } = await supabase.from('citas').update(patch).eq('id_cita', idCita);
    if (error) throw error;
}

const SELECT_PACIENTE =
    'cedula, nombres, apellidos, correo, celular, fecha_nacimiento, password, es_invitado';

/** Login por cédula o por correo (columna `correo` en BD). */
export async function loginPacientePorIdentificadorYPassword(identificacion, password) {
    const id = String(identificacion || '').trim();
    if (!id) return null;
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
    let q = supabase.from('pacientes').select(SELECT_PACIENTE).eq('password', password);
    if (isEmail) q = q.eq('correo', id);
    else q = q.eq('cedula', id);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data;
}

export async function insertPacienteSupabase(row) {
    const { data, error } = await supabase.from('pacientes').insert([row]).select(SELECT_PACIENTE).maybeSingle();
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
        nombres: (nombresPaciente || 'Invitado').trim() || 'Invitado',
        apellidos: 'Invitado',
        correo: `invitado_${cedula}@guest.centromedico.local`,
        celular: '0900000000',
        fecha_nacimiento: '2000-01-01',
        password: `invitado_${cedula}`,
        es_invitado: true
    };
    return insertPacienteSupabase(row);
}

/** Fila BD `especialistas` → forma esperada por citas/directorio (objeto `doctor`). */
export function mapEspecialistaSupabaseACartera(row) {
    if (!row) return null;
    const idEsp = row.id_especialista;
    const nombreCompleto = row.nombre_completo || '';
    return {
        id: idEsp,
        id_especialista: idEsp,
        especialidad: row.especialidad,
        duracion_minutos: row.duracion_minutos ?? 30,
        horarios_atencion: row.horarios_atencion,
        actividades: row.actividades,
        nombre_completo: nombreCompleto,
        doctor: {
            nombre_completo: nombreCompleto,
            nombres: '',
            apellidos: ''
        }
    };
}

export async function fetchEspecialistasSupabase() {
    const SELECT_ESP =
        'id_especialista, especialidad, nombre_completo, duracion_minutos, horarios_atencion, actividades';
    const { data, error } = await supabase.from('especialistas').select(SELECT_ESP).order('id_especialista');
    if (error) throw error;
    return (data || []).map(mapEspecialistaSupabaseACartera);
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
    const nombresRaw = (row.nombres || '').trim();
    const apellidosRaw = (row.apellidos || '').trim();
    const nP = nombresRaw.split(/\s+/).filter(Boolean);
    const aP = apellidosRaw.split(/\s+/).filter(Boolean);
    const correoVal = row.correo ?? row.email ?? '';
    return {
        identificacion: ced,
        cedula: ced,
        tipoDoc: row.tipoDoc ?? row.tipo_doc ?? 'Cédula',
        nombre1: nP[0] || row.nombre1 || row.nombre_1 || '',
        nombre2: nP.slice(1).join(' ') || row.nombre2 || row.nombre_2 || '',
        apellido1: aP[0] || row.apellido1 || row.apellido_1 || '',
        apellido2: aP.slice(1).join(' ') || row.apellido2 || row.apellido_2 || '',
        nombre_1: nP[0] || row.nombre_1 || row.nombre1 || '',
        nombre_2: nP.slice(1).join(' ') || row.nombre_2 || row.nombre2 || '',
        apellido_1: aP[0] || row.apellido_1 || row.apellido1 || '',
        apellido_2: aP.slice(1).join(' ') || row.apellido_2 || row.apellido2 || '',
        fechaNac: row.fechaNac ?? row.fecha_nacimiento ?? '',
        fecha_nacimiento: row.fecha_nacimiento ?? row.fechaNac ?? '',
        sexo: row.sexo ?? '',
        celular: row.celular ?? '',
        fijo: row.fijo ?? '',
        email: correoVal,
        correo: correoVal,
        password: row.password ?? '',
        nombres: nombresRaw || row.nombres || '',
        apellidos: apellidosRaw || row.apellidos || '',
        es_invitado: !!row.es_invitado
    };
}

export function pacienteDesdeRegistroLocal(nuevoUsuario) {
    const n1 = (nuevoUsuario.nombre1 || '').trim();
    const n2 = (nuevoUsuario.nombre2 || '').trim();
    const a1 = (nuevoUsuario.apellido1 || '').trim();
    const a2 = (nuevoUsuario.apellido2 || '').trim();
    return {
        cedula: nuevoUsuario.identificacion,
        nombres: [n1, n2].filter(Boolean).join(' ').trim(),
        apellidos: [a1, a2].filter(Boolean).join(' ').trim(),
        correo: (nuevoUsuario.email || '').trim(),
        celular: (nuevoUsuario.celular || '').trim(),
        fecha_nacimiento: nuevoUsuario.fechaNac || null,
        password: nuevoUsuario.password,
        es_invitado: false
    };
}
