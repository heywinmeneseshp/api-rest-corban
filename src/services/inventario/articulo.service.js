import { articuloRepository } from '../../repositories/inventario/articulo.repository.js';
import { ArticuloCategoria, UnidadMedida, Articulo } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { assertSinDuplicado } from '../../utils/duplicadoGuard.js';
import { evaluarMargen } from '../../utils/margenComercial.js';
import { sequelize } from '../../database/connection.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';

function parseEstado(valor) {
  if (valor === undefined || valor === '') return true;
  const texto = String(valor).trim().toLowerCase();
  return !['inactivo', 'false', '0', 'no'].includes(texto);
}

function parseBooleano(valor, porDefecto) {
  if (valor === undefined || valor === '') return porDefecto;
  const texto = String(valor).trim().toLowerCase();
  return !['no', 'false', '0'].includes(texto);
}

export const articuloService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await articuloRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      tipo: query.tipo,
      categoriaUuid: query.categoriaUuid,
      unidadMedidaUuid: query.unidadMedidaUuid,
      estado: query.estado,
      manejaInventario: query.manejaInventario,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const art = await articuloRepository.findByUuid(uuid);
    if (!art) throw ApiError.notFound('Artículo no encontrado');
    return art;
  },

  // Papelera: solo artículos eliminados lógicamente. Acceso restringido al
  // rol Administrador desde la ruta (requireAdmin).
  async listDeleted(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await articuloRepository.findAndCountAllDeleted({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  // Acceso restringido al rol Administrador desde la ruta (requireAdmin).
  async restore(uuid) {
    const art = await articuloRepository.findByUuidIncludingDeleted(uuid);
    if (!art) throw ApiError.notFound('Artículo no encontrado');
    if (!art.deletedAt) throw ApiError.conflict('El artículo no está eliminado');
    await articuloRepository.restore(art);
    return art;
  },

  async create(payload, actorId) {
    let categoriaId = null;
    if (payload.categoriaUuid) {
      const cat = await ArticuloCategoria.findOne({ where: { uuid: payload.categoriaUuid } });
      if (!cat) throw ApiError.notFound('Categoría no encontrada');
      categoriaId = cat.id;
    }
    let unidadMedidaId = null;
    if (payload.unidadMedidaUuid) {
      const uni = await UnidadMedida.findOne({ where: { uuid: payload.unidadMedidaUuid } });
      if (!uni) throw ApiError.notFound('Unidad de medida no encontrada');
      unidadMedidaId = uni.id;
    }

    const articulo = await sequelize.transaction(async (t) => {
      await assertSinDuplicado(Articulo, { nombre: payload.nombre }, t, 'Ya existe un artículo con ese nombre');
      return articuloRepository.create(
        {
          codigo: payload.codigo || null,
          nombre: payload.nombre,
          descripcion: payload.descripcion,
          categoriaId,
          unidadMedidaId,
          costoCompra: payload.costoCompra ?? 0,
          precioVenta: payload.precioVenta ?? 0,
          manejaInventario: payload.manejaInventario ?? true,
          stockMinimo: payload.stockMinimo ?? 0,
          stockMaximo: payload.stockMaximo ?? null,
          estado: payload.estado ?? true,
          createdBy: actorId,
        },
        { transaction: t },
      );
    });
    return { ...articulo.toJSON(), advertencias: evaluarMargen(payload.precioVenta, payload.costoCompra) };
  },

  async update(uuid, payload, actorId) {
    const art = await this.getByUuid(uuid);

    const data = { ...payload, updatedBy: actorId };
    if (payload.categoriaUuid !== undefined) {
      if (payload.categoriaUuid === null) data.categoriaId = null;
      else {
        const cat = await ArticuloCategoria.findOne({ where: { uuid: payload.categoriaUuid } });
        if (!cat) throw ApiError.notFound('Categoría no encontrada');
        data.categoriaId = cat.id;
      }
      delete data.categoriaUuid;
    }
    if (payload.unidadMedidaUuid !== undefined) {
      if (payload.unidadMedidaUuid === null) data.unidadMedidaId = null;
      else {
        const uni = await UnidadMedida.findOne({ where: { uuid: payload.unidadMedidaUuid } });
        if (!uni) throw ApiError.notFound('Unidad de medida no encontrada');
        data.unidadMedidaId = uni.id;
      }
      delete data.unidadMedidaUuid;
    }

    const actualizado = await sequelize.transaction(async (t) => {
      if (payload.nombre) {
        await assertSinDuplicado(Articulo, { nombre: payload.nombre }, t, 'Ya existe un artículo con ese nombre', art.id);
      }
      return articuloRepository.update(art, data, { transaction: t });
    });
    const costoCompraFinal = payload.costoCompra !== undefined ? payload.costoCompra : art.costoCompra;
    const precioVentaFinal = payload.precioVenta !== undefined ? payload.precioVenta : art.precioVenta;
    return { ...actualizado.toJSON(), advertencias: evaluarMargen(precioVentaFinal, costoCompraFinal) };
  },

  async delete(uuid, actorId) {
    const art = await this.getByUuid(uuid);
    await articuloRepository.softDelete(art, actorId);
  },

  // Cargue masivo desde .csv/.xlsx, para crear y actualizar artículos a la
  // vez. Columnas esperadas: nombre, codigo (opcional), descripcion
  // (opcional), categoria (opcional, nombre de la categoría), unidadMedida
  // (opcional, código de la unidad — ver Maestros → Unidades de Medida),
  // costoCompra, precioVenta, manejaInventario (si/no), stockMinimo,
  // stockMaximo, estado (opcional: activo/inactivo). Clave natural: nombre
  // (es único). Mismo criterio que motivoRepique: siempre inserta/actualiza
  // lo válido y reporta errores para el resto, en un solo upsert.
  async bulkCreateArticulos(file, actorId, { dryRun = false } = {}) {
    const rows = parseBulkFile(file);
    if (rows.length === 0) throw ApiError.badRequest('El archivo no tiene filas para procesar');

    const nombresCategorias = [...new Set(rows.map((r) => String(r.categoria || '').trim()).filter(Boolean))];
    const codigosUnidades = [...new Set(rows.map((r) => String(r.unidadmedida || '').trim()).filter(Boolean))];
    const categoriasEncontradas = nombresCategorias.length
      ? await ArticuloCategoria.findAll({ where: { nombre: nombresCategorias } })
      : [];
    const unidadesEncontradas = codigosUnidades.length
      ? await UnidadMedida.findAll({ where: { codigo: codigosUnidades } })
      : [];
    const mapaCategorias = new Map(categoriasEncontradas.map((c) => [c.nombre, c]));
    const mapaUnidades = new Map(unidadesEncontradas.map((u) => [u.codigo, u]));

    const errores = [];
    const filasValidas = [];

    for (let i = 0; i < rows.length; i += 1) {
      const fila = i + 2;
      const row = rows[i];
      const nombre = String(row.nombre || '').trim();

      if (!nombre) {
        errores.push({ fila, mensaje: 'Falta la columna requerida: nombre' });
        continue;
      }

      const categoriaTexto = String(row.categoria || '').trim();
      const unidadTexto = String(row.unidadmedida || '').trim();
      if (categoriaTexto && !mapaCategorias.has(categoriaTexto)) {
        errores.push({ fila, mensaje: `Categoría "${categoriaTexto}" no encontrada` });
        continue;
      }
      if (unidadTexto && !mapaUnidades.has(unidadTexto)) {
        errores.push({ fila, mensaje: `Unidad de medida "${unidadTexto}" no encontrada (usa el código, ej. KG, UND)` });
        continue;
      }

      const costoCompra = row.costocompra !== undefined && row.costocompra !== '' ? Number(row.costocompra) : 0;
      const precioVenta = row.precioventa !== undefined && row.precioventa !== '' ? Number(row.precioventa) : 0;
      if (!Number.isFinite(costoCompra) || costoCompra < 0) {
        errores.push({ fila, mensaje: `costoCompra "${row.costocompra}" no es un número válido` });
        continue;
      }
      if (!Number.isFinite(precioVenta) || precioVenta < 0) {
        errores.push({ fila, mensaje: `precioVenta "${row.precioventa}" no es un número válido` });
        continue;
      }
      const stockMinimo = row.stockminimo !== undefined && row.stockminimo !== '' ? Number(row.stockminimo) : 0;
      const stockMaximo = row.stockmaximo !== undefined && row.stockmaximo !== '' ? Number(row.stockmaximo) : null;
      if (!Number.isFinite(stockMinimo) || stockMinimo < 0) {
        errores.push({ fila, mensaje: `stockMinimo "${row.stockminimo}" no es un número válido` });
        continue;
      }
      if (stockMaximo !== null && (!Number.isFinite(stockMaximo) || stockMaximo < 0)) {
        errores.push({ fila, mensaje: `stockMaximo "${row.stockmaximo}" no es un número válido` });
        continue;
      }

      filasValidas.push({
        nombre,
        codigo: row.codigo ? String(row.codigo).trim() : null,
        descripcion: row.descripcion ? String(row.descripcion).trim() : null,
        categoriaId: categoriaTexto ? mapaCategorias.get(categoriaTexto).id : null,
        unidadMedidaId: unidadTexto ? mapaUnidades.get(unidadTexto).id : null,
        costoCompra,
        precioVenta,
        manejaInventario: parseBooleano(row.manejainventario, true),
        stockMinimo,
        stockMaximo,
        estado: parseEstado(row.estado),
      });
    }

    // Si el mismo nombre aparece varias veces en el archivo, se procesa una
    // sola vez con los valores de su última aparición.
    const porNombre = new Map();
    for (const f of filasValidas) porNombre.set(f.nombre, f);
    const filasUnicas = [...porNombre.values()];

    const nombres = filasUnicas.map((f) => f.nombre);
    const existentes = nombres.length ? await articuloRepository.findByNombres(nombres) : [];
    const nombresExistentes = new Set(existentes.map((a) => a.nombre));

    const creados = filasUnicas.filter((f) => !nombresExistentes.has(f.nombre)).length;
    const actualizados = filasUnicas.length - creados;

    if (!dryRun && filasUnicas.length > 0) {
      await articuloRepository.bulkUpsert(
        filasUnicas.map((f) => ({ ...f, createdBy: actorId, updatedBy: actorId })),
      );
    }

    return { totalFilas: rows.length, articulosCreados: creados, articulosActualizados: actualizados, errores };
  },

  // Exporta todos los artículos en el MISMO formato de columnas que espera
  // el cargue masivo — así el archivo exportado sirve directo como plantilla
  // para volver a subirlo con cambios (edita y lo vuelve a cargar, se
  // actualiza por nombre).
  async exportArticulosToExcel() {
    const { default: XLSX } = await import('xlsx');
    const rows = await articuloRepository.findAndCountAll({ limit: 1000000, offset: 0 });

    const datos = rows.rows.map((a) => ({
      nombre: a.nombre,
      codigo: a.codigo || '',
      descripcion: a.descripcion || '',
      categoria: a.categoria?.nombre || '',
      unidadMedida: a.unidadMedida?.codigo || '',
      costoCompra: Number(a.costoCompra || 0),
      precioVenta: Number(a.precioVenta || 0),
      manejaInventario: a.manejaInventario ? 'si' : 'no',
      stockMinimo: Number(a.stockMinimo || 0),
      stockMaximo: a.stockMaximo !== null ? Number(a.stockMaximo) : '',
      estado: a.estado ? 'activo' : 'inactivo',
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Artículos');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  },
};

export default articuloService;
