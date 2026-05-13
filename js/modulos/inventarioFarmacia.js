/**
 * Inventario de farmacia compartido: lectura desde localStorage (sanitasFam_db),
 * stock estable por sesión y cruce con nombres de recetas.
 */

const STOCK_SESSION_KEY = 'SANITAS_farmacia_stock_v1';

const CATEGORIAS_CON_RECETA = [
    'ANTIBIOTICOS PEDIATRICOS',
    'ANTIBIOTICOS ADULTOS',
    'DERMATOLOGIA',
    'OFTALMOLOGIA',
    'GINECOLOGIA',
    'NEBULIZACIONES',
    'COLESTEROL y TRIGLICERIDOS',
    'ENDOCRINOLOGIA'
];

function _hashString(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h) + s.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

function _stockSesionParaClave(clave) {
    let map = {};
    try {
        map = JSON.parse(sessionStorage.getItem(STOCK_SESSION_KEY) || '{}');
    } catch (_) {
        map = {};
    }
    if (Object.prototype.hasOwnProperty.call(map, clave)) return map[clave];
    const stock = _hashString(clave) % 51;
    map[clave] = stock;
    try {
        sessionStorage.setItem(STOCK_SESSION_KEY, JSON.stringify(map));
    } catch (_) { /* private mode */ }
    return stock;
}

