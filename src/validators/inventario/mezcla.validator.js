import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

const componenteSchema = Joi.object({
  articuloUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
  cantidad: Joi.number().positive().required(),
  unidadUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
});

export const createMezclaSchema = Joi.object({
  body: Joi.object({
    // Sin `codigo`: lo genera el sistema (correlativo MEZ-0001) — ver
    // mezcla.service.js#create. `nombre` tampoco es obligatorio acá: se
    // asigna más adelante, antes de finalizar la prueba (finalizar() sí lo
    // exige). Sin `articuloElaboradoUuid`: el artículo elaborado (producto)
    // no existe todavía en este punto — se CREA a partir de la prueba
    // exitosa, en crearElaborado() (ver crearElaboradoSchema más abajo).
    nombre: Joi.string().trim().max(150).allow(null, ''),
    descripcion: Joi.string().allow(null, '').max(1000),
    unidadRendimientoUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    rendimiento: Joi.number().positive().default(1),
    // Dosis por hectárea (en la unidad de unidadRendimiento) — la usa
    // Sanidad Vegetal → Programación de Aspersiones para calcular cuánto
    // preparar según las hectáreas de la finca. Opcional: no toda mezcla se
    // usa en aspersiones.
    dosisPorHectarea: Joi.number().positive().allow(null),
    dosisPorHectareaUnidadUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    precioVenta: Joi.number().min(0).allow(null).default(0),
    estado: Joi.boolean().default(true),
    // Almacén de donde la prueba va a consumir al finalizar — opcional al
    // crear un borrador, pero requerido antes de poder finalizar.
    almacenUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    // Los componentes ahora son opcionales al crear: se pueden ir
    // agregando después (setComponentesSchema) mientras la prueba está en
    // borrador.
    componentes: Joi.array().items(componenteSchema).default([]),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateMezclaSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().trim().max(50).allow(null, ''),
    nombre: Joi.string().trim().max(150),
    descripcion: Joi.string().allow(null, '').max(1000),
    unidadRendimientoUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    rendimiento: Joi.number().positive(),
    dosisPorHectarea: Joi.number().positive().allow(null),
    // Unidad de dosisPorHectarea (ej. Galones) — puede ser distinta de
    // unidadRendimiento. Solo tiene sentido junto con dosisPorHectarea, pero
    // no se exige acá para no romper el "vaciar dosis" (mandar
    // dosisPorHectarea:null sin tocar la unidad).
    dosisPorHectareaUnidadUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    precioVenta: Joi.number().min(0).allow(null),
    estado: Joi.boolean(),
    componentes: Joi.array().items(componenteSchema).min(1),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const getMezclaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listMezclaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    search: Joi.string().allow('', null),
    estado: Joi.boolean(),
    articuloElaboradoUuid: Joi.string().guid({ version: 'uuidv4' }),
    // false: excluye las recetas creadas con "Nueva mezcla" (sin prueba de
    // laboratorio) — la usa la pantalla de Mezclas — Pruebas de laboratorio,
    // que solo debe listar pruebas reales.
    incluirDirectas: Joi.boolean().default(true),
  }),
});

// Historial de pruebas — lista MezclaVersion a través de todas las
// mezclas, con los filtros pedidos (fecha, operador, estado, producto
// elaborado generado, componente utilizado).
export const listHistorialSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    estadoPrueba: Joi.string().valid('BORRADOR', 'EN_PRUEBA', 'OPTIMA', 'NO_VALIDA', 'CONVERTIDA'),
    operadorUuid: Joi.string().guid({ version: 'uuidv4' }),
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso(),
    articuloElaboradoUuid: Joi.string().guid({ version: 'uuidv4' }),
    articuloComponenteUuid: Joi.string().guid({ version: 'uuidv4' }),
  }),
});

// ─── Prueba de laboratorio (MezclaVersion) ───

const versionParams = Joi.object({
  uuid: uuidParam,
  versionUuid: uuidParam,
});

export const getVersionSchema = Joi.object({
  body: Joi.object({}),
  params: versionParams,
  query: Joi.object({}),
});

export const setComponentesSchema = Joi.object({
  body: Joi.object({
    componentes: Joi.array().items(componenteSchema).min(1).required(),
  }),
  params: versionParams,
  query: Joi.object({}),
});

// Agrega UN insumo nuevo sin tocar los ya guardados (ver
// mezcla.service.js#agregarComponente) — no rompe el componenteId que ya
// pueda tener una etapa apuntando a una fila existente.
export const agregarComponenteSchema = Joi.object({
  body: componenteSchema,
  params: versionParams,
  query: Joi.object({}),
});

export const actualizarComponenteSchema = Joi.object({
  body: Joi.object({
    cantidad: Joi.number().positive().required(),
    unidadUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
  }),
  params: Joi.object({ uuid: uuidParam, versionUuid: uuidParam, componenteUuid: uuidParam }),
  query: Joi.object({}),
});

export const marcarComponentePrincipalSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam, versionUuid: uuidParam, componenteUuid: uuidParam }),
  query: Joi.object({}),
});

