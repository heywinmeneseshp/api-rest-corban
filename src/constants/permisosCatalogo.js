// Catálogo de permisos para armar roles (Maestros → Roles → Permisos): cada permiso del sistema tiene UN lugar, en el mismo
// orden y con los mismos nombres del menú lateral de la web (app-corbana/components/Sidebar.js).
//
// Sección → pantallas. Cada pantalla:
//   acceso       permiso de menú que deja ver la pantalla (null si no tiene: p. ej. Sistema).
//   filas        acciones normales por columna (ver / crear / editar / eliminar); varias filas si la pantalla maneja varias cosas
//                (Fincas: fincas, lotes, plantas...).
//   especiales   acciones fuera de las 4 columnas. `sensible`: cambia datos de forma delicada; la pantalla pide confirmar al marcarlo.
//   acompanantes permisos que se marcan y desmarcan junto con el acceso (no se muestran sueltos).
//   app          'campo' si la pantalla también existe en la app de campo (app-finca).
// La sección tiene `codigo` cuando el menú exige un permiso propio para mostrarla (se marca solo si alguna pantalla tiene acceso).
//
// IMPORTANTE: todo permiso nuevo de permissions.constants.js debe agregarse aquí. `verificarCatalogo()`
// (permisosCatalogo.check.js) lo exige al arrancar la API y en `npm run verificar:permisos`.

const crud = (prefijo, acciones = ['ver', 'crear', 'editar', 'eliminar']) =>
  Object.fromEntries(acciones.map((a) => [a, `${prefijo}.${a}`]));

const especial = (codigo, etiqueta, opciones = {}) => ({ codigo, etiqueta, ...opciones });

