const sharp = require('sharp');
const fs = require('fs');

// Asegurar que existe la carpeta de salida (opcional, puedes sobrescribir los PNG o crear otra)
const carpetaSalida = './webp'; // creará subcarpeta webp
if (!fs.existsSync(carpetaSalida)) fs.mkdirSync(carpetaSalida);

fs.readdirSync('./').forEach(archivo => {
  if (archivo.endsWith('.png')) {
    const nombreSalida = archivo.replace('.png', '.webp');
    sharp(archivo)
      .webp({ quality: 80 }) // calidad 80% – óptimo según rendimiento
      .toFile(`${carpetaSalida}/${nombreSalida}`)
      .then(() => console.log(`✅ Convertido: ${archivo} -> ${nombreSalida}`))
      .catch(err => console.error(`❌ Error con ${archivo}:`, err));
  }
});