export const agregarEtapaSchema = Joi.object({
  body: Joi.object({
    // CORRECCION_PH: se usó el Regulador de pH para ajustar el pH — va con
    // su propia cantidad/unidad, nunca con componenteUuid (ese insumo no
    // forma parte de la receta permanente, ver
    // mezcla.service.js#finalizar). El artículo NO se elige acá: siempre es
    // "Regulador de pH", que el service resuelve/crea solo (pedido
    // explícito — no tiene sentido corregir pH con otra cosa).
    tipoEtapa: Joi.string().valid('MEDICION', 'CORRECCION_PH').default('MEDICION'),
    componenteUuid: Joi.string()
      .guid({ version: 'uuidv4' })
      .allow(null, '')
      .when('tipoEtapa', { is: 'CORRECCION_PH', then: Joi.forbidden() }),
    cantidadCorreccion: Joi.number()
      .positive()
      .when('tipoEtapa', { is: 'CORRECCION_PH', then: Joi.required(), otherwise: Joi.forbidden() }),
    unidadCorreccionUuid: Joi.string()
      .guid({ version: 'uuidv4' })
      .when('tipoEtapa', { is: 'CORRECCION_PH', then: Joi.required(), otherwise: Joi.forbidden() }),
    ph: Joi.number().min(0).max(14).required(),
    ce: Joi.number().min(0).required(),
    observaciones: Joi.string().allow(null, '').max(1000),
    medidoEn: Joi.date().iso(),
  }),
  params: versionParams,
  query: Joi.object({}),
});

export const finalizarVersionSchema = Joi.object({
  body: Joi.object({
    // true solo en el reenvío tras confirmar la advertencia de stock
    // insuficiente (ver mezcla.service.js#finalizar).
    forzarSaldoNegativo: Joi.boolean().default(false),
  }),
  params: versionParams,
  query: Joi.object({}),
});

// El artículo elaborado (producto) nace de la prueba exitosa acá — no se
// selecciona uno existente. `articuloCategoriaUuid` debe apuntar a una
// categoría de tipo ELABORADO (mezcla.service.js#crearElaborado lo valida).
export const crearElaboradoSchema = Joi.object({
  body: Joi.object({
    cantidadElaborada: Joi.number().positive().required(),
    almacenUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    fecha: Joi.date().iso().required(),
    observaciones: Joi.string().allow(null, '').max(1000),
    // No van con `.required()`: solo hacen falta cuando el artículo
    // elaborado TODAVÍA no existe (primera vez). En un reintento —la
    // mezcla ya tiene articuloElaboradoId de un intento anterior— el
    // frontend ni siquiera muestra esos campos, así que llegan vacíos; el
    // servicio los exige a mano solo cuando de verdad va a crear el
    // artículo (ver mezcla.service.js#crearElaborado).
    articuloNombre: Joi.string().trim().max(150).allow(null, ''),
    articuloCodigo: Joi.string().trim().max(50).allow(null, ''),
    articuloCategoriaUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    articuloUnidadMedidaUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    articuloPrecioVenta: Joi.number().min(0).allow(null),
    // true solo en el reenvío tras confirmar la advertencia de stock
    // insuficiente (ver mezcla.service.js#crearElaborado).
    forzarSaldoNegativo: Joi.boolean().default(false),
  }),
  params: versionParams,
  query: Joi.object({}),
});

// Crea un elaborado SIN pasar por la prueba de laboratorio (pH/CE) — para
// productos que no la necesitan (pedido explícito). Igual crea una Mezcla
// (la receta queda guardada, reutilizable para "Nueva elaboración" después)
// y su artículo, pero sin etapas ni resultado. Si lo crea un Administrador
// queda activo de una; cualquier otro rol la deja PENDIENTE_APROBACION (ver
// mezcla.service.js#crearDirecta). Al crear NO se descuenta ningún insumo —
// eso solo pasa cuando de verdad se "elabora" (Elaboraciones → Nueva
// elaboración), no al definir la receta.
export const crearDirectaSchema = Joi.object({
  body: Joi.object({
    articuloNombre: Joi.string().trim().max(150).required(),
    articuloCodigo: Joi.string().trim().max(50).allow(null, ''),
    articuloCategoriaUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    articuloUnidadMedidaUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    almacenUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    rendimiento: Joi.number().positive().required(),
    dosisPorHectarea: Joi.number().positive().allow(null),
    componentes: Joi.array().items(componenteSchema).min(1).required(),
    observaciones: Joi.string().allow(null, '').max(1000),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const subirFotosSchema = Joi.object({
  body: Joi.object({
    etapaUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    homogeneidadUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
  }),
  params: versionParams,
  query: Joi.object({}),
});

// Prueba de homogeneidad (15/30/60 min de mezclada): un registro por
// punto de control, con foto adjunta a través de subirFotosSchema
// (homogeneidadUuid) en un segundo paso — ver
// mezcla.service.js#registrarHomogeneidad.
export const registrarHomogeneidadSchema = Joi.object({
  body: Joi.object({
    intervalo: Joi.string().valid('15MIN', '30MIN', '60MIN').required(),
    homogenea: Joi.boolean().required(),
    observaciones: Joi.string().allow(null, '').max(1000),
  }),
  params: versionParams,
  query: Joi.object({}),
});

export const eliminarFotoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ fotoUuid: uuidParam }),
  query: Joi.object({}),
});

export const eliminarEtapaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ etapaUuid: uuidParam }),
  query: Joi.object({}),
});

export const mezclaParametrosSchema = Joi.object({
  body: Joi.object({
    phMinimo: Joi.number().min(0).max(14).required(),
    phMaximo: Joi.number().min(0).max(14).required(),
    ceMaxima: Joi.number().min(0).required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
