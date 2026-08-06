import { fincaRepository } from '../../repositories/agricola/finca.repository.js';
import { GrupoFinca } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { logger } from '../../utils/logger.js';
import { configuracionService } from '../sistema/configuracion.service.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';
import { getFincaIdsPermitidas, expandirFincaIds } from '../../utils/fincaScope.js';
import { ROLES } from '../../constants/roles.constants.js';

// `grupoFincaUuid` es opcional y puede venir como `null` explícito (para
// desagrupar). `undefined` significa "no tocar el campo".
const resolverGrupoFincaId = async (grupoFincaUuid) => {
  if (grupoFincaUuid === undefined) return undefined;
  if (grupoFincaUuid === null) return null;
  const grupo = await GrupoFinca.findOne({ where: { uuid: grupoFincaUuid } });
  if (!grupo) throw ApiError.notFound('Grupo de finca no encontrado');
  return grupo.id;
};

const parseEstado = (value) => {
  if (value === undefined || value === '' || value === null) return true;
  const v = String(value).trim().toLowerCase();
  return !['false', '0', 'no', 'inactivo', 'inactive'].includes(v);
};

export const fincaService = {
  async listFincas(query, user) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await fincaRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      fincaIdsPermitidas: getFincaIdsPermitidas(user),
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  // `user` opcional: si se da y el usuario tiene restricción de fincas, se
  // trata una finca fuera de su alcance como si no existiera (404), para no
  // revelar qué fincas existen fuera de lo que tiene asignado.
  async getFincaByUuid(uuid, user) {
    const finca = await fincaRepository.findByUuid(uuid);
    if (!finca) throw ApiError.notFound('Finca no encontrada');
    const permitidas = getFincaIdsPermitidas(user);
    if (permitidas !== null && !permitidas.includes(finca.id)) {
      throw ApiError.notFound('Finca no encontrada');
    }
    return finca;
  },

  async createFinca(payload, actorId) {
    const existing = await fincaRepository.findByCodigo(payload.codigo);
    if (existing) throw ApiError.conflict('Ya existe una finca con ese código');

    return fincaRepository.create({
      codigo: payload.codigo,
      nombre: payload.nombre,
      estado: payload.estado ?? true,
      grupoFincaId: await resolverGrupoFincaId(payload.grupoFincaUuid),
      createdBy: actorId,
    });
  },

  async updateFinca(uuid, payload, actorId, user) {
    const finca = await this.getFincaByUuid(uuid, user);

    if (payload.codigo) {
      const existing = await fincaRepository.findByCodigo(payload.codigo);
      if (existing && existing.id !== finca.id) {
        throw ApiError.conflict('Ya existe una finca con ese código');
      }
    }

    const { grupoFincaUuid, ...resto } = payload;
    const data = { ...resto, updatedBy: actorId };
    const grupoFincaId = await resolverGrupoFincaId(grupoFincaUuid);
    if (grupoFincaId !== undefined) data.grupoFincaId = grupoFincaId;

    return fincaRepository.update(finca, data);
  },

  async deleteFinca(uuid, actorId, user) {
    const finca = await this.getFincaByUuid(uuid, user);
    await fincaRepository.softDelete(finca, actorId);
  },

  // Trae los lotes de la finca pedida y, SOLO si `incluirGrupo` viene en
  // true, también los de sus fincas hermanas de Grupo de Finca (ver
  // utils/fincaScope.js). Opt-in explícito: la app móvil sincroniza sus
  // lotes locales finca-por-finca asumiendo que esta respuesta nunca trae
  // lotes de otra finca (ver app-movil/src/services/sync.service.ts) — traer
  // el grupo completo por defecto le rompería la sincronización.
  async listLotes(uuid, query, user) {
    const finca = await this.getFincaByUuid(uuid, user);
    const { page, limit, offset } = getPagination(query);
    // "Ver eliminados" solo aplica si de verdad es Administrador — para
    // cualquier otro rol el parámetro se ignora en silencio, no hace falta
    // devolver un error por pedir algo que no le corresponde.
    const esAdministrador = (user?.roles || []).includes(ROLES.ADMINISTRADOR);
    const incluirEliminados = esAdministrador && query.incluirEliminados === true;
    const fincaIds = query.incluirGrupo === true ? await expandirFincaIds([finca.id]) : [finca.id];
    const { rows, count } = await fincaRepository.findLotesByFincaIds(fincaIds, {
      limit,
      offset,
      incluirEliminados,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  // Consulta los almacenes ACTIVOS de api-rest-banarica (sin escribir nada),
  // para que el usuario elija cuáles sincronizar. banarica no tiene un campo
  // `estado`/`activo`: usa `isBlock` (bloqueado) como bandera inversa, así
  // que "activo" = !isBlock.
  async fetchActiveBanaricaAlmacenes() {
    const baseUrl = await configuracionService.getBanaricaApiUrl();
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/almacenes/`;
    let almacenes;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      almacenes = await response.json();
    } catch (error) {
      logger.error('Error al consultar almacenes de banarica', { message: error.message });
      throw ApiError.internal('No se pudo consultar el API de banarica para sincronizar almacenes');
    }

    if (!Array.isArray(almacenes)) {
      throw ApiError.internal('Respuesta inesperada del API de banarica al listar almacenes');
    }

    return almacenes.filter((a) => !a.isBlock);
  },

  // Vista previa: lista los almacenes activos de banarica indicando si cada
  // uno ya existe como finca en corbana, para que el usuario elija cuáles
  // sincronizar antes de escribir nada.
  async previewBanaricaAlmacenes() {
    const activos = await this.fetchActiveBanaricaAlmacenes();

    const items = await Promise.all(
      activos.map(async (almacen) => {
        const codigo = String(almacen.consecutivo);
        const existing = await fincaRepository.findByCodigo(codigo);
        return {
          consecutivo: codigo,
          nombre: almacen.nombre || codigo,
          yaSincronizado: Boolean(existing),
        };
      }),
    );

    return { items };
  },

  // Sincroniza como fincas de corbana solo los almacenes de banarica cuyos
  // `consecutivo` vengan en `consecutivos` (elegidos por el usuario en el
  // paso de vista previa). El `consecutivo` se usa como `codigo` de la
  // finca para poder emparejar registros en re-sincronizaciones.
  async syncFromBanarica(actorId, consecutivos) {
    if (!Array.isArray(consecutivos) || consecutivos.length === 0) {
      throw ApiError.badRequest('Debes indicar al menos un almacén a sincronizar');
    }

    const activos = await this.fetchActiveBanaricaAlmacenes();
    const seleccionados = new Set(consecutivos.map(String));
    const almacenesElegidos = activos.filter((a) => seleccionados.has(String(a.consecutivo)));

    let creados = 0;
    let actualizados = 0;
    let restaurados = 0;

    for (const almacen of almacenesElegidos) {
      const codigo = String(almacen.consecutivo);
      const nombre = almacen.nombre || codigo;
      // Se busca incluyendo eliminados: el UNIQUE de `codigo` en la BD no
      // distingue soft-deletes, así que si ya existe (aunque esté borrada)
      // hay que restaurarla/actualizarla en vez de intentar crear otra.
      const existing = await fincaRepository.findByCodigoIncludingDeleted(codigo);

      if (existing && existing.deletedAt) {
        await fincaRepository.restore(existing);
        await fincaRepository.update(existing, { nombre, estado: true, updatedBy: actorId });
        restaurados += 1;
      } else if (existing) {
        await fincaRepository.update(existing, { nombre, estado: true, updatedBy: actorId });
        actualizados += 1;
      } else {
        await fincaRepository.create({ codigo, nombre, estado: true, createdBy: actorId });
        creados += 1;
      }
    }

    return {
      totalSeleccionados: almacenesElegidos.length,
      fincasCreadas: creados,
      fincasActualizadas: actualizados,
      fincasRestauradas: restaurados,
    };
  },

  // Cargue masivo de fincas desde un archivo .csv/.xlsx. Columnas esperadas
  // (encabezados, sin importar mayúsculas/acentos): codigo, nombre, estado
  // (opcional; por defecto activo). Sin dependencias entre filas: se valida
  // todo primero y se escribe en un solo bulkCreate con upsert (INSERT ...
  // ON DUPLICATE KEY UPDATE sobre el código), que de paso restaura las que
  // estaban eliminadas lógicamente.
  async bulkCreateFincas(file, actorId, { dryRun = false } = {}) {
    const rows = parseBulkFile(file);
    if (rows.length === 0) throw ApiError.badRequest('El archivo no tiene filas para procesar');

    const errores = [];
    const filasValidas = [];

    for (let i = 0; i < rows.length; i += 1) {
      const fila = i + 2; // +2: fila 1 son encabezados, y es 1-indexed para el usuario
      const row = rows[i];
      const codigo = String(row.codigo || '').trim();
      const nombre = String(row.nombre || '').trim();

      if (!codigo || !nombre) {
        errores.push({ fila, mensaje: 'Faltan las columnas requeridas: codigo y/o nombre' });
        continue;
      }

      filasValidas.push({ codigo, nombre, estado: parseEstado(row.estado) });
    }

    // Si el mismo código aparece varias veces en el archivo, se procesa una
    // sola vez con los valores de su última aparición.
    const porCodigo = new Map();
    for (const f of filasValidas) porCodigo.set(f.codigo, f);
    const filasUnicas = [...porCodigo.values()];

    const codigos = filasUnicas.map((f) => f.codigo);
    const existentes = codigos.length ? await fincaRepository.findByCodigosIncludingDeleted(codigos) : [];
    const existentesPorCodigo = new Map(existentes.map((f) => [f.codigo, f]));

    let creados = 0;
    let actualizados = 0;
    let restaurados = 0;
    for (const f of filasUnicas) {
      const existente = existentesPorCodigo.get(f.codigo);
      if (existente?.deletedAt) restaurados += 1;
      else if (existente) actualizados += 1;
      else creados += 1;
    }

    if (!dryRun && filasUnicas.length > 0) {
      await fincaRepository.bulkUpsert(
        filasUnicas.map((f) => ({
          codigo: f.codigo,
          nombre: f.nombre,
          estado: f.estado,
          deletedAt: null,
          deletedBy: null,
          createdBy: actorId,
          updatedBy: actorId,
        })),
      );
    }

    return {
      totalFilas: rows.length,
      fincasCreadas: creados,
      fincasActualizadas: actualizados,
      fincasRestauradas: restaurados,
      errores,
    };
  },
};

export default fincaService;
