import { Op } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { EstacionMeteorologica, EstacionMeteorologicaFinca, Finca } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { cifrar, descifrar } from '../../utils/secretos.js';
import { weatherlinkClient } from './weatherlink.client.js';
import { limpiarCacheEstaciones, origenCredenciales } from './estacionCredenciales.service.js';

// Administración de las estaciones meteorológicas desde la web: alta, edición, baja, prueba de conexión y fincas que usan cada una. Las credenciales se
// guardan cifradas y NUNCA se devuelven: solo si existen, de dónde salen y los últimos 4 caracteres de la API key.
const SENSORES_EXTERIOR = [43, 50];

const ultimos4 = (clave) => (clave && clave.length > 4 ? `…${clave.slice(-4)}` : clave ? '…' : null);

function publica(e) {
  const apiKey = descifrar(e.apiKey);
  return {
    id: Number(e.id),
    uuid: e.uuid,
    nombre: e.nombre,
    stationId: e.stationId || null,
    estado: Boolean(e.estado),
    tieneCredenciales: Boolean(apiKey && descifrar(e.apiSecret) && e.stationId),
    origenCredenciales: origenCredenciales(e), // 'base' | 'entorno' | null
    apiKeyFin: ultimos4(apiKey),
    fincas: (e.asignaciones || []).map((a) => ({ uuid: a.finca?.uuid, nombre: a.finca?.nombre })).filter((f) => f.uuid).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  };
}

const incluir = [{ model: EstacionMeteorologicaFinca, as: 'asignaciones', include: [{ model: Finca, as: 'finca', attributes: ['uuid', 'nombre'] }] }];

async function buscar(id) {
  const e = await EstacionMeteorologica.findOne({ where: { id }, include: incluir });
  if (!e) throw ApiError.notFound('Estación no encontrada');
  return e;
}

const limpio = (v) => (typeof v === 'string' ? v.trim() : v);

export const estacionRegistroService = {
  async listar() {
    const filas = await EstacionMeteorologica.findAll({ include: incluir, order: [['id', 'ASC']] });
    return filas.map(publica);
  },

  async crear({ nombre, apiKey, apiSecret, stationId, estado = true }, actorId) {
    const e = await EstacionMeteorologica.create({
      nombre: limpio(nombre),
      apiKey: cifrar(limpio(apiKey)),
      apiSecret: cifrar(limpio(apiSecret)),
      stationId: limpio(stationId) || null,
      estado,
      createdBy: actorId ?? null,
      updatedBy: actorId ?? null,
    });
    limpiarCacheEstaciones();
    return publica(await buscar(e.id));
  },

  // Los secretos solo cambian si llegan con valor: un campo vacío conserva el guardado.
  async actualizar(id, { nombre, apiKey, apiSecret, stationId, estado }, actorId) {
    const e = await buscar(id);
    const datos = { updatedBy: actorId ?? null };
    if (nombre !== undefined) datos.nombre = limpio(nombre);
    if (stationId !== undefined) datos.stationId = limpio(stationId) || null;
    if (estado !== undefined) datos.estado = Boolean(estado);
    if (limpio(apiKey)) datos.apiKey = cifrar(limpio(apiKey));
    if (limpio(apiSecret)) datos.apiSecret = cifrar(limpio(apiSecret));
    await e.update(datos);
    limpiarCacheEstaciones();
    return publica(await buscar(id));
  },

  // Baja lógica: deja de aparecer y de sincronizarse. El histórico ya guardado en estacion_clima_diaria no se toca.
  async eliminar(id, actorId) {
    const e = await buscar(id);
    await sequelize.transaction(async (transaction) => {
      await EstacionMeteorologicaFinca.destroy({ where: { estacionId: e.id }, transaction });
      await e.update({ updatedBy: actorId ?? null }, { transaction });
      await e.destroy({ transaction });
    });
    limpiarCacheEstaciones();
    return { id: Number(id) };
  },

  // Fincas que usan esta estación para su temperatura y humedad. Una finca solo puede tener una estación: si ya estaba en otra, se mueve a esta.
  async asignarFincas(id, fincaUuids = []) {
    const e = await buscar(id);
    const fincas = fincaUuids.length ? await Finca.findAll({ where: { uuid: { [Op.in]: fincaUuids } }, attributes: ['id', 'uuid'] }) : [];
    if (fincas.length !== new Set(fincaUuids).size) throw ApiError.badRequest('Alguna finca no existe');
    await sequelize.transaction(async (transaction) => {
      await EstacionMeteorologicaFinca.destroy({ where: { estacionId: e.id }, transaction });
      if (fincas.length) {
        await EstacionMeteorologicaFinca.destroy({ where: { fincaId: { [Op.in]: fincas.map((f) => f.id) } }, transaction });
        await EstacionMeteorologicaFinca.bulkCreate(fincas.map((f) => ({ estacionId: e.id, fincaId: f.id })), { transaction });
      }
    });
    return publica(await buscar(id));
  },

  // Prueba las credenciales consultando las condiciones actuales en WeatherLink. Nunca lanza: devuelve { conectado, ... }.
  async probar(id) {
    const e = await buscar(id);
    try {
      const data = await weatherlinkClient.current(e.id);
      const sensor = data?.sensors?.find((s) => SENSORES_EXTERIOR.includes(s.sensor_type));
      const ts = sensor?.data?.[0]?.ts;
      return { conectado: true, ultimoDato: ts ? new Date(ts * 1000).toISOString() : null, sensorExterior: Boolean(sensor), detalle: sensor ? null : 'Conectó, pero la estación no reportó un sensor exterior' };
    } catch (err) {
      // El mensaje no debe filtrar credenciales.
      const secretos = [descifrar(e.apiKey), descifrar(e.apiSecret)].filter(Boolean);
      const mensaje = secretos.reduce((m, s) => m.split(s).join('***'), String(err.message || 'No se pudo conectar'));
      return { conectado: false, error: mensaje };
    }
  },
};

export default estacionRegistroService;
