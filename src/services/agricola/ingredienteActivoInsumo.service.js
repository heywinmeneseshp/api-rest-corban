import { Op } from 'sequelize';
import { ArticuloCategoria, Articulo, UnidadMedida, IngredienteActivo, Almacen } from '../../database/associations.js';
import { articuloService } from '../inventario/articulo.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';

// Los insumos creados desde Sanidad Vegetal (Ingredientes Activos) SIEMPRE
// caen en esta categoría fija — no se elige en el formulario, para no
// mezclarse con el resto del catálogo de Inventarios. Se resuelve/crea la
// primera vez que hace falta (mismo patrón que
// mezcla.service.js#resolveOrCrearReguladorPh).
const CATEGORIA_SANIDAD_VEGETAL_NOMBRE = 'Sanidad Vegetal';

async function resolveOrCrearCategoriaSanidadVegetal(actorId) {
  const existente = await ArticuloCategoria.findOne({ where: { nombre: CATEGORIA_SANIDAD_VEGETAL_NOMBRE } });
  if (existente) return existente;
  try {
    return await ArticuloCategoria.create({
      nombre: CATEGORIA_SANIDAD_VEGETAL_NOMBRE,
      tipo: 'INSUMO',
      estado: true,
      createdBy: actorId,
    });
  } catch (err) {
    // Condición de carrera: otra request la creó primero (nombre único).
    const yaCreada = await ArticuloCategoria.findOne({ where: { nombre: CATEGORIA_SANIDAD_VEGETAL_NOMBRE } });
    if (yaCreada) return yaCreada;
    throw err;
  }
}

