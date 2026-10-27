// Verifica que cada permiso del sistema tenga exactamente un lugar en el catálogo de la matriz de permisos
// (src/constants/permisosCatalogo.js). Uso: npm run verificar:permisos
import { verificarCatalogo, describirProblemas } from '../src/constants/permisosCatalogo.check.js';
import { PERMISSIONS_SEED } from '../src/constants/permissions.constants.js';

const r = verificarCatalogo();
if (r.ok) {
  console.log(`Catálogo de permisos OK: ${PERMISSIONS_SEED.length} permisos, todos ubicados una sola vez.`);
} else {
  for (const linea of describirProblemas(r)) console.error(linea);
  process.exit(1);
}