export function normalizarNombreBusqueda(str) {
    return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

export function parsearProducto(rawString) {
    let raw = (rawString || '').trim();

    if (raw.includes('ACTIVA ANTICASPA CHAMPU')) {
        return { comercial: 'ACTIVA ANTICASPA CHAMPU', generico: 'Uso Tópico', presentacion: 'Frasco' };
    }
    if (raw.includes('URIAGE DESODORANTE')) {
        return { comercial: 'URIAGE DESODORANTE', generico: 'Uso Tópico', presentacion: 'Roll-on/Spray' };
    }
    if (raw.includes('LAMODERM') && raw.includes('SPRAY ANTITRANSPIRANTE')) {
        raw = raw.split('SPRAY ANTITRANSPIRANTE')[0].trim();
    }

    const matchGenerico = raw.match(/^([^(]+?)\s*\(([^)]+)\)\s*(.*?)$/);

    if (matchGenerico) {
        return {
            comercial: matchGenerico[1].trim(),
            generico: matchGenerico[2].trim(),
            presentacion: matchGenerico[3].trim()
        };
    }

    if (raw.length > 35) {
        return { comercial: raw.substring(0, 32) + '...', generico: '—', presentacion: '' };
    }
    return { comercial: raw, generico: '—', presentacion: '' };
}

function imagenProducto(nombre, presentacion) {
    const haystack = (nombre + ' ' + presentacion).toUpperCase();
    if (/JARABE|SUSPENSION|GOTERO|SOLUCION/.test(haystack)) {
        return 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&q=70';
    }
    if (/CREMA|GEL|UNGÜENTO|LOCION|POMADA/.test(haystack)) {
        return 'https://images.unsplash.com/photo-1664376694240-14da625cc0c8?q=80';
    }
    if (/AMPOLLA|AMPOLLAS|INYECTABLE/.test(haystack)) {
        return 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=300&q=70';
    }
    if (/GOTAS|COLIRIO|SPRAY NASAL/.test(haystack)) {
        return 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=300&q=70';
    }
    if (/TARRO|LECHE|FORMULA|SUPLEMENTO|CEREALES/.test(haystack)) {
        return 'https://images.unsplash.com/photo-1579194440951-0c501e8ba3c5?q=80';
    }
    return 'https://images.unsplash.com/photo-1550572017-4fcdbb59cc32?w=300&q=70';
}

/**
 * @returns {Array<{ categoria: string, comercial: string, generico: string, presentacion: string, stock: number, imagen: string, requiereReceta: boolean, laboratorio: string }>}
 */
export function obtenerProductosFarmacia() {
    const dbStr = localStorage.getItem('sanitasFam_db');
    if (!dbStr) return [];

    let db;
    try {
        db = JSON.parse(dbStr);
    } catch (_) {
        return [];
    }

    let categorias = [];
    try {
        categorias = db.inventario_botiquin.categorias_medicamentos[0].inventario_botiquin.categorias_medicamentos;
    } catch (_) {
        return [];
    }

    const lista = [];
    categorias.forEach(cat => {
        const nombreCat = (cat.categoria || 'OTROS').trim();
        const requiereReceta = CATEGORIAS_CON_RECETA.includes(nombreCat);
        (cat.productos || []).forEach(rawProd => {
            const parsed = parsearProducto(rawProd);
            const claveStock = `${nombreCat}|${parsed.comercial}|${parsed.generico}`;
            const stock = _stockSesionParaClave(claveStock);
            lista.push({
                categoria: nombreCat,
                comercial: parsed.comercial,
                generico: parsed.generico,
                presentacion: parsed.presentacion,
                stock,
                imagen: imagenProducto(parsed.comercial, parsed.presentacion),
                requiereReceta,
                laboratorio: '—'
            });
        });
    });
    return lista;
}

function _puntuacionMatch(nombreRecetaNorm, comercialNorm) {
    if (!nombreRecetaNorm || !comercialNorm || comercialNorm.length < 2) return 0;
    if (nombreRecetaNorm.includes(comercialNorm)) return 100 + comercialNorm.length;
    const primera = comercialNorm.split(/\s+/)[0];
    if (primera.length >= 3 && nombreRecetaNorm.includes(primera)) return 50 + primera.length;
    return 0;
}

/**
 * @returns {{ encontrado: boolean, producto: object|null, stock: number }}
 */
export function resolverDisponibilidadPorNombreReceta(nombreMedicamento) {
    const productos = obtenerProductosFarmacia();
    const nRec = normalizarNombreBusqueda(nombreMedicamento);
    let mejor = null;
    let mejorP = 0;

    for (const p of productos) {
        const cNorm = normalizarNombreBusqueda(p.comercial);
        const score = _puntuacionMatch(nRec, cNorm);
        if (score > mejorP) {
            mejorP = score;
            mejor = p;
        }
    }

    if (!mejor || mejorP === 0) {
        return { encontrado: false, producto: null, stock: 0 };
    }
    return { encontrado: true, producto: mejor, stock: mejor.stock };
}

/**
 * Clasificación para badges en recetas (Mi Salud).
 * @param {{ nombre: string, via?: string, cantidad?: number }} med
 */
export function clasificarDisponibilidadReceta(med) {
    const nombre = (med.nombre || '').trim();
    const via = (med.via || '').trim();
    const nUp = nombre.toUpperCase();

    if (/indicaci[oó]n\s+m[eé]dica/i.test(via)) {
        return {
            tipo: 'no_aplica',
            etiquetaVisible: 'No catalogado en farmacia',
            etiquetaCorta: 'No aplica inventario',
            ariaLabel: `${nombre}: indicación médica, no consta en inventario de farmacia del centro`
        };
    }
    if (/^(DIETA|HIDRATACI[OÓ]N|REMEDIO CASERO)\b/.test(nUp.trim())) {
        return {
            tipo: 'no_aplica',
            etiquetaVisible: 'No catalogado en farmacia',
            etiquetaCorta: 'No aplica inventario',
            ariaLabel: `${nombre}: no es un medicamento del catálogo de farmacia`
        };
    }

    const res = resolverDisponibilidadPorNombreReceta(nombre);
    if (!res.encontrado) {
        return {
            tipo: 'no_disponible',
            etiquetaVisible: 'Agotado/No Disponible',
            etiquetaCorta: 'No disponible',
            ariaLabel: `${nombre}: no figura en el inventario de la farmacia del centro médico`
        };
    }
    if (res.stock <= 0) {
        return {
            tipo: 'no_disponible',
            etiquetaVisible: 'Agotado/No Disponible',
            etiquetaCorta: 'Agotado',
            ariaLabel: `${nombre}: figura en farmacia del centro pero sin stock disponible`
        };
    }
    return {
        tipo: 'disponible',
        etiquetaVisible: 'Disponible en Centro Médico',
        etiquetaCorta: 'Disponible',
        ariaLabel: `${nombre}: disponible en farmacia del centro médico, ${res.stock} unidades aproximadas en stock`,
        stock: res.stock
    };
}
