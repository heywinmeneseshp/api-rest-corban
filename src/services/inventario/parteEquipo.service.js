import { Op } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { Equipo, ParteEquipo, ParteEquipoRegistro, User } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';

// Partes y accesorios con serie de un equipo: baterías, control remoto, cargadores, antenas... Cada una se identifica con un código interno («Batería 01») y
// su serie, lleva sus ciclos y novedades, y se puede asignar a una aeronave o moverse a otra (así se evita usarlas «indistintamente» sin trazabilidad).
export const TIPOS_PARTE = ['BATERIA', 'CONTROL_REMOTO', 'CARGADOR', 'ANTENA', 'OTRO'];
export const ESTADOS_PARTE = ['ACTIVA', 'EN_REVISION', 'RETIRADA'];
export const TIPOS_REGISTRO = ['CICLOS', 'NOVEDAD', 'MANTENIMIENTO', 'ASIGNACION'];

const num = (v) => (v === null || v === undefined ? null : Number(v));

const publica = (p, ultimo = null) => ({
  uuid: p.uuid,
  tipo: p.tipo,
  codigo: p.codigo,
  serie: p.serie,
  descripcion: p.descripcion,
  estado: p.estado,
  ciclos: num(p.ciclos) ?? 0,
  observaciones: p.observaciones,
  equipo: p.equipo ? { uuid: p.equipo.uuid, codigo: p.equipo.codigo, nombre: p.equipo.nombre } : null,
  ultimoRegistro: ultimo ? { tipo: ultimo.tipo, fechaHora: ultimo.fechaHora, descripcion: ultimo.descripcion } : null,
});

const incluirEquipo = [{ model: Equipo, as: 'equipo', attributes: ['uuid', 'codigo', 'nombre'] }];

async function buscarEquipo(uuid) {
  const e = await Equipo.findOne({ where: { uuid }, attributes: ['id', 'uuid', 'codigo', 'nombre'] });
  if (!e) throw ApiError.notFound('Equipo no encontrado');
  return e;
}

async function buscarParte(uuid, transaction) {
  const p = await ParteEquipo.findOne({ where: { uuid }, include: incluirEquipo, transaction });
  if (!p) throw ApiError.notFound('Parte no encontrada');
  return p;
}

async function validarCodigo(codigo, exceptoId = null) {
  const otra = await ParteEquipo.findOne({ where: { codigo }, attributes: ['id'] });
  if (otra && otra.id !== exceptoId) throw ApiError.conflict(`Ya existe una parte con el código «${codigo}»`);
}

async function ultimosRegistros(partes) {
  if (partes.length === 0) return new Map();
  const filas = await ParteEquipoRegistro.findAll({ where: { parteId: { [Op.in]: partes.map((p) => p.id) } }, order: [['fechaHora', 'DESC'], ['id', 'DESC']] });
  const mapa = new Map();
  for (const f of filas) if (!mapa.has(f.parteId)) mapa.set(f.parteId, f);
  return mapa;
}

