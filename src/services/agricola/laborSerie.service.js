import { Op } from 'sequelize';
import { Lote, Finca } from '../../database/associations.js';
import { laborSerieRepository } from '../../repositories/agricola/laborSerie.repository.js';
import { laborOcurrenciaRepository } from '../../repositories/agricola/laborOcurrencia.repository.js';
import { laborRepository } from '../../repositories/agricola/labor.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { assertFincaPermitida } from '../../utils/fincaScope.js';
import { generarFechas, expandirPorLote } from '../../utils/recurrencia.js';
import { sequelize } from '../../database/connection.js';

const findFincaOrFail = async (uuid) => {
  const finca = await Finca.findOne({ where: { uuid } });
  if (!finca) throw ApiError.notFound('Finca no encontrada');
  return finca;
};

const findLoteOrFail = async (uuid, fincaId) => {
  const lote = await Lote.findOne({ where: { uuid } });
  if (!lote) throw ApiError.notFound('Lote no encontrado');
  if (lote.fincaId !== fincaId) throw ApiError.badRequest('El lote no pertenece a la finca seleccionada');
  return lote;
};

// Resuelve varios lotes preservando el orden en que vinieron los uuids (el
// orden importa en modo_lotes=ROTACION).
const findLotesOrFail = async (uuids, fincaId) => {
  const lotes = await Lote.findAll({ where: { uuid: { [Op.in]: uuids } } });
  if (lotes.length !== uuids.length) throw ApiError.notFound('Alguno de los lotes indicados no existe');
  if (lotes.some((l) => l.fincaId !== fincaId)) {
    throw ApiError.badRequest('Todos los lotes deben pertenecer a la finca seleccionada');
  }
  const porUuid = new Map(lotes.map((l) => [l.uuid, l]));
  return uuids.map((u) => porUuid.get(u));
};

