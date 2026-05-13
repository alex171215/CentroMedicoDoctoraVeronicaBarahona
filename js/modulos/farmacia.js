import { obtenerProductosFarmacia } from './inventarioFarmacia.js';

export const farmacia = {
    _categoriaActiva: 'TODAS',
    _productos: [],
    _resultadosActuales: [],
    _paginaActual: 1,
    _itemsPorPagina: 12,
    _debounceTimer: null,
    _gridInteraccionLista: false,

    _nombresCortosCat: {
        'ANTIPIRETICOS – ANTIINFLAMATORIOS PEDIATRICOS': 'Fiebre y Dolor (Pediatría)',
        'ANTIPIRETICOS - ANTIINFLAMATORIOS ADULTOS': 'Fiebre y Dolor (Adultos)',
        'MUCOLITICOS - ANTIHISTAMINICOS - EXPECTORANTES PEDIATRICOS': 'Respiratorio (Pediatría)',
        'ANTIHISTAMINICOS - MUCOLITICOS - ANTIGRIPALES ADULTOS': 'Respiratorio (Adultos)',
        'ANTIBIOTICOS PEDIATRICOS': 'Antibióticos (Pediatría)',
        'ANTIBIOTICOS ADULTOS': 'Antibióticos (Adultos)',
        'ANTIPARASITARIOS PEDIATRICOS': 'Antiparasitarios (Ped.)',
        'ANTIPARASITARIOS ADULTOS': 'Antiparasitarios (Adul.)',
        'TRACTO DIGESTIVO': 'Tracto Digestivo',
        'DERMATOLOGIA': 'Dermatología',
        'OFTALMOLOGIA': 'Oftalmología',
        'GINECOLOGIA': 'Ginecología',
        'COLESTEROL y TRIGLICERIDOS': 'Cardiología / Colesterol',
        'ENDOCRINOLOGIA': 'Endocrinología',
        'VITAMINAS PEDIATRICOS': 'Vitaminas (Pediatría)',
        'VITAMINAS ADULTOS': 'Vitaminas (Adultos)',
        'OTROS': 'Otros',
        'NEBULIZACIONES': 'Nebulizaciones',
        'LECHES': 'Fórmulas y Leches'
    },

    _claseStock(cantidad) {
        if (cantidad === 0) {
            return {
                clase: 'stock-out',
                texto: 'Agotado',
                aria: 'Medicamento agotado en el centro, sin unidades disponibles'
            };
        }
        if (cantidad <= 5) {
            return {
                clase: 'stock-low',
                texto: `Disponible en centro: ${cantidad} unidades (bajo stock)`,
                aria: `Disponible en farmacia del centro, ${cantidad} unidades, stock bajo`
            };
        }
        return {
            clase: 'stock-high',
            texto: `Disponible en centro: ${cantidad} unidades`,
            aria: `Disponible en farmacia del centro, ${cantidad} unidades en stock`
        };
    },

    _cargarProductos() {
        return obtenerProductosFarmacia();
    },

    _renderizarChips(categorias) {
        const container = document.getElementById('farmacia-chips');
        if (!container) return;

        const grupos = {
            'PEDIATRÍA': ['ANTIPIRETICOS – ANTIINFLAMATORIOS PEDIATRICOS', 'MUCOLITICOS - ANTIHISTAMINICOS - EXPECTORANTES PEDIATRICOS', 'ANTIBIOTICOS PEDIATRICOS', 'ANTIPARASITARIOS PEDIATRICOS', 'VITAMINAS PEDIATRICOS', 'LECHES'],
            'ADULTOS': ['ANTIPIRETICOS - ANTIINFLAMATORIOS ADULTOS', 'ANTIHISTAMINICOS - MUCOLITICOS - ANTIGRIPALES ADULTOS', 'ANTIBIOTICOS ADULTOS', 'ANTIPARASITARIOS ADULTOS', 'VITAMINAS ADULTOS'],
            'ESPECIALIDADES': ['TRACTO DIGESTIVO', 'DERMATOLOGIA', 'OFTALMOLOGIA', 'GINECOLOGIA', 'COLESTEROL y TRIGLICERIDOS', 'ENDOCRINOLOGIA', 'NEBULIZACIONES'],
            'OTROS': ['OTROS']
        };

        let html = `<a href="#" class="farmacia-sidebar__item farmacia-sidebar__item--active" data-cat="TODAS">Todas</a>`;
        for (const [nombreGrupo, catsDelGrupo] of Object.entries(grupos)) {
            const catsValidas = catsDelGrupo.filter(c => categorias.includes(c));
            if (catsValidas.length === 0) continue;
            html += `<h4 class="farmacia-sidebar__group-title">${nombreGrupo}</h4>`;
            catsValidas.forEach(cat => {
                const nombreMostrar = this._nombresCortosCat[cat] || cat;
                html += `<a href="#" class="farmacia-sidebar__item" data-cat="${cat}">${nombreMostrar}</a>`;
            });
        }
        container.innerHTML = html;

        container.querySelectorAll('.farmacia-sidebar__item[data-cat]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const cat = item.getAttribute('data-cat');
                if (cat) this._filtrarPorCategoria(cat);
            });
        });
    },

    _renderizarGrid() {
        const grid = document.getElementById('farmacia-grid');
        const empty = document.getElementById('farmacia-empty');
        const btnMas = document.getElementById('btn-cargar-mas');
        if (!grid) return;

        if (this._resultadosActuales.length === 0) {
            grid.innerHTML = '';
            if (empty) empty.style.display = 'block';
            if (btnMas) btnMas.style.display = 'none';
            return;
        }

        if (empty) empty.style.display = 'none';

        const tope = this._paginaActual * this._itemsPorPagina;

        grid.innerHTML = this._resultadosActuales.slice(0, tope).map((p, idx) => {
            const agotado = p.stock === 0;
            const stockInfo = this._claseStock(p.stock);
            const cardClass = agotado ? 'medicine-card medicine-card--agotado' : 'medicine-card';
            const lab = p.laboratorio || '—';
            const interactivo = !agotado ? 'role="button" tabindex="0"' : 'tabindex="-1"';

            return `
                    <article class="${cardClass}" data-idx="${idx}" title="${this._escapeAttr(p.comercial)}" ${interactivo}
                        aria-label="${this._escapeAttr(p.comercial + '. ' + stockInfo.aria)}">
                        <div class="medicine-card__img-wrap">
                            <img class="medicine-card__img" src="${p.imagen}" alt="${this._escapeAttr(p.comercial)}" loading="lazy"
                                onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                            <span class="medicine-card__img-placeholder" style="display:none;"><i class="fa-solid fa-pills" aria-hidden="true"></i></span>
                           ${p.requiereReceta ? '<span class="medicine-card__cat-badge medicine-card__cat-badge--rx">Requiere receta</span>' : ''}
                        </div>
                        <div class="medicine-card__body">
                            <p class="medicine-card__name">${this._escapeHtml(p.comercial)}</p>
                            <p class="medicine-card__generic">${this._escapeHtml(p.generico)}</p>
                            <p class="medicine-card__lab"><span class="sr-only">Laboratorio: </span>${this._escapeHtml(lab)}</p>
                            <div class="medicine-card__footer">
                                <span class="medicine-card__stock ${stockInfo.clase}" role="status" aria-label="${this._escapeAttr(stockInfo.aria)}">${this._escapeHtml(stockInfo.texto)}</span>
                            </div>
                        </div>
                    </article>`;
        }).join('');

        if (btnMas) {
            btnMas.style.display = (tope < this._resultadosActuales.length) ? 'inline-flex' : 'none';
        }

        this._enlazarInteraccionGrid();
    },

    _escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    _escapeAttr(s) {
        return this._escapeHtml(s).replace(/'/g, '&#39;');
    },

    _enlazarInteraccionGrid() {
        const grid = document.getElementById('farmacia-grid');
        if (!grid || this._gridInteraccionLista) return;
        this._gridInteraccionLista = true;

        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.medicine-card');
            if (!card || card.classList.contains('medicine-card--agotado')) return;
            const idx = parseInt(card.getAttribute('data-idx'), 10);
            if (Number.isNaN(idx)) return;
            const p = this._resultadosActuales[idx];
            if (p) this.abrirModalMedicamento(p);
        });

        grid.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const card = e.target.closest('.medicine-card');
            if (!card || card.classList.contains('medicine-card--agotado')) return;
            e.preventDefault();
            const idx = parseInt(card.getAttribute('data-idx'), 10);
            if (Number.isNaN(idx)) return;
            const p = this._resultadosActuales[idx];
            if (p) this.abrirModalMedicamento(p);
        });
    },

    _cargarMas() {
        this._paginaActual++;
        this._renderizarGrid();
    },

    _filtrarPorCategoria(cat) {
        this._categoriaActiva = cat;
        const query = (document.getElementById('farmacia-buscador')?.value || '').trim();
        this._aplicarFiltros(query, cat);

        document.querySelectorAll('.farmacia-sidebar__item').forEach(item => {
            item.classList.toggle('farmacia-sidebar__item--active', item.dataset.cat === cat);
        });
    },

    _aplicarFiltros(query, categoria) {
        let resultado = [...this._productos];

        if (categoria && categoria !== 'TODAS') {
            resultado = resultado.filter(p => p.categoria === categoria);
        }

        if (query.length > 0) {
            const normalizar = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const terminos = normalizar(query).split(' ').filter(t => t.length > 0);

            resultado = resultado.filter(p => {
                const textoCompleto = normalizar(`${p.comercial} ${p.generico} ${p.presentacion}`);
                return terminos.every(termino => textoCompleto.includes(termino));
            });
        }

        this._resultadosActuales = resultado;
        this._paginaActual = 1;
        this._renderizarGrid();
    },

    _iniciarBuscador() {
        const input = document.getElementById('farmacia-buscador');
        if (!input) return;

        input.addEventListener('input', () => {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => {
                const query = input.value.trim().toLowerCase();
                this._aplicarFiltros(query, this._categoriaActiva);
            }, 250);
        });
    },

        inicializar() {
            const view = document.getElementById('view-farmacia');
            if (view) view.style.display = 'block';

            if (this._productos.length === 0) {
            this._productos = this._cargarProductos();
        }

        const categorias = [...new Set(this._productos.map(p => p.categoria))];

        this._categoriaActiva = 'TODAS';
        this._renderizarChips(categorias);

        const modalList = document.getElementById('farmacia-filtros-modal-list');
        const sidebarList = document.getElementById('farmacia-chips');
        if (modalList && sidebarList) {
            modalList.innerHTML = sidebarList.innerHTML;
            modalList.querySelectorAll('.farmacia-sidebar__item[data-cat]').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const cat = item.getAttribute('data-cat');
                    if (cat) this._filtrarPorCategoria(cat);
                });
            });
        }

        const btnFiltrosMobile = document.getElementById('btn-filtros-mobile');
        if (btnFiltrosMobile) {
            btnFiltrosMobile.addEventListener('click', () => this.abrirModalFiltros());
        }

        const modalFiltros = document.getElementById('modal-filtros-mobile');
        if (modalFiltros) {
            modalFiltros.addEventListener('click', (e) => {
                if (e.target === modalFiltros) this.cerrarModalFiltros();
            });
        }
        this._aplicarFiltros('', 'TODAS');
        this._iniciarBuscador();

        const modalMed = document.getElementById('modal-medicamento');
        if (modalMed) {
            modalMed.addEventListener('click', (e) => {
                if (e.target === modalMed) this.cerrarModalMedicamento();
            });
        }
    },

    abrirModalMedicamento(p) {
        const root = document.getElementById('modal-medicamento');
        if (!root || !p) return;
        const t = document.getElementById('modal-med-title');
        const g = document.getElementById('modal-med-generic');
        const pr = document.getElementById('modal-med-presentacion');
        const lab = document.getElementById('modal-med-laboratorio');
        const st = document.getElementById('modal-med-stock');
        const img = document.getElementById('modal-med-img');
        if (!t || !g || !pr || !st || !img) return;

        t.textContent = p.comercial;
        g.textContent = p.generico;
        pr.textContent = p.presentacion || '—';
        if (lab) lab.textContent = p.laboratorio || '—';

        const stockInfo = this._claseStock(p.stock);
        st.textContent = p.stock === 0 ? 'Agotado' : `${p.stock} unidades en el centro`;
        st.setAttribute('aria-label', stockInfo.aria);

        img.src = p.imagen;
        img.alt = p.comercial || 'Medicamento';

        const recetaEl = document.getElementById('modal-med-receta');
        if (recetaEl) {
            recetaEl.style.display = p.requiereReceta ? 'flex' : 'none';
        }
        root.style.display = 'flex';
        setTimeout(() => {
            const closeBtn = document.querySelector('#modal-medicamento .modal-close');
            if (closeBtn) closeBtn.focus();
        }, 100);
    },

    cerrarModalMedicamento() {
        const m = document.getElementById('modal-medicamento');
        if (m) m.style.display = 'none';
    },

    abrirModalFiltros() {
        const modal = document.getElementById('modal-filtros-mobile');
        if (modal) modal.style.display = 'flex';
    },

    cerrarModalFiltros() {
        const modal = document.getElementById('modal-filtros-mobile');
        if (modal) modal.style.display = 'none';
    }
};
