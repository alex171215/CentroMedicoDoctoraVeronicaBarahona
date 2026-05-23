const sharp = require('sharp');
const fs = require('fs');

// Lista de archivos a convertir (tal como están escritos, con sus extensiones)
const archivos = [
  'dermatologia.jpg',
  'endocrinologia.jpeg',
  'enfermeria.jpeg',
  'ginecologia.jpg',
  'laboratorio.jpeg',
  'medicina-familiar.jpeg',
  'medicina-general.jpeg',
  'odontologia.jpg',
  'psicologia.jpeg',
  'radiodiagnostico.jpeg',
  'traumatologia.jpeg',
  'urologia.jpeg'
];

// Crear carpeta de salida (opcional, pero ordenado)
const carpetaSalida = './webp';
if (!fs.existsSync(carpetaSalida)) fs.mkdirSync(carpetaSalida);

archivos.forEach(archivo => {
  if (fs.existsSync(archivo)) {
    // Generar nombre de salida cambiando .jpg/.jpeg por .webp
    const nombreSalida = archivo.replace(/\.(jpe?g)$/i, '.webp');
    const rutaSalida = `${carpetaSalida}/${nombreSalida}`;
    
    sharp(archivo)
      .webp({ quality: 80 })
      .toFile(rutaSalida)
      .then(() => console.log(`✅ Convertido: ${archivo} -> ${nombreSalida}`))
      .catch(err => console.error(`❌ Error con ${archivo}:`, err));
  } else {
    console.log(`⚠️ No se encontró ${archivo}`);
  }
});