export const laborSerieService = {
  async crearSerie(payload, actorId, user) {
    const labor = await laborRepository.findByUuid(payload.laborUuid);
    if (!labor) throw ApiError.notFound('Labor no encontrada');

    const finca = await findFincaOrFail(payload.fincaUuid);
    assertFincaPermitida(user, finca.id);

    let loteId = null;
    let lotes = [];
    if (payload.modoLotes === 'UNICO') {
      const lote = await findLoteOrFail(payload.loteUuid, finca.id);
      loteId = lote.id;
    } else {
      lotes = await findLotesOrFail(payload.loteUuids, finca.id);
    }

    const fechas = generarFechas({
      fechaInicio: payload.fechaInicio,
      esRecurrente: payload.esRecurrente,
      frecuencia: payload.frecuencia,
      intervalo: payload.intervalo,
      fechaFin: payload.fechaFin,
      numRepeticiones: payload.numRepeticiones,
    });

    const ocurrenciasPorLote = expandirPorLote(fechas, {
      modoLotes: payload.modoLotes,
      loteId,
      lotes: lotes.map((l) => l.id),
    });

    return sequelize.transaction(async (transaction) => {
      const serie = await laborSerieRepository.create(
        {
          laborId: labor.id,
          fincaId: finca.id,
          modoLotes: payload.modoLotes,
          loteId,
          fechaInicio: payload.fechaInicio,
          hora: payload.hora,
          duracionMinutos: payload.duracionMinutos,
          numeroColaboradores: payload.numeroColaboradores,
          observaciones: payload.observaciones,
          esRecurrente: payload.esRecurrente,
          frecuencia: payload.esRecurrente ? payload.frecuencia : null,
          intervalo: payload.intervalo ?? 1,
          fechaFin: payload.esRecurrente ? payload.fechaFin : null,
          numRepeticiones: payload.esRecurrente ? payload.numRepeticiones : null,
          createdBy: actorId,
        },
        { transaction },
      );

      if (payload.modoLotes !== 'UNICO') {
        await laborSerieRepository.createLotesRotacion(serie.id, lotes.map((l) => l.id), { transaction });
      }

      await laborOcurrenciaRepository.bulkCreate(
        ocurrenciasPorLote.map(({ fecha, loteId: loteOcurrenciaId }) => ({
          serieId: serie.id,
          fecha,
          hora: payload.hora,
          duracionMinutos: payload.duracionMinutos,
          fincaId: finca.id,
          loteId: loteOcurrenciaId,
          laborId: labor.id,
          numeroColaboradores: payload.numeroColaboradores,
          observaciones: payload.observaciones,
          createdBy: actorId,
        })),
        { transaction },
      );

      return { serie, totalOcurrencias: ocurrenciasPorLote.length };
    });
  },

  async getSerieByUuid(uuid, user) {
    const serie = await laborSerieRepository.findByUuid(uuid);
    if (!serie) throw ApiError.notFound('Programación no encontrada');
    assertFincaPermitida(user, serie.fincaId);
    return serie;
  },

  // Elimina la serie completa: las ocurrencias ya COMPLETADAs quedan como
  // histórico, solo se borran (lógicamente) las que seguían PROGRAMADAs.
  async deleteSerie(uuid, actorId, user) {
    const serie = await this.getSerieByUuid(uuid, user);
    return sequelize.transaction(async (transaction) => {
      await laborOcurrenciaRepository.softDeleteProgramadasPorSerie(serie.id, actorId, { transaction });
      await laborSerieRepository.softDelete(serie, actorId, { transaction });
    });
  },

  // "Toda la serie": aplica los mismos valores nuevos a la serie y a todas
  // sus ocurrencias que todavía no se ejecutaron (COMPLETADA/CANCELADA no se
  // tocan). No permite mover fechas ni cambiar la regla de recurrencia — eso
  // es "esta y las siguientes".
  async editarSerieCompleta(ocurrencia, payload, actorId, user) {
    const serie = ocurrencia.serie;
    if (!serie) throw ApiError.notFound('Programación no encontrada');
    assertFincaPermitida(user, serie.fincaId);

    const cambios = {};
    if (payload.laborUuid) {
      const labor = await laborRepository.findByUuid(payload.laborUuid);
      if (!labor) throw ApiError.notFound('Labor no encontrada');
      cambios.laborId = labor.id;
    }
    if (payload.numeroColaboradores !== undefined) {
      cambios.numeroColaboradores = payload.numeroColaboradores;
    }
    if (payload.hora !== undefined) cambios.hora = payload.hora || null;
    if (payload.duracionMinutos !== undefined) cambios.duracionMinutos = payload.duracionMinutos;
    if (payload.observaciones !== undefined) cambios.observaciones = payload.observaciones || null;

    return sequelize.transaction(async (transaction) => {
      await laborSerieRepository.update(serie, { ...cambios, updatedBy: actorId }, { transaction });
      if (Object.keys(cambios).length > 0) {
        await laborOcurrenciaRepository.updateProgramadasPorSerie(serie.id, cambios, { transaction });
      }
      return serie;
    });
  },

  // "Esta y las siguientes": divide la serie en el punto de esta ocurrencia.
  // La serie original deja de proyectarse desde esta fecha (sus futuras
  // ocurrencias PROGRAMADAs se eliminan lógicamente) y se crea una serie
  // nueva, con la misma recurrencia, que arranca aquí con los valores
  // editados.
  //
  // Simplificaciones de esta fase: solo aplica a series modo_lotes=UNICO
  // (dividir una rotación/simultáneo requeriría decidir qué lote(s) sigue la
  // nueva serie) y no reconstruye cuántas repeticiones quedaban pendientes —
  // la nueva serie hereda la fecha_fin de la original si la tenía, o si no,
  // el horizonte por defecto del motor de recurrencia.
  async editarEstaYSiguientes(ocurrencia, payload, actorId, user) {
    const serieOriginal = ocurrencia.serie;
    if (!serieOriginal) throw ApiError.notFound('Programación no encontrada');
    if (!serieOriginal.esRecurrente) throw ApiError.badRequest('Esta programación no es recurrente');
    if (serieOriginal.modoLotes !== 'UNICO') {
      throw ApiError.badRequest('No se puede dividir una programación con rotación o varios lotes a la vez');
    }
    assertFincaPermitida(user, serieOriginal.fincaId);

    const fechaNueva = payload.fecha || ocurrencia.fecha;
    let laborId = ocurrencia.laborId;
    if (payload.laborUuid) {
      const labor = await laborRepository.findByUuid(payload.laborUuid);
      if (!labor) throw ApiError.notFound('Labor no encontrada');
      laborId = labor.id;
    }
    const numeroColaboradores =
      payload.numeroColaboradores !== undefined ? payload.numeroColaboradores : ocurrencia.numeroColaboradores;
    const hora = payload.hora !== undefined ? payload.hora || null : ocurrencia.hora;
    const duracionMinutos = payload.duracionMinutos !== undefined ? payload.duracionMinutos : ocurrencia.duracionMinutos;
    const observaciones = payload.observaciones !== undefined ? payload.observaciones || null : ocurrencia.observaciones;

    return sequelize.transaction(async (transaction) => {
      await laborOcurrenciaRepository.softDeleteProgramadasDesdeFecha(serieOriginal.id, ocurrencia.fecha, actorId, {
        transaction,
      });

      const nuevaSerie = await laborSerieRepository.create(
        {
          laborId,
          fincaId: serieOriginal.fincaId,
          modoLotes: 'UNICO',
          loteId: ocurrencia.loteId,
          fechaInicio: fechaNueva,
          hora,
          duracionMinutos,
          numeroColaboradores,
          observaciones,
          esRecurrente: true,
          frecuencia: serieOriginal.frecuencia,
          intervalo: serieOriginal.intervalo,
          fechaFin: serieOriginal.fechaFin,
          numRepeticiones: null,
          createdBy: actorId,
        },
        { transaction },
      );

      const fechas = generarFechas({
        fechaInicio: fechaNueva,
        esRecurrente: true,
        frecuencia: serieOriginal.frecuencia,
        intervalo: serieOriginal.intervalo,
        fechaFin: serieOriginal.fechaFin,
        numRepeticiones: null,
      });

      await laborOcurrenciaRepository.bulkCreate(
        fechas.map((fecha) => ({
          serieId: nuevaSerie.id,
          fecha,
          hora,
          duracionMinutos,
          fincaId: serieOriginal.fincaId,
          loteId: ocurrencia.loteId,
          laborId,
          numeroColaboradores,
          observaciones,
          createdBy: actorId,
        })),
        { transaction },
      );

      return { serie: nuevaSerie, totalOcurrencias: fechas.length };
    });
  },

  // "Eliminar esta y las siguientes": a diferencia de editar, no hace falta
  // crear ninguna serie nueva — solo se deja de proyectar la serie original
  // desde esta fecha en adelante.
  async eliminarEstaYSiguientes(ocurrencia, actorId, user) {
    const serie = ocurrencia.serie;
    if (!serie) throw ApiError.notFound('Programación no encontrada');
    if (!serie.esRecurrente) throw ApiError.badRequest('Esta programación no es recurrente');
    assertFincaPermitida(user, serie.fincaId);

    await sequelize.transaction((transaction) =>
      laborOcurrenciaRepository.softDeleteProgramadasDesdeFecha(serie.id, ocurrencia.fecha, actorId, { transaction }),
    );
  },
};

export default laborSerieService;