export const ingredienteActivoInsumoService = {
  async listInsumos(query, user) {
    const categoria = await ArticuloCategoria.findOne({ where: { nombre: CATEGORIA_SANIDAD_VEGETAL_NOMBRE } });
    if (!categoria) return { items: [], meta: { page: 1, limit: Number(query.limit) || 50, total: 0, totalPages: 0 } };
    return articuloService.list({ ...query, categoriaUuid: categoria.uuid }, user);
  },

  getInsumoByUuid(uuid, user) {
    return articuloService.getByUuid(uuid, user);
  },

  async createInsumo(payload, actorId) {
    const categoria = await resolveOrCrearCategoriaSanidadVegetal(actorId);
    return articuloService.create({ ...payload, categoriaUuid: categoria.uuid }, actorId);
  },

  async updateInsumo(uuid, payload, actorId, user) {
    // La categoría queda fija — cualquier categoriaUuid que venga en el
    // payload se ignora, nunca se deja cambiar desde acá.
    const { categoriaUuid: _categoriaUuid, ...resto } = payload;
    return articuloService.update(uuid, resto, actorId, user);
  },

  async deleteInsumo(uuid, actorId) {
    await articuloService.delete(uuid, actorId);
  },

  // Papelera: solo insumos eliminados lógicamente (siempre en la categoría
  // fija "Sanidad Vegetal"). Acceso restringido al rol Administrador desde
  // la ruta (requireAdmin).
  async listDeletedInsumos(query) {
    const categoria = await ArticuloCategoria.findOne({ where: { nombre: CATEGORIA_SANIDAD_VEGETAL_NOMBRE } });
    if (!categoria) return { items: [], meta: { page: 1, limit: Number(query.limit) || 50, total: 0, totalPages: 0 } };
    return articuloService.listDeleted({ ...query, categoriaUuid: categoria.uuid });
  },

  // Acceso restringido al rol Administrador desde la ruta (requireAdmin).
  restoreInsumo(uuid) {
    return articuloService.restore(uuid);
  },

  // Cargue masivo desde .csv/.xlsx. Columnas esperadas: nombre, codigo
  // (opcional), descripcion (opcional), unidadMedida (opcional, código de
  // la unidad), costoCompra, precioVenta, manejaInventario (si/no),
  // stockMinimo, stockMaximo, dosisPorHectarea (opcional), dosisUnidad
  // (opcional, código de la unidad), ingredientesActivos (opcional,
  // nombres separados por coma), almacenes (opcional, código o nombre,
  // separados por coma — sin ninguno el insumo queda visible en todos),
  // estado (opcional: activo/inactivo). Sin categoria — siempre cae en
  // "Sanidad Vegetal" (ver resolveOrCrearCategoriaSanidadVegetal); si el
  // nombre ya existe en OTRA categoría, se adopta (se mueve acá). Clave
  // natural: nombre (único).
  // A diferencia de articulo.service.js#bulkCreateArticulos (un solo
  // bulkUpsert), acá se procesa fila por fila porque cada una necesita
  // resolver la relación N:M de ingredientes activos y forzar la categoría
  // — mismo criterio de negocio que crear/actualizar uno por uno desde el
  // formulario, solo que en lote.
  async bulkCreateInsumos(file, actorId, { dryRun = false } = {}) {
    const rows = parseBulkFile(file);
    if (rows.length === 0) throw ApiError.badRequest('El archivo no tiene filas para procesar');

    // Las columnas de Insumos son casi todas opcionales (solo "nombre" es
    // obligatoria), así que subir por error la plantilla de OTRO cargue
    // masivo (ej. Ingredientes Activos, que solo tiene nombre/descripcion/
    // estado) no rompe el parseo — resulta en filas "válidas" pero vacías
    // de todo lo que en realidad importa acá. Se detecta comparando las
    // columnas del archivo contra la firma conocida de esa otra plantilla,
    // y se avisa explícitamente en vez de procesar en silencio.
    const columnasArchivo = new Set(Object.keys(rows[0] || {}));
    const columnasSoloIngredientesActivos = new Set(['nombre', 'descripcion', 'estado']);
    if (columnasArchivo.size === columnasSoloIngredientesActivos.size
      && [...columnasArchivo].every((c) => columnasSoloIngredientesActivos.has(c))) {
      throw ApiError.badRequest(
        'Las columnas del archivo no coinciden con la plantilla de Insumos — parece ser la plantilla de Ingredientes Activos (nombre, descripcion, estado). Descarga la plantilla de Insumos y volvé a intentar.',
      );
    }

    const codigosUnidades = [
      ...new Set(rows.flatMap((r) => [String(r.unidadmedida || '').trim(), String(r.dosisunidad || '').trim()]).filter(Boolean)),
    ];
    const unidadesEncontradas = codigosUnidades.length ? await UnidadMedida.findAll({ where: { codigo: codigosUnidades } }) : [];
    const mapaUnidades = new Map(unidadesEncontradas.map((u) => [u.codigo, u]));

    const nombresIngredientes = [
      ...new Set(
        rows.flatMap((r) =>
          String(r.ingredientesactivos || '')
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean),
        ),
      ),
    ];
    const ingredientesEncontrados = nombresIngredientes.length
      ? await IngredienteActivo.findAll({ where: { nombre: nombresIngredientes } })
      : [];
    const mapaIngredientes = new Map(ingredientesEncontrados.map((i) => [i.nombre, i]));

    // Almacenes (opcional, ver TagPicker en el formulario) — sin ninguno
    // asignado, el insumo queda visible en todos (mismo criterio "abierto
    // por defecto" que el resto de artículos). Se resuelve por código o por
    // nombre, lo que venga en la columna.
    const textosAlmacenes = [
      ...new Set(
        rows.flatMap((r) =>
          String(r.almacenes || '')
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean),
        ),
      ),
    ];
    const almacenesEncontrados = textosAlmacenes.length
      ? await Almacen.findAll({ where: { [Op.or]: [{ codigo: textosAlmacenes }, { nombre: textosAlmacenes }] } })
      : [];
    const mapaAlmacenes = new Map();
    for (const a of almacenesEncontrados) {
      if (a.codigo) mapaAlmacenes.set(a.codigo, a);
      mapaAlmacenes.set(a.nombre, a);
    }

    // El nombre de Articulo es único en TODA la base (no solo dentro de
    // Sanidad Vegetal) — si una fila del cargue nombra un artículo que ya
    // existe en OTRA categoría (ej. "Moléculas" en Inventarios), se
    // interpreta como "este producto en realidad es de Sanidad Vegetal" y
    // se ADOPTA: se actualiza y se le mueve la categoría acá (pedido
    // explícito — antes esto se reportaba como error, pero el caso real es
    // que el catálogo ya tenía el artículo cargado en otro lado y el cargue
    // masivo es la forma de corregirlo en lote).
    const nombresArticulos = rows.map((r) => String(r.nombre || '').trim()).filter(Boolean);
    const existentes = nombresArticulos.length ? await Articulo.findAll({ where: { nombre: nombresArticulos } }) : [];
    const mapaExistentes = new Map(existentes.map((a) => [a.nombre, a]));
    const categoriaSanidadVegetal = existentes.length ? await resolveOrCrearCategoriaSanidadVegetal(actorId) : null;
    const nombresAMoverCategoria = new Set(
      existentes.filter((a) => !categoriaSanidadVegetal || a.categoriaId !== categoriaSanidadVegetal.id).map((a) => a.nombre),
    );

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

      const unidadTexto = String(row.unidadmedida || '').trim();
      if (unidadTexto && !mapaUnidades.has(unidadTexto)) {
        errores.push({ fila, mensaje: `Unidad de medida "${unidadTexto}" no encontrada (usa el código, ej. KG, UND)` });
        continue;
      }
      const dosisUnidadTexto = String(row.dosisunidad || '').trim();
      if (dosisUnidadTexto && !mapaUnidades.has(dosisUnidadTexto)) {
        errores.push({ fila, mensaje: `Unidad de dosificación "${dosisUnidadTexto}" no encontrada (usa el código)` });
        continue;
      }

      const nombresIngredientesFila = String(row.ingredientesactivos || '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
      const ingredientesDesconocidos = nombresIngredientesFila.filter((n) => !mapaIngredientes.has(n));
      if (ingredientesDesconocidos.length) {
        errores.push({ fila, mensaje: `Ingrediente(s) activo(s) no encontrado(s): ${ingredientesDesconocidos.join(', ')}` });
        continue;
      }

      const textosAlmacenesFila = String(row.almacenes || '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
      const almacenesDesconocidos = textosAlmacenesFila.filter((n) => !mapaAlmacenes.has(n));
      if (almacenesDesconocidos.length) {
        errores.push({ fila, mensaje: `Almacén(es) no encontrado(s): ${almacenesDesconocidos.join(', ')}` });
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
      const dosisTexto = row.dosisporhectarea;
      const dosisPorHectarea = dosisTexto !== undefined && dosisTexto !== '' ? Number(dosisTexto) : null;
      if (dosisPorHectarea !== null && (!Number.isFinite(dosisPorHectarea) || dosisPorHectarea < 0)) {
        errores.push({ fila, mensaje: `dosisPorHectarea "${dosisTexto}" no es un número válido` });
        continue;
      }
      // Dosis sin unidad no sirve para nada — Mezclas/Aspersiones no
      // pueden calcular "Dosis real"/"% sobre dosis" sin ella (mismo
      // criterio ya exigido en articulo.validator.js para el alta manual).
      if (dosisPorHectarea !== null && !dosisUnidadTexto) {
        errores.push({ fila, mensaje: 'Si registras dosisPorHectarea, también debes indicar dosisUnidad' });
        continue;
      }

      filasValidas.push({
        nombre,
        codigo: row.codigo ? String(row.codigo).trim() : null,
        descripcion: row.descripcion ? String(row.descripcion).trim() : null,
        unidadMedidaUuid: unidadTexto ? mapaUnidades.get(unidadTexto).uuid : null,
        costoCompra,
        precioVenta,
        manejaInventario: row.manejainventario === undefined || row.manejainventario === ''
          ? true
          : !['no', 'false', '0'].includes(String(row.manejainventario).trim().toLowerCase()),
        stockMinimo,
        stockMaximo,
        dosisPorHectarea,
        dosisUnidadUuid: dosisUnidadTexto ? mapaUnidades.get(dosisUnidadTexto).uuid : null,
        ingredientesActivoUuids: nombresIngredientesFila.map((n) => mapaIngredientes.get(n).uuid),
        almacenUuids: textosAlmacenesFila.map((n) => mapaAlmacenes.get(n).uuid),
        estado: row.estado === undefined || row.estado === ''
          ? true
          : !['inactivo', 'false', '0', 'no'].includes(String(row.estado).trim().toLowerCase()),
      });
    }

    // Si el mismo nombre aparece varias veces en el archivo, se procesa una
    // sola vez con los valores de su última aparición.
    const porNombre = new Map();
    for (const f of filasValidas) porNombre.set(f.nombre, f);
    const filasUnicas = [...porNombre.values()];

    const creados = filasUnicas.filter((f) => !mapaExistentes.has(f.nombre)).length;
    const actualizados = filasUnicas.length - creados;

    if (!dryRun) {
      for (const f of filasUnicas) {
        const { nombre, ...datos } = f;
        const existente = mapaExistentes.get(nombre);
        if (existente && nombresAMoverCategoria.has(nombre)) {
          // Adopción: el artículo existía en otra categoría — se actualiza
          // Y se mueve a Sanidad Vegetal en la misma llamada (por eso acá
          // sí se llama a articuloService.update directo, no a
          // this.updateInsumo, que a propósito nunca deja tocar la
          // categoría desde el formulario normal de edición).
          await articuloService.update(existente.uuid, { nombre, ...datos, categoriaUuid: categoriaSanidadVegetal.uuid }, actorId);
        } else if (existente) {
          await this.updateInsumo(existente.uuid, { nombre, ...datos }, actorId);
        } else {
          await this.createInsumo({ nombre, ...datos }, actorId);
        }
      }
    }

    return { totalFilas: rows.length, insumosCreados: creados, insumosActualizados: actualizados, errores };
  },
};

export default ingredienteActivoInsumoService;
