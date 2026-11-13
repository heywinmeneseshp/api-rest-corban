import crypto from 'node:crypto';

// Cifrado de secretos guardados en la base (credenciales de integraciones, p. ej. las estaciones WeatherLink): AES-256-GCM con una clave que sale de
// `SECRETOS_CLAVE` (o, si no existe, de `JWT_SECRET`). Formato: `enc:v1:` + base64(iv[12] | tag[16] | cifrado). Si la clave cambia, lo cifrado
// con la anterior ya no se puede leer y hay que volver a escribirlo.
const PREFIJO = 'enc:v1:';

function clave() {
  const base = process.env.SECRETOS_CLAVE || process.env.JWT_SECRET;
  if (!base) throw new Error('Falta SECRETOS_CLAVE (o JWT_SECRET) para cifrar credenciales');
  return crypto.createHash('sha256').update(String(base)).digest();
}

export const estaCifrado = (valor) => typeof valor === 'string' && valor.startsWith(PREFIJO);

export function cifrar(texto) {
  if (texto === null || texto === undefined || texto === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', clave(), iv);
  const cifrado = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()]);
  return PREFIJO + Buffer.concat([iv, cipher.getAuthTag(), cifrado]).toString('base64');
}

// Devuelve el texto original; null si no hay valor o si no se puede descifrar (clave distinta o dato dañado).
export function descifrar(valor) {
  if (!valor) return null;
  if (!estaCifrado(valor)) return String(valor); // valor antiguo sin cifrar
  try {
    const bruto = Buffer.from(valor.slice(PREFIJO.length), 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', clave(), bruto.subarray(0, 12));
    decipher.setAuthTag(bruto.subarray(12, 28));
    return Buffer.concat([decipher.update(bruto.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
