const sharp = require('sharp');
const fs = require('fs');

// Lista de archivos a convertir (solo los 5 nuevos)
const archivos = [
  'yolanda-antonela-sanchez-barahona.png',
  'maria-silvia-ruiz-medina.png',
  'patricia-maria-sanchez-guerrero.png',
  'lucia-maria-silva-cruz.png',
  'victor-hugo-fernandez-soto.png'
];

archivos.forEach(archivo => {
  if (fs.existsSync(archivo)) {
    const nombreSalida = archivo.replace('.png', '.webp');
    sharp(archivo)
      .webp({ quality: 80 })
      .toFile(nombreSalida)
      .then(() => console.log(`✅ Convertido: ${archivo} -> ${nombreSalida}`))
      .catch(err => console.error(`❌ Error con ${archivo}:`, err));
  } else {
    console.log(`⚠️ No se encontró ${archivo}`);
  }
});