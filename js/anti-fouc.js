(function () {
    if (localStorage.getItem('usuarioLogueado') !== 'true') return;

    document.documentElement.classList.add('logueado');

    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.getElementById('btn-auth');
        if (!btn) return;
        try {
            var u = JSON.parse(localStorage.getItem('usuarioActivo') || '{}');
            var nom = ((u.nombre1 || u.nombre_1 || (u.nombres || '').split(/\s+/)[0]) || '').trim();
            var ape = ((u.apellido1 || u.apellido_1 || (u.apellidos || '').split(/\s+/)[0]) || '').trim();
            var label = nom ? (ape ? nom + ' ' + ape : nom) : 'Mi Perfil';
            if (label.length > 22) label = label.substring(0, 20) + '\u2026';
            btn.innerHTML = '<i class="fa-regular fa-user" aria-hidden="true"></i> ' + label;
            btn.setAttribute('aria-label', 'Ver perfil de ' + label);
        } catch (e) {}
    });
})();
