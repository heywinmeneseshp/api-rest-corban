import { Op } from 'sequelize';
import { Finca } from '../../database/associations.js';
import { PrecalibracionConfig } from '../../database/models/precalibracionConfig.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { assertFincaPermitida, getFincaIdsPermitidas } from '../../utils/fincaScope.js';

// Valores por defecto cuando aún no hay configuración guardada.
export const EDADES_POR_DEFECTO = [9, 10, 11, 12];
export const VALORES_POR_DEFECTO = ['32', '34', '36'];
export const SEGUNDOS_ESPERA_POR_DEFECTO = 10;
export const MODALIDAD_POR_DEFECTO = 'VIGENTE';

const ordenNumerico = (a, b) => a - b;
const normalizarJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

// Carga toda la configuración: la global y las de cada finca que la personaliza.
export async function cargarConfig() {
  const filas = await PrecalibracionConfig.findAll({ raw: true });
  let global = { edades: EDADES_POR_DEFECTO, valores: VALORES_POR_DEFECTO, segundosEspera: SEGUNDOS_ESPERA_POR_DEFECTO, modalidad: MODALIDAD_POR_DEFECTO };
  const porFincaId = new Map();
  for (const f of filas) {
    const cfg = { edades: normalizarJson(f.edades), valores: normalizarJson(f.valores), segundosEspera: f.segundosEspera ?? SEGUNDOS_ESPERA_POR_DEFECTO, modalidad: f.modalidad || MODALIDAD_POR_DEFECTO };
    if (f.fincaId === null) global = cfg;
    else porFincaId.set(f.fincaId, cfg);
  }
  return { global, porFincaId };
}

export const configDeFinca = (config, fincaId) => config.porFincaId.get(fincaId) || config.global;
export const edadesDeFinca = (config, fincaId) => configDeFinca(config, fincaId).edades;
export const modalidadDeFinca = (config, fincaId) => configDeFinca(config, fincaId).modalidad;
export const segundosEsperaDeFinca = (config, fincaId) => configDeFinca(config, fincaId).segundosEspera;
export const valoresDeFinca = (config, fincaId) => configDeFinca(config, fincaId).valores;

// Unión de edades/valores de las fincas del alcance (lista de ids): sirve para armar las columnas de una vista con varias
// fincas, cada una con su propia configuración (una finca sin personalizar usa la global).
export function unionEdades(config, fincaIds) {
  if (!fincaIds || fincaIds.length === 0) return [...config.global.edades].sort(ordenNumerico);
  const set = new Set();
  for (const id of fincaIds) edadesDeFinca(config, id).forEach((e) => set.add(e));
  return [...set].sort(ordenNumerico);
}

export function unionValores(config, fincaIds) {
  if (!fincaIds || fincaIds.length === 0) return [...config.global.valores];
  const set = new Set();
  for (const id of fincaIds) valoresDeFinca(config, id).forEach((v) => set.add(v));
  return [...set].sort((a, b) => Number(a) - Number(b));
}

export const precalibracionConfigService = {
  // Pantalla de configuración: la global y cada finca (con su configuración efectiva y si es personalizada).
  async getConfiguracion(user) {
    const config = await cargarConfig();
    const fincaIds = getFincaIdsPermitidas(user);
    const fincas = await Finca.findAll({
      where: fincaIds ? { id: { [Op.in]: fincaIds } } : {},
      attributes: ['id', 'uuid', 'nombre'],
      order: [['nombre', 'ASC']],
    });
    return {
      global: config.global,
      fincas: fincas.map((f) => {
        const propia = config.porFincaId.get(f.id);
        const efectiva = propia || config.global;
        return { id: f.uuid, nombre: f.nombre, personalizada: Boolean(propia), edades: efectiva.edades, valores: efectiva.valores, segundosEspera: efectiva.segundosEspera, modalidad: efectiva.modalidad };
      }),
    };
  },

  // Guarda la configuración global (fincaUuid null) o la de una finca.
  async guardar({ fincaUuid, edades, valores, segundosEspera, modalidad }, actorId, user) {
    let fincaId = null;
    if (fincaUuid) {
      const finca = await Finca.findOne({ where: { uuid: fincaUuid }, attributes: ['id'] });
      if (!finca) throw ApiError.badRequest('Finca no encontrada');
      assertFincaPermitida(user, finca.id);
      fincaId = finca.id;
    }
    const datos = {
      edades: [...new Set(edades.map(Number))].sort(ordenNumerico),
      valores: [...new Set(valores.map((v) => String(v).trim()))].filter(Boolean),
      segundosEspera: segundosEspera ?? SEGUNDOS_ESPERA_POR_DEFECTO,
      modalidad: modalidad || MODALIDAD_POR_DEFECTO,
      updatedBy: actorId,
    };
    const existente = await PrecalibracionConfig.findOne({ where: { fincaId } });
    if (existente) await existente.update(datos);
    else await PrecalibracionConfig.create({ ...datos, fincaId, createdBy: actorId });
    return { fincaUuid: fincaUuid || null, edades: datos.edades, valores: datos.valores, segundosEspera: datos.segundosEspera, modalidad: datos.modalidad };
  },

  // La finca vuelve a usar la configuración global.
  async restablecerFinca(fincaUuid, user) {
    const finca = await Finca.findOne({ where: { uuid: fincaUuid }, attributes: ['id'] });
    if (!finca) throw ApiError.badRequest('Finca no encontrada');
    assertFincaPermitida(user, finca.id);
    await PrecalibracionConfig.destroy({ where: { fincaId: finca.id } });
  },
};

export default precalibracionConfigService;