export const PERMISOS_CATALOGO = [
  {
    id: 'maestros',
    nombre: 'Maestros',
    codigo: 'menu.maestros',
    pantallas: [
      {
        nombre: 'Fincas',
        acceso: 'menu.maestros.fincas',
        filas: [
          { nombre: 'Fincas', ...crud('finca') },
          { nombre: 'Lotes', ...crud('lote') },
          { nombre: 'Plantas', ver: 'planta.ver' },
          { nombre: 'Categorías de planta', eliminar: 'categoria_planta.eliminar' },
        ],
      },
      { nombre: 'Productos', acceso: 'menu.maestros.productos', filas: [crud('producto')] },
      { nombre: 'Grupos de finca', acceso: 'menu.maestros.grupos_finca', filas: [crud('grupo_finca')] },
      { nombre: 'Zonas', acceso: 'menu.maestros.zonas', filas: [crud('zona')] },
      {
        nombre: 'Área de lotes',
        acceso: 'menu.maestros.area_lotes',
        filas: [{ ver: 'area_lote.ver' }],
        especiales: [
          especial('area_lote.configurar', 'Programar el registro obligatorio de área'),
          especial('area_lote.gestionar_lotes', 'Agregar lotes y ocultarlos del pendiente'),
          especial('area_lote.aprobar', 'Aprobar o rechazar cambios de área'),
          especial('area_lote.editar_semanas_anteriores', 'Editar el área de semanas anteriores', { sensible: true }),
          especial('area_lote.actualizar_masivo', 'Actualización masiva desde Excel', { sensible: true }),
        ],
      },
      {
        nombre: 'Usuarios',
        acceso: 'menu.maestros.usuarios',
        ayuda: 'Quien entra a Usuarios puede crearlos, editarlos y asignarles roles y fincas.',
        filas: [],
      },
      {
        nombre: 'Roles',
        acceso: 'menu.maestros.roles',
        filas: [crud('roles')],
        especiales: [especial('roles.asignar_permiso', 'Asignar permisos a los roles', { sensible: true })],
      },
      { nombre: 'Semanas', acceso: 'menu.maestros.semanas', filas: [crud('semana')] },
      { nombre: 'Calendario', acceso: 'menu.maestros.calendario', filas: [] },
      { nombre: 'Motivos de repique', acceso: 'menu.maestros.motivos_repique', filas: [crud('motivo_repique')] },
      { nombre: 'Motivos de recuse', acceso: 'menu.maestros.motivos_recuse', filas: [crud('motivo_recuse')] },
      { nombre: 'Categorías de labor', acceso: 'menu.maestros.categorias_labor', filas: [crud('categoria_labor')] },
      { nombre: 'Labores', acceso: 'menu.maestros.labores', filas: [crud('labor')] },
      { nombre: 'Estadios de Sigatoka', acceso: 'menu.maestros.estadios_sigatoka', filas: [] },
    ],
  },
  {
    id: 'racimos',
    nombre: 'Racimos',
    codigo: 'menu.racimos',
    pantallas: [
      {
        nombre: 'Movimientos',
        acceso: 'menu.racimos.movimientos',
        filas: [crud('racimo_movimiento', ['ver', 'editar', 'eliminar'])],
        especiales: [
          especial('racimo_movimiento.editar_historico', 'Crear o eliminar movimientos de semanas anteriores', { sensible: true }),
          especial('racimo_movimiento.eliminar_masivo', 'Eliminar varios movimientos a la vez', { sensible: true }),
        ],
      },
      {
        nombre: 'Registrar embolse, repique y corte',
        acceso: 'menu.racimos.registrar',
        filas: [{ crear: 'racimo_movimiento.crear' }],
        especiales: [
          especial('racimo_movimiento.forzar_saldo_negativo', 'Registrar aunque el saldo quede negativo', { sensible: true }),
          especial('racimo_movimiento.ajustar', 'Registrar ajustes (menú Registrar Ajuste)', { sensible: true }),
        ],
      },
      { nombre: 'Saldos × lotes y cintas', acceso: 'menu.racimos.saldos_lotes_cintas', filas: [] },
      { nombre: 'Liquidación de semanas', acceso: 'menu.racimos.liquidacion', filas: [] },
    ],
  },
  {
    id: 'labores',
    nombre: 'Labores',
    codigo: 'menu.labores',
    pantallas: [
      { nombre: 'Calendario de labores', acceso: 'menu.labores.calendario', filas: [crud('labor_programacion')] },
      { nombre: 'Estados de labores', acceso: 'menu.labores.estados', filas: [] },
    ],
  },
  {
    id: 'operacion',
    nombre: 'Producción y clima',
    codigo: null,
    pantallas: [
      {
        nombre: 'Precipitación diaria',
        acceso: 'menu.precipitacion_diaria',
        filas: [{ ver: 'precipitacion_diaria.ver' }],
        especiales: [
          especial('precipitacion_diaria.configurar', 'Programar el registro obligatorio de lluvia'),
          especial('precipitacion_diaria.propagar_clima', 'Copiar también cada registro en Clima'),
          especial('precipitacion_diaria.sincronizar_precipitaciones', 'Resolver diferencias entre Precipitación y Clima'),
          especial('clima.crear', 'Cargue masivo de clima desde archivo'),
        ],
      },
      {
        nombre: 'Producción semanal',
        acceso: 'menu.produccion_semanal',
        filas: [crud('produccion', ['ver', 'crear', 'eliminar'])],
        especiales: [especial('produccion.actualizar_masivo', 'Sobrescribir en bloque producción ya cargada', { sensible: true })],
      },
      {
        nombre: 'Estimaciones de fincas',
        acceso: 'menu.estimaciones',
        filas: [crud('estimacion', ['ver', 'crear'])],
        especiales: [especial('estimacion.editar_distribucion', 'Editar el % de distribución por cinta (patrón de corte)')],
      },
      {
        nombre: 'Proyección',
        acceso: 'menu.pronostico',
        filas: [
          { nombre: 'Pronóstico semanal', ver: 'pronostico.ver' },
          { nombre: 'Proyección anual', ver: 'proyeccion.ver', editar: 'proyeccion.editar' },
        ],
      },
      { nombre: 'Estación meteorológica', acceso: 'menu.estacion_meteorologica', filas: [{ ver: 'estacion_meteorologica.ver' }] },
      { nombre: 'Programación de corte', acceso: 'menu.programacion_corte', filas: [crud('programacion_corte', ['ver', 'crear', 'eliminar'])] },
      {
        nombre: 'Precalibración',
        acceso: 'menu.precalibracion',
        app: 'campo',
        filas: [crud('precalibracion', ['ver', 'crear'])],
        especiales: [especial('precalibracion.configurar', 'Configurar edades y calibres')],
      },
    ],
  },
  {
    id: 'sanidad_vegetal',
    nombre: 'Sanidad Vegetal',
    codigo: 'menu.sanidad_vegetal',
    pantallas: [
      { nombre: 'Evaluaciones', acceso: 'menu.sanidad_vegetal.evaluaciones', filas: [crud('evaluacion')] },
      { nombre: 'Gráficos', acceso: 'menu.sanidad_vegetal.graficos', filas: [] },
      { nombre: 'Evaluación de labores', acceso: 'menu.sanidad_vegetal.labores', filas: [{ ver: 'labor_evaluacion.ver' }] },
      { nombre: 'Alertas', acceso: 'menu.sanidad_vegetal.alertas', filas: [] },
      { nombre: 'Objetivos', acceso: 'menu.sanidad_vegetal.objetivos', filas: [crud('objetivo_evaluacion')] },
      {
        nombre: 'Programación de aspersiones',
        acceso: 'menu.sanidad_vegetal.aspersiones',
        filas: [crud('sanidad_vegetal.aspersiones')],
        especiales: [
          especial('sanidad_vegetal.aspersiones.ejecutar', 'Ejecutar aspersión (descuenta del inventario)', { sensible: true }),
          especial('sanidad_vegetal.aspersiones.enviar_correo', 'Enviar el aviso de aspersión por correo'),
        ],
      },
      {
        nombre: 'Comprobantes de aspersión',
        acceso: 'menu.sanidad_vegetal.comprobantes_aspersion',
        filas: [crud('sanidad_vegetal.comprobantes_aspersion', ['ver', 'editar', 'eliminar'])],
        especiales: [especial('sanidad_vegetal.comprobantes_aspersion.emitir', 'Emitir comprobantes')],
      },
      {
        nombre: 'Mezclas',
        acceso: 'menu.inventarios.elaboraciones',
        filas: [crud('inventario.mezclas')],
        especiales: [
          especial('inventario.mezclas.elaborar', 'Elaborar mezclas (genera movimientos de inventario)', { sensible: true }),
          especial('inventario.mezclas.aprobar', 'Aprobar mezclas (activa la receta)', { sensible: true }),
        ],
      },
      { nombre: 'Pruebas de laboratorio', acceso: 'menu.inventarios.mezclas', filas: [] },
      { nombre: 'Ingredientes activos', acceso: 'menu.sanidad_vegetal.ingredientes_activos', filas: [crud('ingrediente_activo')] },
      { nombre: 'Insumos', acceso: 'menu.sanidad_vegetal.insumos', filas: [] },
    ],
  },
  {
    id: 'colaboradores',
    nombre: 'Colaboradores',
    codigo: null,
    pantallas: [
      { nombre: 'Colaboradores', acceso: 'menu.maestros.colaboradores', app: 'campo', filas: [crud('colaborador')] },
      {
        nombre: 'Asistencia',
        acceso: 'menu.asistencia',
        app: 'campo',
        filas: [crud('asistencia', ['ver', 'eliminar'])],
        especiales: [
          especial('asistencia.marcar', 'Marcar su propia asistencia'),
          especial('asistencia.marcar_cuadrilla', 'Marcar la asistencia de otros y probar rostros'),
        ],
      },
    ],
  },
  {
    id: 'reportes',
    nombre: 'Reportes',
    codigo: null,
    pantallas: [
      { nombre: 'Descargas y Resumen semanal', acceso: 'menu.reportes', filas: [] },
      {
        nombre: 'Producción (detalle semanal y gráficos de embolse y repique)',
        acceso: 'menu.racimos.movimientos_semana',
        acompanantes: ['menu.racimos.reporte_embolses', 'menu.racimos.reporte_repiques'],
        filas: [],
      },
    ],
  },
  {
    id: 'inventarios',
    nombre: 'Inventarios',
    codigo: 'menu.inventarios',
    pantallas: [
      { nombre: 'Resumen y stock', acceso: 'menu.inventarios.dashboard', filas: [{ ver: 'inventario.dashboard.ver' }] },
      { nombre: 'Artículos', acceso: 'menu.inventarios.articulos', filas: [crud('inventario.articulos')] },
      { nombre: 'Categorías', acceso: 'menu.inventarios.categorias', filas: [crud('inventario.categorias')] },
      { nombre: 'Unidades', acceso: 'menu.inventarios.unidades', filas: [crud('inventario.unidades')] },
      { nombre: 'Almacenes', acceso: 'menu.inventarios.almacenes', filas: [crud('inventario.almacenes')] },
      { nombre: 'Motivos', acceso: 'menu.inventarios.motivos', filas: [crud('inventario.motivos')] },
      {
        nombre: 'Movimientos, existencias y kárdex',
        acceso: 'menu.inventarios.movimientos',
        filas: [crud('inventario.movimientos', ['ver', 'crear'])],
      },
      {
        nombre: 'Conteo',
        acceso: 'menu.inventarios.conteos',
        filas: [crud('inventario.conteos', ['ver', 'crear'])],
        especiales: [especial('inventario.conteos.cerrar', 'Cerrar conteos (aplica los ajustes al inventario)', { sensible: true })],
      },
      {
        nombre: 'Proformas y facturas',
        acceso: 'menu.inventarios.proformas',
        filas: [
          { nombre: 'Proformas', ...crud('inventario.proformas') },
          { nombre: 'Facturas', ver: 'inventario.facturas.ver' },
        ],
        especiales: [especial('inventario.proformas.convertir', 'Convertir proforma en factura')],
      },
      { nombre: 'Proveedores', acceso: 'menu.inventarios.proveedores', filas: [crud('inventario.proveedores')] },
    ],
  },
  {
    id: 'equipos',
    nombre: 'Equipos',
    codigo: null,
    pantallas: [
      { nombre: 'Equipos y repuestos', acceso: 'menu.inventarios.equipos', filas: [crud('inventario.equipos')] },
      { nombre: 'Planes de mantenimiento', acceso: 'menu.inventarios.planes', filas: [crud('inventario.planes')] },
      { nombre: 'Programaciones', acceso: 'menu.inventarios.programaciones', filas: [crud('inventario.programaciones')] },
      {
        nombre: 'Órdenes de mantenimiento',
        acceso: 'menu.inventarios.ordenes',
        filas: [crud('inventario.ordenes')],
        especiales: [especial('inventario.ordenes.cerrar', 'Cerrar órdenes (descuenta repuestos del inventario)', { sensible: true })],
      },
    ],
  },
  {
    id: 'sistema',
    nombre: 'Sistema',
    codigo: null,
    pantallas: [
      {
        nombre: 'Datos del sistema',
        acceso: null,
        filas: [],
        especiales: [especial('sistema.reset_datos', 'Borrar todos los datos que no vienen de la instalación', { sensible: true })],
      },
    ],
  },
];

const COLUMNAS = ['ver', 'crear', 'editar', 'eliminar'];

// Todos los códigos que nombra una pantalla (acceso, columnas, especiales y acompañantes).
export const codigosDePantalla = (p) => [
  ...(p.acceso ? [p.acceso] : []),
  ...p.filas.flatMap((f) => COLUMNAS.map((c) => f[c]).filter(Boolean)),
  ...(p.especiales || []).map((e) => e.codigo),
  ...(p.acompanantes || []),
];

// Todos los códigos del catálogo, con repetidos (para detectar duplicados).
export const codigosDelCatalogo = () =>
  PERMISOS_CATALOGO.flatMap((s) => [...(s.codigo ? [s.codigo] : []), ...s.pantallas.flatMap(codigosDePantalla)]);
