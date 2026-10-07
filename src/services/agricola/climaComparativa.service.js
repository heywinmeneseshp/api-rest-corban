import { Op } from 'sequelize';
import { Finca, EstacionClimaDiaria, OpenMeteoClimaDiaria } from '../../database/associations.js';
import { getFincaIdsPermitidas } from '../../utils/fincaScope.js';

// Comparativas de clima (pestaña "Gráficas" de Estación Meteorológica): la
// estación WeatherLink y cada finca de Open-Meteo son "fuentes" con el mismo
// formato diario, para graficarlas juntas. Más estaciones a futuro = más
// fuentes de tipo 'estacion'.
const ESTACION_ID = 'estacion';
const ESTACION_NOMBRE = 'Estación Pantoja 01 Norte';
const PREFIJO_FINCA = 'finca:';

const num = (v) => (v === null || v === undefined ? null : Number(v));
const iso = (f) => (f instanceof Date ? f.toISOString().slice(0, 10) : String(f).slice(0, 10));

const normalizar = (r) => ({
  fecha: iso(r.fecha),
  mm: num(r.mm),
  temperatura: num(r.temperatura),
  temperaturaMaxima: num(r.temperaturaMaxima),
  temperaturaMinima: num(r.temperaturaMinima),
  humedadRelativa: num(r.humedadRelativa),
  vientoVelocidad: num(r.vientoVelocidad),
  vientoMax: num(r.vientoMax),
});

export const climaComparativaService = {
  // Fuentes disponibles: la estación y las fincas operativas con coordenadas.
  async fuentes(user) {
    const permitidas = user ? getFincaIdsPermitidas(user) : null;
    const where = { estado: true, esExterna: false, latitud: { [Op.ne]: null }, longitud: { [Op.ne]: null } };
    if (permitidas) where.id = { [Op.in]: permitidas };
    const fincas = await Finca.findAll({ where, attributes: ['uuid', 'codigo', 'nombre'], order: [['nombre', 'ASC']] });
    return [
      { id: ESTACION_ID, tipo: 'estacion', nombre: ESTACION_NOMBRE },
      ...fincas.map((f) => ({ id: `${PREFIJO_FINCA}${f.uuid}`, tipo: 'openmeteo', nombre: f.nombre, codigo: f.codigo })),
    ];
  },

  // Datos diarios de las fuentes pedidas en el rango: { fuente, ...fila }.
  async datos({ fuentes = [], fechaDesde, fechaHasta }, user) {
    const rango = {};
    if (fechaDesde) rango[Op.gte] = fechaDesde;
    if (fechaHasta) rango[Op.lte] = fechaHasta;
    const whereFecha = fechaDesde || fechaHasta ? { fecha: rango } : {};

    const items = [];
    if (fuentes.includes(ESTACION_ID)) {
      const rows = await EstacionClimaDiaria.findAll({ where: whereFecha, order: [['fecha', 'ASC']] });
      for (const r of rows) items.push({ fuente: ESTACION_ID, ...normalizar(r) });
    }

    const fincaUuids = fuentes.filter((f) => f.startsWith(PREFIJO_FINCA)).map((f) => f.slice(PREFIJO_FINCA.length));
    if (fincaUuids.length) {
      const permitidas = user ? getFincaIdsPermitidas(user) : null;
      const whereFinca = { uuid: { [Op.in]: fincaUuids } };
      if (permitidas) whereFinca.id = { [Op.in]: permitidas };
      const rows = await OpenMeteoClimaDiaria.findAll({
        where: whereFecha,
        include: [{ model: Finca, as: 'finca', where: whereFinca, attributes: ['uuid'] }],
        order: [['fecha', 'ASC']],
      });
      for (const r of rows) items.push({ fuente: `${PREFIJO_FINCA}${r.finca.uuid}`, ...normalizar(r) });
    }
    return items;
  },
};

export default climaComparativaService;
