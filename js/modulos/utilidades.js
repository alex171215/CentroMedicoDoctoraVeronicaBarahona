/**
 * Utilidades transversales: validación cédula/celular, PDF, impresión, plantillas.
 */
export const utilidades = {
    /**
     * Validación contextual de celular (H9). Retorna mensaje de error o null si es válido.
     */
    validarCelular(valor) {
        const v = (valor || '').trim();
        if (v.length === 0) {
            return 'El celular es obligatorio.';
        }
        if (!/^\d+$/.test(v) || v.length !== 10) {
            return 'El celular debe tener exactamente 10 dígitos numéricos.';
        }
        if (!/^09/.test(v)) {
            return 'El celular debe comenzar con 09.';
        }
        if (/^(0{10}|09{9}0|090{8})$/.test(v) || /^(\d)\1{9}$/.test(v)) {
            return 'El número ingresado no es válido.';
        }
        return null;
    },

    validarCedulaEcuatoriana(cedula) {
            if (!cedula) return false;
            const digitos = cedula.replace(/\D/g, '');
            if (digitos.length !== 10 && digitos.length !== 13) return false;

            // Si es RUC 13 dígitos, los últimos 3 deben ser 001 (persona natural)
            if (digitos.length === 13 && digitos.substring(10) !== '001') return false;

            const base = digitos.substring(0, 10);
            const digitoRegion = parseInt(base.substring(0, 2), 10);
            if (digitoRegion < 1 || digitoRegion > 24) return false;

            const tercerDigito = parseInt(base.charAt(2), 10);
            if (tercerDigito >= 6) return false;

            const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
            let suma = 0;
            for (let i = 0; i < 9; i++) {
                let valor = parseInt(base.charAt(i), 10) * coeficientes[i];
                if (valor >= 10) valor -= 9;
                suma += valor;
            }
            const digitoVerificador = suma % 10 === 0 ? 0 : 10 - (suma % 10);
            return digitoVerificador === parseInt(base.charAt(9), 10);
        },

        /**
         * Restringe un input type="date" a un rango de edad entre 18 y 60 años.
         * @param {string} inputId - id del elemento <input type="date">
         */
        aplicarRestriccionEdad(inputId) {
            const input = document.getElementById(inputId);
            if (!input) return;

            const hoy = new Date();
            const maxDate = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate());
            const minDate = new Date(hoy.getFullYear() - 60, hoy.getMonth(), hoy.getDate());

            const format = d => d.toISOString().split('T')[0];
            input.setAttribute('min', format(minDate));
            input.setAttribute('max', format(maxDate));
        },

        /**
         * Imprime el área indicada usando el diálogo nativo del navegador.
         * El @media print en styles.css se encarga de ocultar header, footer,
         * .bottom-nav y botones de acción automáticamente.
         * @param {string} idContenedor - ID del elemento a imprimir.
         */
        imprimirArea(idContenedor) {
            const contenedor = document.getElementById(idContenedor);
            if (!contenedor) {
                console.warn(`[app.utilidades] imprimirArea: no se encontró el contenedor "${idContenedor}".`);
                return;
            }
            window.print();
        },

        /**
         * Genera y descarga un PDF del contenedor indicado usando html2pdf.js (CDN).
         * Configuración: margen 10mm, formato A4, calidad de imagen óptima.
         * @param {string} idContenedor  - ID del elemento a exportar.
         * @param {string} nombreArchivo - Nombre del archivo descargado (sin extensión).
         */
        descargarPDF(idContenedor, nombreArchivo) {
            const contenedor = document.getElementById(idContenedor);
            if (!contenedor) {
                console.warn(`[app.utilidades] descargarPDF: no se encontró el contenedor "${idContenedor}".`);
                return;
            }

            if (typeof html2pdf === 'undefined') {
                console.error('[app.utilidades] descargarPDF: la librería html2pdf.js no está cargada.');
                return;
            }

            const opciones = {
                margin:       10,
                filename:     `${nombreArchivo || 'documento'}.pdf`,
                image:        { type: 'jpeg', quality: 0.95 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            html2pdf().set(opciones).from(contenedor).save();
        },

        /**
         * Genera HTML de ticket/comprobante a partir de un objeto cita.
         * Adaptado de app.citas._generarTicketHTML para recibir un objeto cita
         * en lugar de parámetros sueltos.
         * @param {Object} cita - Objeto con {medico, especialidad, fecha, hora, paciente}
         * @returns {string} HTML del ticket
         */
        _generarTicketHTML(cita) {
            const medico = cita.medico || '—';
            const especialidad = cita.especialidad || '—';
            const fechaHora = (cita.fecha || '') + (cita.hora ? ', ' + cita.hora : '');
            const paciente = cita.paciente || '—';

            return `
                <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; text-align: center; font-family: sans-serif; box-sizing: border-box;">
                    <div style="margin-bottom: 20px;">
                        <h1 style="font-size: 1.8rem; color: #3B49A3; margin: 0 0 5px 0;">Centro Médico Familiar</h1>
                        <h2 style="font-size: 1.3rem; color: #0DA99F; margin: 0 0 10px 0;">Dra. Verónica Barahona</h2>
                        <p style="font-size: 1rem; color: #555; margin: 0;">Pifo, Ignacio Jarrín y Tulio Garzón · Quito, Ecuador</p>
                        <p style="font-size: 1rem; color: #555; margin: 5px 0 0 0;">Tel: 099 890 8034</p>
                    </div>
                    <h3 style="color: #3B49A3; font-size: 1.4rem; margin-bottom: 30px; border-bottom: 2px solid #0DA99F; padding-bottom: 10px; display: inline-block;">COMPROBANTE DE CITA MÉDICA</h3>
                    <div style="text-align: left; margin: 0 auto 30px auto; max-width: 400px; font-size: 1.1rem; line-height: 1.6; color: #333;">
                        <p style="margin: 0 0 10px 0;"><strong>Fecha y Hora:</strong> ${fechaHora}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Médico:</strong> ${medico}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Especialidad:</strong> ${especialidad}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Paciente:</strong> ${paciente}</p>
                    </div>
                    <div style="background: #fef9e7; border-left: 4px solid #FDAD34; padding: 15px; font-size: 0.9rem; color: #666; text-align: left; max-width: 600px; margin: 0 auto;">
                        <strong style="color: #c47f0a;">Importante:</strong> Presente este comprobante al momento de su consulta. Para cancelar o reprogramar, comuníquese con anticipación al 099 890 8034.
                    </div>
                    <p style="font-size: 0.8rem; color: #aaa; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
                        Documento generado electrónicamente · ${new Date().toLocaleDateString('es-EC')}
                    </p>
                </div>
            `;
        },

        /**
         * Imprime un comprobante de cita usando window.open (sistema limpio, sin sidebar).
         * Clona la lógica exacta de app.citas.imprimirComprobante.
         * @param {Object} cita - Objeto cita con {medico, especialidad, fecha, hora, paciente}
         */
        imprimirCita(cita) {
            const ticketHTML = this._generarTicketHTML(cita);
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Imprimir Comprobante</title>
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            background: #fff;
                            display: flex;
                            justify-content: center;
                            align-items: flex-start;
                        }
                        @media print {
                            @page { size: letter; margin: 0.5in; }
                        }
                    </style>
                </head>
                <body>
                    ${ticketHTML}
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                window.close();
                            }, 500);
                        }
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        },

        /**
         * Descarga un PDF de comprobante de cita usando jsPDF nativo (sin html2canvas).
         * Clona la lógica exacta de app.citas.descargarComprobantePDF.
         * @param {Object} cita - Objeto cita con {medico, especialidad, fecha, hora, paciente}
         */
        descargarPDFCita(cita) {
            const medico = cita.medico || '—';
            const especialidad = cita.especialidad || '—';
            const fechaHora = (cita.fecha || '') + (cita.hora ? ', ' + cita.hora : '');
            const paciente = cita.paciente || '—';

            try {
                const { jsPDF } = window.jspdf || window;
                const doc = new jsPDF('p', 'mm', 'letter');

                const pageWidth = 215.9;
                const margin = 25;
                let y = margin;

                // Encabezado
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(18);
                doc.setTextColor(59, 73, 163);
                doc.text('Centro Médico Familiar', pageWidth / 2, y, { align: 'center' });
                y += 10;

                doc.setFontSize(13);
                doc.setTextColor(13, 169, 159);
                doc.text('Dra. Verónica Barahona', pageWidth / 2, y, { align: 'center' });
                y += 7;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(85, 85, 85);
                doc.text('Pifo, Ignacio Jarrín y Tulio Garzón · Quito, Ecuador', pageWidth / 2, y, { align: 'center' });
                y += 5;
                doc.text('Tel: 099 890 8034', pageWidth / 2, y, { align: 'center' });
                y += 12;

                // Línea separadora
                doc.setDrawColor(13, 169, 159);
                doc.setLineWidth(0.5);
                doc.line(margin, y, pageWidth - margin, y);
                y += 8;

                // Título
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.setTextColor(59, 73, 163);
                doc.text('COMPROBANTE DE CITA MÉDICA', pageWidth / 2, y, { align: 'center' });
                y += 12;

                // Detalles
                const leftX = margin + 10;
                const valueX = leftX + 45;
                doc.setFontSize(12);
                doc.setTextColor(33, 33, 33);

                const campos = [
                    { label: 'Fecha y Hora:', value: fechaHora },
                    { label: 'Médico:', value: medico },
                    { label: 'Especialidad:', value: especialidad },
                    { label: 'Paciente:', value: paciente }
                ];
                campos.forEach(campo => {
                    doc.setFont('helvetica', 'bold');
                    doc.text(campo.label, leftX, y);
                    doc.setFont('helvetica', 'normal');
                    doc.text(campo.value, valueX, y);
                    y += 10;
                });

                y += 6;

                // Nota
                doc.setFillColor(254, 249, 231);
                doc.rect(margin, y, pageWidth - 2 * margin, 20, 'F');
                doc.setDrawColor(253, 173, 52);
                doc.setLineWidth(1.2);
                doc.line(margin, y, margin, y + 20);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(196, 127, 10);
                doc.text('Importante:', margin + 6, y + 6);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(102, 102, 102);
                const nota = doc.splitTextToSize(
                    'Presente este comprobante al momento de su consulta. Para cancelar o reprogramar, comuníquese con anticipación al 099 890 8034.',
                    pageWidth - 2 * margin - 12
                );
                doc.text(nota, margin + 6, y + 12);
                y += 28;

                // Pie
                doc.setFontSize(9);
                doc.setTextColor(170);
                doc.text(`Documento generado electrónicamente · ${new Date().toLocaleDateString('es-EC')}`, pageWidth / 2, y, { align: 'center' });

                doc.save('Cita_Medica.pdf');
            } catch (e) {
                console.error('Error al generar PDF:', e);
                alert('Error al generar PDF. Asegúrate de que la librería jsPDF esté cargada.');
            }
        },

        /**
         * Genera HTML profesional de receta médica a partir de un objeto receta.
         * Incluye membrete, info paciente, diagnóstico y tabla de medicamentos.
         * @param {Object} receta - Objeto con {medico, fecha, diagnostico[], medicamentos[]}
         * @returns {string} HTML de la receta
         */
        _generarRecetaHTML(receta) {
            const medico = receta.medico || '—';
            const fechaFmt = receta.fecha
                ? receta.fecha.split('-').reverse().join('/')
                : '—';
            const diags = (receta.diagnostico || []).join(', ') || '—';

            const filaMeds = (receta.medicamentos || []).map((m, i) => `
                <tr>
                    <td style="padding:8px 10px; border-bottom:1px solid #e0e0e0; font-size:0.95rem;">${i + 1}</td>
                    <td style="padding:8px 10px; border-bottom:1px solid #e0e0e0; font-size:0.95rem; font-weight:600;">${m.nombre}</td>
                    <td style="padding:8px 10px; border-bottom:1px solid #e0e0e0; font-size:0.85rem;">${m.dosis}</td>
                    <td style="padding:8px 10px; border-bottom:1px solid #e0e0e0; font-size:0.95rem; text-align:center;">${m.cantidad || '—'}</td>
                    <td style="padding:8px 10px; border-bottom:1px solid #e0e0e0; font-size:0.9rem;">${m.via}</td>
                </tr>
            `).join('');

            return `
                <div style="max-width:700px; margin:0 auto; padding:30px 25px; font-family:sans-serif; box-sizing:border-box; color:#333;">
                    <!-- Membrete -->
                    <div style="text-align:center; margin-bottom:15px;">
                        <h1 style="font-size:1.8rem; color:#3B49A3; margin:0 0 5px 0;">Centro Médico Familiar</h1>
                        <h2 style="font-size:1.3rem; color:#0DA99F; margin:0 0 8px 0;">Dra. Verónica Barahona</h2>
                        <p style="font-size:0.95rem; color:#555; margin:0;">Pifo, Ignacio Jarrín y Tulio Garzón · Quito, Ecuador</p>
                        <p style="font-size:0.95rem; color:#555; margin:3px 0 0 0;">Tel: 099 890 8034</p>
                    </div>
                    <h3 style="color:#3B49A3; font-size:1.3rem; margin-bottom:20px; border-bottom:2px solid #0DA99F; padding-bottom:8px; text-align:center; display:inline-block; width:100%;">RECETA MÉDICA</h3>

                    <!-- Info del paciente / receta -->
                    <div style="margin-bottom:18px; font-size:1.05rem; line-height:1.6;">
                        <p style="margin:0 0 6px 0;"><strong>Médico prescriptor:</strong> ${medico}</p>
                        <p style="margin:0 0 6px 0;"><strong>Fecha:</strong> ${fechaFmt}</p>
                        <p style="margin:0 0 6px 0;"><strong>Diagnóstico:</strong> ${diags}</p>
                    </div>

                    <!-- Tabla de medicamentos -->
                    <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
                        <thead>
                            <tr style="background:#3B49A3; color:#fff;">
                                <th style="padding:8px 10px; text-align:left; font-size:0.9rem;">#</th>
                                <th style="padding:8px 10px; text-align:left; font-size:0.9rem;">Medicamento</th>
                                <th style="padding:8px 10px; text-align:left; font-size:0.9rem;">Dosis / Indicación</th>
                                <th style="padding:8px 10px; text-align:center; font-size:0.9rem;">Cant.</th>
                                <th style="padding:8px 10px; text-align:left; font-size:0.9rem;">Vía</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filaMeds}
                        </tbody>
                    </table>

                    <!-- Nota -->
                    <div style="background:#fef9e7; border-left:4px solid #FDAD34; padding:12px 15px; font-size:0.85rem; color:#666;">
                        <strong style="color:#c47f0a;">Importante:</strong> Esta receta es de uso exclusivo del paciente. No se automedique. Consulte a su médico ante cualquier reacción adversa.
                    </div>
                    <p style="font-size:0.8rem; color:#aaa; margin-top:30px; border-top:1px solid #eee; padding-top:15px; text-align:center;">
                        Documento generado electrónicamente · ${new Date().toLocaleDateString('es-EC')}
                    </p>
                </div>
            `;
        },

        /**
         * Imprime una receta médica usando window.open (sistema limpio, sin sidebar).
         * @param {Object} receta - Objeto receta
         */
        imprimirReceta(receta) {
            const recetaHTML = this._generarRecetaHTML(receta);
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Imprimir Receta Médica</title>
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            background: #fff;
                            display: flex;
                            justify-content: center;
                            align-items: flex-start;
                        }
                        @media print {
                            @page { size: letter; margin: 0.5in; }
                        }
                    </style>
                </head>
                <body>
                    ${recetaHTML}
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                window.close();
                            }, 500);
                        }
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        },

        /**
         * Descarga un PDF de receta médica usando jsPDF nativo.
         * Control estricto del eje Y para iterar medicamentos sin superposición.
         * @param {Object} receta - Objeto receta con {medico, fecha, diagnostico[], medicamentos[]}
         */
        descargarPDFReceta(receta) {
            const medico = receta.medico || '—';
            const fechaFmt = receta.fecha
                ? receta.fecha.split('-').reverse().join('/')
                : '—';
            const diags = (receta.diagnostico || []).join(', ') || '—';

            try {
                const { jsPDF } = window.jspdf || window;
                const doc = new jsPDF('p', 'mm', 'letter');

                const pageWidth = 215.9;
                const pageHeight = 279.4;
                const margin = 20;
                const contentWidth = pageWidth - 2 * margin;
                let y = margin;

                // ── Encabezado ──
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(18);
                doc.setTextColor(59, 73, 163);
                doc.text('Centro Médico Familiar', pageWidth / 2, y, { align: 'center' });
                y += 9;

                doc.setFontSize(13);
                doc.setTextColor(13, 169, 159);
                doc.text('Dra. Verónica Barahona', pageWidth / 2, y, { align: 'center' });
                y += 6;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(85, 85, 85);
                doc.text('Pifo, Ignacio Jarrín y Tulio Garzón · Quito, Ecuador', pageWidth / 2, y, { align: 'center' });
                y += 4;
                doc.text('Tel: 099 890 8034', pageWidth / 2, y, { align: 'center' });
                y += 8;

                // Línea separadora
                doc.setDrawColor(13, 169, 159);
                doc.setLineWidth(0.5);
                doc.line(margin, y, pageWidth - margin, y);
                y += 7;

                // Título
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(15);
                doc.setTextColor(59, 73, 163);
                doc.text('RECETA MÉDICA', pageWidth / 2, y, { align: 'center' });
                y += 10;

                // ── Info de la receta ──
                doc.setFontSize(11);
                doc.setTextColor(33, 33, 33);
                doc.setFont('helvetica', 'bold');
                doc.text('Médico prescriptor:', margin, y);
                doc.setFont('helvetica', 'normal');
                doc.text(medico, margin + 43, y);
                y += 7;

                doc.setFont('helvetica', 'bold');
                doc.text('Fecha:', margin, y);
                doc.setFont('helvetica', 'normal');
                doc.text(fechaFmt, margin + 43, y);
                y += 7;

                doc.setFont('helvetica', 'bold');
                doc.text('Diagnóstico:', margin, y);
                doc.setFont('helvetica', 'normal');
                const diagLines = doc.splitTextToSize(diags, contentWidth - 43);
                doc.text(diagLines, margin + 43, y);
                y += diagLines.length * 5 + 5;

                // ── Tabla de medicamentos ──
                // Cabecera
                doc.setFillColor(59, 73, 163);
                doc.rect(margin, y, contentWidth, 8, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(255, 255, 255);

                const col1 = margin + 2;
                const col2 = margin + 10;
                const col3 = margin + 75;
                const col4 = margin + 140;
                const col5 = margin + 155;

                doc.text('#', col1, y + 5.5);
                doc.text('Medicamento', col2, y + 5.5);
                doc.text('Dosis / Indicación', col3, y + 5.5);
                doc.text('Cant.', col4, y + 5.5);
                doc.text('Vía', col5, y + 5.5);
                y += 10;

                // Filas de medicamentos — control estricto del eje Y
                doc.setTextColor(33, 33, 33);
                const meds = receta.medicamentos || [];
                meds.forEach((m, idx) => {
                    // Calcular altura necesaria para esta fila
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(9);
                    const nombreLines = doc.splitTextToSize(m.nombre || '', 62);
                    doc.setFont('helvetica', 'normal');
                    const dosisLines = doc.splitTextToSize(m.dosis || '', 62);
                    const maxLines = Math.max(nombreLines.length, dosisLines.length, 1);
                    const rowHeight = maxLines * 4.5 + 4;

                    // Salto de página si no cabe
                    if (y + rowHeight > pageHeight - 30) {
                        doc.addPage();
                        y = margin;
                    }

                    // Fondo alterno
                    if (idx % 2 === 0) {
                        doc.setFillColor(245, 245, 250);
                        doc.rect(margin, y, contentWidth, rowHeight, 'F');
                    }

                    const textY = y + 4.5;
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(9);
                    doc.text(String(idx + 1), col1, textY);

                    doc.setFont('helvetica', 'bold');
                    doc.text(nombreLines, col2, textY);

                    doc.setFont('helvetica', 'normal');
                    doc.text(dosisLines, col3, textY);
                    doc.text(String(m.cantidad || '—'), col4 + 3, textY);
                    doc.text(m.via || '—', col5, textY);

                    y += rowHeight;
                });

                y += 8;

                // ── Nota ──
                if (y + 25 > pageHeight - 20) {
                    doc.addPage();
                    y = margin;
                }
                doc.setFillColor(254, 249, 231);
                doc.rect(margin, y, contentWidth, 18, 'F');
                doc.setDrawColor(253, 173, 52);
                doc.setLineWidth(1.2);
                doc.line(margin, y, margin, y + 18);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(196, 127, 10);
                doc.text('Importante:', margin + 5, y + 5);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(102, 102, 102);
                const nota = doc.splitTextToSize(
                    'Esta receta es de uso exclusivo del paciente. No se automedique. Consulte a su médico ante cualquier reacción adversa.',
                    contentWidth - 10
                );
                doc.text(nota, margin + 5, y + 10);
                y += 24;

                // ── Pie ──
                doc.setFontSize(8);
                doc.setTextColor(170);
                doc.text(`Documento generado electrónicamente · ${new Date().toLocaleDateString('es-EC')}`, pageWidth / 2, y + 5, { align: 'center' });

                doc.save('Receta_Medica.pdf');
            } catch (e) {
                console.error('Error al generar PDF de receta:', e);
                alert('Error al generar PDF. Asegúrate de que la librería jsPDF esté cargada.');
            }
        }
};
