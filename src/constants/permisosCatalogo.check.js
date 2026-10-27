import { PERMISSIONS_SEED } from './permissions.constants.js';
import { codigosDelCatalogo } from './permisosCatalogo.js';

// Candado del catálogo de permisos: cada permiso del sistema debe estar en el catálogo exactamente una vez, y el catálogo no
// puede nombrar permisos que no existen. Devuelve los problemas encontrados (vacío = todo bien).
export function verificarCatalogo() {
  const existentes = new Set(PERMISSIONS_SEED.map((p) => p.codigo));
  const enCatalogo = codigosDelCatalogo();
  const vistos = new Map();
  for (const c of enCatalogo) vistos.set(c, (vistos.get(c) || 0) + 1);

  const sinUbicar = [...existentes].filter((c) => !vistos.has(c));
  const duplicados = [...vistos].filter(([, n]) => n > 1).map(([c]) => c);
  const inexistentes = [...vistos.keys()].filter((c) => !existentes.has(c));
  return { sinUbicar, duplicados, inexistentes, ok: !sinUbicar.length && !duplicados.length && !inexistentes.length };
}

export function describirProblemas({ sinUbicar, duplicados, inexistentes }) {
  return [
    sinUbicar.length && `Permisos sin lugar en el catálogo (agrégalos a permisosCatalogo.js): ${sinUbicar.join(', ')}`,
    duplicados.length && `Permisos repetidos en el catálogo: ${duplicados.join(', ')}`,
    inexistentes.length && `El catálogo nombra permisos que no existen: ${inexistentes.join(', ')}`,
  ].filter(Boolean);
}
