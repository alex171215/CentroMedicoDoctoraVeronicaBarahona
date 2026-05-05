# Sesión de Diseño Activa: Corrección del Motor Matemático de Colisiones (Buffer)

## 1. Objetivo
Reparar la lógica de verificación de buffer de 30 minutos en `app.js` que está bloqueando erróneamente citas en la mañana por culpa de citas en la tarde, y hacer dinámico el mensaje del modal.

## 2. Instrucciones Técnicas para Antigravity

### A. Refactorización de Fórmula Matemática (app.js)
* **Ubicación:** Dentro de `app.citas._verificarColisionYContinuar`, localiza la sección comentada como `// --- Verificación de buffer (30 min después de cualquier cita existente) ---`.
* **El Error Actual:** El código evalúa erróneamente `if (inicioMinNueva < minPermitido)`.
* **La Solución:** Reemplaza ese bloque (desde el cálculo de `inicioMinNueva` hasta el `return;` del modal) con esta lógica exacta de intervalos cruzados:

\`\`\`javascript
// --- Verificación de buffer (30 min de margen entre citas) ---
const [hNueva, mNueva] = hora.split(':').map(Number);
const inicioMinNueva = hNueva * 60 + mNueva;

// Obtener duración de la NUEVA cita
const doc = this._doctorActual;
const duracionNueva = doc ? (doc.duracion_minutos || 30) : 30;
const finMinNueva = inicioMinNueva + duracionNueva;

const citasMismoDia = citasPublicas.filter(c =>
    c.cedula === cedulaPaciente && c.fecha === fechaISO && c.estado !== 'Cancelada'
);

const idCitaModificando = modCtx ? (modCtx.id_cita || modCtx.idCita) : null;
const db = JSON.parse(localStorage.getItem('sanitasFam_db'));

for (const cita of citasMismoDia) {
    if (idCitaModificando && (cita.id_cita === idCitaModificando || cita.id === idCitaModificando)) continue;

    let duracionExistente = 30;
    if (db && db.cartera_especialistas) {
        const esp = db.cartera_especialistas.find(e => e.especialidad === cita.especialidad);
        if (esp) duracionExistente = esp.duracion_minutos || 30;
    }

    const [hExt, mExt] = cita.hora.split(':').map(Number);
    const inicioMinExistente = hExt * 60 + mExt;
    const finMinExistente = inicioMinExistente + duracionExistente;

    // FÓRMULA DE COLISIÓN (30 min): Se solapan si (FinA + 30 > InicioB) Y (FinB + 30 > InicioA)
    const margen = 30;
    const colisiona = (finMinNueva + margen > inicioMinExistente) && (finMinExistente + margen > inicioMinNueva);

    if (colisiona) {
        let mensajeEspecial = "";
        if (inicioMinNueva < inicioMinExistente) {
            const maxHora = inicioMinExistente - margen - duracionNueva;
            const hStr = \`\${String(Math.floor(maxHora / 60)).padStart(2, '0')}:\${String(maxHora % 60).padStart(2, '0')}\`;
            mensajeEspecial = \`Antes de esta cita, tendrías que agendar máximo a las <strong>\${hStr}</strong>.\`;
        } else {
            const minHora = finMinExistente + margen;
            const hStr = \`\${String(Math.floor(minHora / 60)).padStart(2, '0')}:\${String(minHora % 60).padStart(2, '0')}\`;
            mensajeEspecial = \`Después de esta cita, intenta un horario posterior a las <strong>\${hStr}</strong>.\`;
        }
        
        const detalle = \`<strong>\${cita.especialidad || 'Especialidad'}</strong> con <strong>\${cita.medico || 'Médico'}</strong> a las <strong>\${cita.hora}</strong>\`;
        this._mostrarModalBuffer(detalle, duracionExistente, mensajeEspecial);
        return;
    }
}
\`\`\`

### B. Ajuste del Modal de Buffer (app.js)
* **Ubicación:** En la función `app.citas._mostrarModalBuffer(detalleCitaPrevia, duracionMin, horaPermitida)`.
* **La Solución:** Cambia el nombre del tercer parámetro a `mensajeEspecial`.
* Reemplaza la línea rígida `<br><br>Intenta un horario posterior a las <strong>\${horaPermitida}</strong>.` por `<br><br>\${mensajeEspecial}`.

**Restricciones:** No alteres el sistema de colisiones exactas (la primera parte de `_verificarColisionYContinuar`), solo el motor de buffer.