const sharp = require('sharp');
const fs = require('fs');

const archivos = [
  'login.jpg',
  'olvidarpassword.jpg'
];

archivos.forEach(archivo => {
  if (fs.existsSync(archivo)) {
    const nombreSalida = archivo.replace('.jpg', '.webp');
    sharp(archivo)
      .webp({ quality: 80 })
      .toFile(nombreSalida)
      .then(() => console.log(`✅ Convertido: ${archivo} -> ${nombreSalida}`))
      .catch(err => console.error(`❌ Error con ${archivo}:`, err));
  } else {
    console.log(`⚠️ No se encontró ${archivo}`);
  }
});