export const parteEquipoService = {
  // Partes asignadas al equipo y partes libres (sin equipo) que se pueden asignar.
  async listar(equipoUuid) {
    const equipo = await buscarEquipo(equipoUuid);
    const asignadas = await ParteEquipo.findAll({ where: { equipoId: equipo.id }, include: incluirEquipo, order: [['tipo', 'ASC'], ['codigo', 'ASC']] });
    const libres = await ParteEquipo.findAll({ where: { equipoId: null, estado: { [Op.ne]: 'RETIRADA' } }, include: incluirEquipo, order: [['tipo', 'ASC'], ['codigo', 'ASC']] });
    const ult = await ultimosRegistros([...asignadas, ...libres]);
    return { asignadas: asignadas.map((p) => publica(p, ult.get(p.id))), libres: libres.map((p) => publica(p, ult.get(p.id))) };
  },

  async crear(equipoUuid, datos, user) {
    const equipo = equipoUuid ? await buscarEquipo(equipoUuid) : null;
    const codigo = String(datos.codigo).trim();
    await validarCodigo(codigo);
    const parte = await sequelize.transaction(async (transaction) => {
      const p = await ParteEquipo.create(
        {
          equipoId: equipo?.id ?? null,
          tipo: TIPOS_PARTE.includes(datos.tipo) ? datos.tipo : 'OTRO',
          codigo,
          serie: datos.serie ? String(datos.serie).trim() : null,
          descripcion: datos.descripcion ? String(datos.descripcion).trim() : null,
          estado: ESTADOS_PARTE.includes(datos.estado) ? datos.estado : 'ACTIVA',
          ciclos: Number(datos.ciclos) || 0,
          observaciones: datos.observaciones || null,
          createdBy: user?.id ?? null,
          updatedBy: user?.id ?? null,
        },
        { transaction },
      );
      if (equipo) await ParteEquipoRegistro.create({ parteId: p.id, tipo: 'ASIGNACION', fechaHora: new Date(), equipoId: equipo.id, descripcion: `Alta y asignación a ${equipo.codigo} ${equipo.nombre}`, usuarioId: user?.id ?? null }, { transaction });
      return p;
    });
    return publica(await buscarParte(parte.uuid));
  },

  async actualizar(parteUuid, datos, user) {
    const p = await buscarParte(parteUuid);
    const cambios = { updatedBy: user?.id ?? null };
    if (datos.codigo !== undefined) {
      const codigo = String(datos.codigo).trim();
      await validarCodigo(codigo, p.id);
      cambios.codigo = codigo;
    }
    if (datos.tipo !== undefined) {
      if (!TIPOS_PARTE.includes(datos.tipo)) throw ApiError.badRequest('Tipo de parte inválido');
      cambios.tipo = datos.tipo;
    }
    if (datos.estado !== undefined) {
      if (!ESTADOS_PARTE.includes(datos.estado)) throw ApiError.badRequest('Estado inválido');
      cambios.estado = datos.estado;
    }
    for (const campo of ['serie', 'descripcion', 'observaciones']) if (datos[campo] !== undefined) cambios[campo] = datos[campo] ? String(datos[campo]).trim() || null : null;
    await p.update(cambios);
    return publica(await buscarParte(parteUuid));
  },

  async eliminar(parteUuid) {
    const p = await buscarParte(parteUuid);
    await p.destroy();
  },

  // Registra un evento de la parte. CICLOS: `ciclos` es el NUEVO acumulado (no puede ser menor al actual). ASIGNACION: `equipoUuid` mueve la parte a ese
  // equipo (null la deja sin asignar). NOVEDAD y MANTENIMIENTO llevan su descripción.
  async registrar(parteUuid, datos, user) {
    if (!TIPOS_REGISTRO.includes(datos.tipo)) throw ApiError.badRequest('Tipo de registro inválido');
    await sequelize.transaction(async (transaction) => {
      const p = await buscarParte(parteUuid, transaction);
      const registro = { parteId: p.id, tipo: datos.tipo, fechaHora: datos.fechaHora ? new Date(datos.fechaHora) : new Date(), descripcion: datos.descripcion ? String(datos.descripcion).trim() : null, usuarioId: user?.id ?? null };
      if (datos.tipo === 'CICLOS') {
        const nuevo = Number(datos.ciclos);
        if (!Number.isFinite(nuevo) || nuevo < 0) throw ApiError.badRequest('Escribe los ciclos acumulados');
        if (nuevo < Number(p.ciclos)) throw ApiError.conflict(`Los ciclos (${nuevo}) son menos que los ya registrados (${Number(p.ciclos)})`);
        registro.ciclos = nuevo;
        await p.update({ ciclos: nuevo, updatedBy: user?.id ?? null }, { transaction });
      } else if (datos.tipo === 'ASIGNACION') {
        const destino = datos.equipoUuid ? await buscarEquipo(datos.equipoUuid) : null;
        registro.equipoId = destino?.id ?? null;
        registro.descripcion = registro.descripcion || (destino ? `Asignada a ${destino.codigo} ${destino.nombre}` : 'Quedó sin asignar');
        await p.update({ equipoId: destino?.id ?? null, updatedBy: user?.id ?? null }, { transaction });
      } else if (!registro.descripcion) {
        throw ApiError.badRequest('Describe la novedad o el mantenimiento');
      }
      await ParteEquipoRegistro.create(registro, { transaction });
    });
    return publica(await buscarParte(parteUuid));
  },

  async historial(parteUuid) {
    const p = await buscarParte(parteUuid);
    const filas = await ParteEquipoRegistro.findAll({
      where: { parteId: p.id },
      include: [{ model: User, as: 'usuario', attributes: ['usuario', 'nombre', 'apellido'] }],
      order: [['fechaHora', 'DESC'], ['id', 'DESC']],
      limit: 200,
    });
    return {
      parte: publica(p),
      items: filas.map((f) => ({ uuid: f.uuid, tipo: f.tipo, fechaHora: f.fechaHora, ciclos: num(f.ciclos), descripcion: f.descripcion, usuario: f.usuario ? `${f.usuario.nombre || ''} ${f.usuario.apellido || ''}`.trim() || f.usuario.usuario : null })),
    };
  },
};

export default parteEquipoService;
