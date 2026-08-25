export const PERMISSIONS = {
  USUARIOS_VER: 'usuarios.ver',
  USUARIOS_CREAR: 'usuarios.crear',
  USUARIOS_EDITAR: 'usuarios.editar',
  USUARIOS_ELIMINAR: 'usuarios.eliminar',
  USUARIOS_ASIGNAR_ROL: 'usuarios.asignar_rol',
  USUARIOS_ASIGNAR_FINCA: 'usuarios.asignar_finca',

  ROLES_VER: 'roles.ver',
  ROLES_CREAR: 'roles.crear',
  ROLES_EDITAR: 'roles.editar',
  ROLES_ELIMINAR: 'roles.eliminar',
  ROLES_ASIGNAR_PERMISO: 'roles.asignar_permiso',

  PERMISOS_VER: 'permisos.ver',
  PERMISOS_CREAR: 'permisos.crear',
  PERMISOS_EDITAR: 'permisos.editar',
  PERMISOS_ELIMINAR: 'permisos.eliminar',

  MENU_VER: 'menu.ver',
  MENU_CREAR: 'menu.crear',
  MENU_EDITAR: 'menu.editar',
  MENU_ELIMINAR: 'menu.eliminar',

  FINCA_VER: 'finca.ver',
  FINCA_CREAR: 'finca.crear',
  FINCA_EDITAR: 'finca.editar',
  FINCA_ELIMINAR: 'finca.eliminar',

  PRODUCTO_VER: 'producto.ver',
  PRODUCTO_CREAR: 'producto.crear',
  PRODUCTO_EDITAR: 'producto.editar',
  PRODUCTO_ELIMINAR: 'producto.eliminar',

  // Fincas que operativamente son una sola dividida en varios registros (ej.
  // "María Margarita" / "Marbella"): agruparlas expande tanto los lotes
  // visibles al elegir cualquiera de ellas como el acceso por finca asignada.
  GRUPO_FINCA_VER: 'grupo_finca.ver',
  GRUPO_FINCA_CREAR: 'grupo_finca.crear',
  GRUPO_FINCA_EDITAR: 'grupo_finca.editar',
  GRUPO_FINCA_ELIMINAR: 'grupo_finca.eliminar',

  LOTE_VER: 'lote.ver',
  LOTE_CREAR: 'lote.crear',
  LOTE_EDITAR: 'lote.editar',
  LOTE_ELIMINAR: 'lote.eliminar',

  // Crear/editar/eliminar planta: sin permiso puntual — cualquier usuario
  // autenticado puede hacerlo, no hace falta granularlo por rol (a
  // diferencia de "ver", que sí sigue gateado).
  PLANTA_VER: 'planta.ver',

  // Ver/crear/editar categoría de planta: sin permiso puntual, mismo
  // criterio — "eliminar" sí sigue siendo granular (es la única acción
  // destructiva de este módulo).
  CATEGORIA_PLANTA_ELIMINAR: 'categoria_planta.eliminar',

  SEMANA_VER: 'semana.ver',
  SEMANA_CREAR: 'semana.crear',
  SEMANA_EDITAR: 'semana.editar',
  SEMANA_ELIMINAR: 'semana.eliminar',

  // Ver/crear/editar/eliminar cualquiera de las 3 evaluaciones (Índice de
  // Infección, Conteo de Hojas, Suma Bruta) y el panel Indicadores usan
  // estos 4 permisos genéricos — ya no hay uno propio por tipo.
  EVALUACION_VER: 'evaluacion.ver',
  EVALUACION_CREAR: 'evaluacion.crear',
  EVALUACION_EDITAR: 'evaluacion.editar',
  EVALUACION_ELIMINAR: 'evaluacion.eliminar',

  MOTIVO_REPIQUE_VER: 'motivo_repique.ver',
  MOTIVO_REPIQUE_CREAR: 'motivo_repique.crear',
  MOTIVO_REPIQUE_EDITAR: 'motivo_repique.editar',
  MOTIVO_REPIQUE_ELIMINAR: 'motivo_repique.eliminar',

  MOTIVO_RECUSE_VER: 'motivo_recuse.ver',
  MOTIVO_RECUSE_CREAR: 'motivo_recuse.crear',
  MOTIVO_RECUSE_EDITAR: 'motivo_recuse.editar',
  MOTIVO_RECUSE_ELIMINAR: 'motivo_recuse.eliminar',

  RACIMO_MOVIMIENTO_VER: 'racimo_movimiento.ver',
  RACIMO_MOVIMIENTO_CREAR: 'racimo_movimiento.crear',
  RACIMO_MOVIMIENTO_EDITAR: 'racimo_movimiento.editar',
  RACIMO_MOVIMIENTO_ELIMINAR: 'racimo_movimiento.eliminar',
  // Permiso aparte (no lo tiene nadie por defecto salvo Administrador, que
  // igual se salta toda restricción): permite crear/eliminar movimientos de
  // semanas anteriores a la última semana registrada en esa finca, sin
  // necesidad de ser Administrador ni heredar sus demás poderes.
  RACIMO_MOVIMIENTO_EDITAR_HISTORICO: 'racimo_movimiento.editar_historico',
  // Permiso aparte (no lo tiene nadie por defecto salvo Administrador, mismo
  // criterio que RACIMO_MOVIMIENTO_EDITAR_HISTORICO): permite confirmar el
  // registro de un movimiento aunque deje el saldo de una cohorte en
  // negativo, tanto en el registro manual (Repique/Corte) como en el
  // cargue masivo por archivo.
  RACIMO_MOVIMIENTO_FORZAR_SALDO_NEGATIVO: 'racimo_movimiento.forzar_saldo_negativo',
  // Permiso aparte (no lo tiene nadie por defecto salvo Administrador, mismo
  // criterio que los anteriores): permite eliminar varios movimientos de
  // una sola vez desde la tabla de Movimientos, con casillas de selección.
  RACIMO_MOVIMIENTO_ELIMINAR_MASIVO: 'racimo_movimiento.eliminar_masivo',

  PRODUCCION_VER: 'produccion.ver',
  PRODUCCION_CREAR: 'produccion.crear',
  PRODUCCION_ELIMINAR: 'produccion.eliminar',
  // Permiso aparte (no lo tiene nadie por defecto salvo Administrador, mismo
  // criterio que RACIMO_MOVIMIENTO_EDITAR_HISTORICO): sobrescribe cajas ya
  // cargadas de una finca+semana en vez de solo agregar filas nuevas, así
  // que puede corregir en bloque un cargue masivo con errores.
  PRODUCCION_ACTUALIZAR_MASIVO: 'produccion.actualizar_masivo',

  PRONOSTICO_VER: 'pronostico.ver',

  // Captura diaria de precipitación desde app-corbana (distinta del registro
  // de clima que hace la app móvil): un rol programado debe digitar la
  // precipitación del día anterior o queda bloqueado con un modal hasta
  // ponerse al día. VER es para listar/consultar registros y la
  // configuración; CONFIGURAR es para programar qué rol/finca/semana exige
  // el registro (solo administración).
  PRECIPITACION_DIARIA_VER: 'precipitacion_diaria.ver',
  PRECIPITACION_DIARIA_CONFIGURAR: 'precipitacion_diaria.configurar',

  // Si el rol tiene este permiso, cada registro que haga en Precipitación
  // Diaria también se copia (siempre, la pise o no) al mm de `clima` de esa
  // misma finca+fecha — sin este permiso, Precipitación Diaria sigue sin
  // tocar `clima` en absoluto (solo la reconciliación manual de
  // /inconsistencias escribe cruzado). El camino inverso nunca aplica:
  // registrar en Clima jamás inserta en Precipitación Diaria.
  PRECIPITACION_DIARIA_PROPAGAR_CLIMA: 'precipitacion_diaria.propagar_clima',

  // Resolver inconsistencias entre Precipitación Diaria y Clima (botones
  // "Usar Precipitación Diaria"/"Usar Clima") — permiso propio, separado de
  // CONFIGURAR (que es para programar la captura obligatoria), porque no
  // todo el que registra o propaga a Clima necesita poder resolver
  // conflictos de otras fincas/fechas.
  PRECIPITACION_DIARIA_SINCRONIZAR: 'precipitacion_diaria.sincronizar_precipitaciones',

  // El registro individual de Clima (POST /clima, un día/finca a la vez) no
  // exige permiso puntual — lo usa cualquier usuario autenticado desde la
  // app móvil o el modal de Precipitación Diaria. Este permiso es solo para
  // el cargue masivo por archivo (varios días/fincas de una vez), que sí es
  // una acción de oficina/administración.
  CLIMA_CREAR: 'clima.crear',

  // Igual patrón que Precipitación Diaria, pero para el área total y en
  // producción de los lotes: VER es para consultar la configuración,
  // CONFIGURAR para programar qué rol/finca/fecha exige el registro (solo
  // administración). El registro en sí (desde el modal bloqueante) no exige
  // ningún permiso puntual — ver loteAreaConfig.routes.js.
  AREA_LOTE_VER: 'area_lote.ver',
  AREA_LOTE_CONFIGURAR: 'area_lote.configurar',

  CATEGORIA_LABOR_VER: 'categoria_labor.ver',
  CATEGORIA_LABOR_CREAR: 'categoria_labor.crear',
  CATEGORIA_LABOR_EDITAR: 'categoria_labor.editar',
  CATEGORIA_LABOR_ELIMINAR: 'categoria_labor.eliminar',

  LABOR_VER: 'labor.ver',
  LABOR_CREAR: 'labor.crear',
  LABOR_EDITAR: 'labor.editar',
  LABOR_ELIMINAR: 'labor.eliminar',

  COLABORADOR_VER: 'colaborador.ver',
  COLABORADOR_CREAR: 'colaborador.crear',
  COLABORADOR_EDITAR: 'colaborador.editar',
  COLABORADOR_ELIMINAR: 'colaborador.eliminar',

  LABOR_PROGRAMACION_VER: 'labor_programacion.ver',
  LABOR_PROGRAMACION_CREAR: 'labor_programacion.crear',
  LABOR_PROGRAMACION_EDITAR: 'labor_programacion.editar',
  LABOR_PROGRAMACION_ELIMINAR: 'labor_programacion.eliminar',

  // Reporte de visitas de sanidad/labor cultural registradas desde la app
  // móvil (Sanidad Vegetal › Evaluación de Labores). Antes reutilizaba
  // labor.ver (el maestro de Labores), lo que impedía asignarlo aparte.
  LABOR_EVALUACION_VER: 'labor_evaluacion.ver',

  PROGRAMACION_CORTE_VER: 'programacion_corte.ver',
  PROGRAMACION_CORTE_CREAR: 'programacion_corte.crear',
  PROGRAMACION_CORTE_ELIMINAR: 'programacion_corte.eliminar',

  SISTEMA_RESET_DATOS: 'sistema.reset_datos',

  // ─── Menú / navegación ───
  // Capa nueva, separada de los permisos granulares de arriba: controla
  // únicamente qué botón del menú lateral se ve y a qué pantalla se puede
  // entrar (bloquea también por URL directa, igual que cualquier otro
  // RequirePermission). Los permisos granulares existentes (finca.ver,
  // infeccion.crear, precipitacion_diaria.configurar, etc.) siguen
  // controlando el backend y las acciones puntuales dentro de cada
  // pantalla — esto no los reemplaza. MENU_<seccion> es el botón de
  // primer nivel (ej. "Maestros"); MENU_<seccion>_<sub> es cada link
  // puntual dentro de esa sección ya visible.
  MENU_MAESTROS: 'menu.maestros',
  MENU_MAESTROS_FINCAS: 'menu.maestros.fincas',
  MENU_MAESTROS_PRODUCTOS: 'menu.maestros.productos',
  MENU_MAESTROS_GRUPOS_FINCA: 'menu.maestros.grupos_finca',
  MENU_MAESTROS_AREA_LOTES: 'menu.maestros.area_lotes',
  MENU_MAESTROS_USUARIOS: 'menu.maestros.usuarios',
  MENU_MAESTROS_ROLES: 'menu.maestros.roles',
  MENU_MAESTROS_SEMANAS: 'menu.maestros.semanas',
  MENU_MAESTROS_CALENDARIO: 'menu.maestros.calendario',
  MENU_MAESTROS_MOTIVOS_REPIQUE: 'menu.maestros.motivos_repique',
  MENU_MAESTROS_MOTIVOS_RECUSE: 'menu.maestros.motivos_recuse',
  MENU_MAESTROS_CATEGORIAS_LABOR: 'menu.maestros.categorias_labor',
  MENU_MAESTROS_LABORES: 'menu.maestros.labores',
  MENU_MAESTROS_ESTADIOS_SIGATOKA: 'menu.maestros.estadios_sigatoka',
  MENU_MAESTROS_VERSION_APP: 'menu.maestros.version_app',
  MENU_MAESTROS_COLABORADORES: 'menu.maestros.colaboradores',

  MENU_RACIMOS: 'menu.racimos',
  MENU_RACIMOS_MOVIMIENTOS: 'menu.racimos.movimientos',
  // Cubre los 3 links (Embolse/Repique/Corte), que hoy ya comparten un solo
  // permiso granular (racimo_movimiento.crear) — se mantiene esa agrupación.
  MENU_RACIMOS_REGISTRAR: 'menu.racimos.registrar',
  MENU_RACIMOS_SALDOS_LOTES_CINTAS: 'menu.racimos.saldos_lotes_cintas',
  MENU_RACIMOS_REPORTE_EMBOLSES: 'menu.racimos.reporte_embolses',

  MENU_LABORES: 'menu.labores',
  MENU_LABORES_CALENDARIO: 'menu.labores.calendario',
  MENU_LABORES_ESTADOS: 'menu.labores.estados',

  MENU_SANIDAD_VEGETAL: 'menu.sanidad_vegetal',
  MENU_SANIDAD_VEGETAL_EVALUACIONES: 'menu.sanidad_vegetal.evaluaciones',
  MENU_SANIDAD_VEGETAL_GRAFICOS: 'menu.sanidad_vegetal.graficos',
  MENU_SANIDAD_VEGETAL_LABORES: 'menu.sanidad_vegetal.labores',
  MENU_SANIDAD_VEGETAL_ALERTAS: 'menu.sanidad_vegetal.alertas',

  // Ítems planos del menú (hoy sin submenú propio, un solo código cada uno).
  MENU_PRECIPITACION_DIARIA: 'menu.precipitacion_diaria',
  MENU_PRODUCCION_SEMANAL: 'menu.produccion_semanal',
  MENU_PRONOSTICO: 'menu.pronostico',
  MENU_CARGUE_MASIVO: 'menu.cargue_masivo',
  MENU_PROGRAMACION_CORTE: 'menu.programacion_corte',
  MENU_REPORTES: 'menu.reportes',

  // Inventarios - FASE 1: Catálogo
  INVENTARIO_DASHBOARD_VER: 'inventario.dashboard.ver',
  INVENTARIO_CATEGORIAS_VER: 'inventario.categorias.ver',
  INVENTARIO_CATEGORIAS_CREAR: 'inventario.categorias.crear',
  INVENTARIO_CATEGORIAS_EDITAR: 'inventario.categorias.editar',
  INVENTARIO_CATEGORIAS_ELIMINAR: 'inventario.categorias.eliminar',
  INVENTARIO_UNIDADES_VER: 'inventario.unidades.ver',
  INVENTARIO_UNIDADES_CREAR: 'inventario.unidades.crear',
  INVENTARIO_UNIDADES_EDITAR: 'inventario.unidades.editar',
  INVENTARIO_UNIDADES_ELIMINAR: 'inventario.unidades.eliminar',
  INVENTARIO_PRODUCTOS_VER: 'inventario.productos.ver',
  INVENTARIO_PRODUCTOS_CREAR: 'inventario.productos.crear',
  INVENTARIO_PRODUCTOS_EDITAR: 'inventario.productos.editar',
  INVENTARIO_PRODUCTOS_ELIMINAR: 'inventario.productos.eliminar',
  INVENTARIO_ALMACENES_VER: 'inventario.almacenes.ver',
  INVENTARIO_ALMACENES_CREAR: 'inventario.almacenes.crear',
  INVENTARIO_ALMACENES_EDITAR: 'inventario.almacenes.editar',
  INVENTARIO_ALMACENES_ELIMINAR: 'inventario.almacenes.eliminar',

  MENU_INVENTARIOS: 'menu.inventarios',
  MENU_INVENTARIOS_DASHBOARD: 'menu.inventarios.dashboard',
  MENU_INVENTARIOS_PRODUCTOS: 'menu.inventarios.productos',
  MENU_INVENTARIOS_CATEGORIAS: 'menu.inventarios.categorias',
  MENU_INVENTARIOS_UNIDADES: 'menu.inventarios.unidades',
  MENU_INVENTARIOS_ALMACENES: 'menu.inventarios.almacenes',

  // Inventarios - FASE 2: Movimientos
  INVENTARIO_MOTIVOS_VER: 'inventario.motivos.ver',
  INVENTARIO_MOTIVOS_CREAR: 'inventario.motivos.crear',
  INVENTARIO_MOTIVOS_EDITAR: 'inventario.motivos.editar',
  INVENTARIO_MOTIVOS_ELIMINAR: 'inventario.motivos.eliminar',
  INVENTARIO_MOVIMIENTOS_VER: 'inventario.movimientos.ver',
  INVENTARIO_MOVIMIENTOS_CREAR: 'inventario.movimientos.crear',

  MENU_INVENTARIOS_MOTIVOS: 'menu.inventarios.motivos',
  MENU_INVENTARIOS_MOVIMIENTOS: 'menu.inventarios.movimientos',
};

export const PERMISSIONS_SEED = [
  { codigo: PERMISSIONS.USUARIOS_VER, nombre: 'Ver usuarios' },
  { codigo: PERMISSIONS.USUARIOS_CREAR, nombre: 'Crear usuarios' },
  { codigo: PERMISSIONS.USUARIOS_EDITAR, nombre: 'Editar usuarios' },
  { codigo: PERMISSIONS.USUARIOS_ELIMINAR, nombre: 'Eliminar usuarios' },
  { codigo: PERMISSIONS.USUARIOS_ASIGNAR_ROL, nombre: 'Asignar roles a usuarios' },
  { codigo: PERMISSIONS.USUARIOS_ASIGNAR_FINCA, nombre: 'Asignar fincas a usuarios' },

  { codigo: PERMISSIONS.ROLES_VER, nombre: 'Ver roles' },
  { codigo: PERMISSIONS.ROLES_CREAR, nombre: 'Crear roles' },
  { codigo: PERMISSIONS.ROLES_EDITAR, nombre: 'Editar roles' },
  { codigo: PERMISSIONS.ROLES_ELIMINAR, nombre: 'Eliminar roles' },
  { codigo: PERMISSIONS.ROLES_ASIGNAR_PERMISO, nombre: 'Asignar permisos a roles' },

  { codigo: PERMISSIONS.PERMISOS_VER, nombre: 'Ver permisos' },
  { codigo: PERMISSIONS.PERMISOS_CREAR, nombre: 'Crear permisos' },
  { codigo: PERMISSIONS.PERMISOS_EDITAR, nombre: 'Editar permisos' },
  { codigo: PERMISSIONS.PERMISOS_ELIMINAR, nombre: 'Eliminar permisos' },

  { codigo: PERMISSIONS.MENU_VER, nombre: 'Ver menú' },
  { codigo: PERMISSIONS.MENU_CREAR, nombre: 'Crear ítems de menú' },
  { codigo: PERMISSIONS.MENU_EDITAR, nombre: 'Editar ítems de menú' },
  { codigo: PERMISSIONS.MENU_ELIMINAR, nombre: 'Eliminar ítems de menú' },

  { codigo: PERMISSIONS.FINCA_VER, nombre: 'Ver fincas' },
  { codigo: PERMISSIONS.FINCA_CREAR, nombre: 'Crear fincas' },
  { codigo: PERMISSIONS.FINCA_EDITAR, nombre: 'Editar fincas' },
  { codigo: PERMISSIONS.FINCA_ELIMINAR, nombre: 'Eliminar fincas' },

  { codigo: PERMISSIONS.PRODUCTO_VER, nombre: 'Ver productos' },
  { codigo: PERMISSIONS.PRODUCTO_CREAR, nombre: 'Crear productos' },
  { codigo: PERMISSIONS.PRODUCTO_EDITAR, nombre: 'Editar productos' },
  { codigo: PERMISSIONS.PRODUCTO_ELIMINAR, nombre: 'Eliminar productos' },

  { codigo: PERMISSIONS.GRUPO_FINCA_VER, nombre: 'Ver grupos de finca' },
  { codigo: PERMISSIONS.GRUPO_FINCA_CREAR, nombre: 'Crear grupos de finca' },
  { codigo: PERMISSIONS.GRUPO_FINCA_EDITAR, nombre: 'Editar grupos de finca' },
  { codigo: PERMISSIONS.GRUPO_FINCA_ELIMINAR, nombre: 'Eliminar grupos de finca' },

  { codigo: PERMISSIONS.LOTE_VER, nombre: 'Ver lotes' },
  { codigo: PERMISSIONS.LOTE_CREAR, nombre: 'Crear lotes' },
  { codigo: PERMISSIONS.LOTE_EDITAR, nombre: 'Editar lotes' },
  { codigo: PERMISSIONS.LOTE_ELIMINAR, nombre: 'Eliminar lotes' },

  { codigo: PERMISSIONS.PLANTA_VER, nombre: 'Ver plantas' },

  { codigo: PERMISSIONS.CATEGORIA_PLANTA_ELIMINAR, nombre: 'Eliminar categorías de planta' },

  { codigo: PERMISSIONS.SEMANA_VER, nombre: 'Ver semanas' },
  { codigo: PERMISSIONS.SEMANA_CREAR, nombre: 'Crear semanas' },
  { codigo: PERMISSIONS.SEMANA_EDITAR, nombre: 'Editar semanas' },
  { codigo: PERMISSIONS.SEMANA_ELIMINAR, nombre: 'Eliminar semanas' },

  { codigo: PERMISSIONS.EVALUACION_VER, nombre: 'Ver evaluaciones' },
  { codigo: PERMISSIONS.EVALUACION_CREAR, nombre: 'Crear evaluaciones' },
  { codigo: PERMISSIONS.EVALUACION_EDITAR, nombre: 'Editar evaluaciones' },
  { codigo: PERMISSIONS.EVALUACION_ELIMINAR, nombre: 'Eliminar evaluaciones' },

  { codigo: PERMISSIONS.MOTIVO_REPIQUE_VER, nombre: 'Ver motivos de repique' },
  { codigo: PERMISSIONS.MOTIVO_REPIQUE_CREAR, nombre: 'Crear motivos de repique' },
  { codigo: PERMISSIONS.MOTIVO_REPIQUE_EDITAR, nombre: 'Editar motivos de repique' },
  { codigo: PERMISSIONS.MOTIVO_REPIQUE_ELIMINAR, nombre: 'Eliminar motivos de repique' },

  { codigo: PERMISSIONS.MOTIVO_RECUSE_VER, nombre: 'Ver motivos de recuse' },
  { codigo: PERMISSIONS.MOTIVO_RECUSE_CREAR, nombre: 'Crear motivos de recuse' },
  { codigo: PERMISSIONS.MOTIVO_RECUSE_EDITAR, nombre: 'Editar motivos de recuse' },
  { codigo: PERMISSIONS.MOTIVO_RECUSE_ELIMINAR, nombre: 'Eliminar motivos de recuse' },

  { codigo: PERMISSIONS.RACIMO_MOVIMIENTO_VER, nombre: 'Ver movimientos de racimos' },
  { codigo: PERMISSIONS.RACIMO_MOVIMIENTO_CREAR, nombre: 'Crear movimientos de racimos' },
  { codigo: PERMISSIONS.RACIMO_MOVIMIENTO_EDITAR, nombre: 'Editar movimientos de racimos' },
  { codigo: PERMISSIONS.RACIMO_MOVIMIENTO_ELIMINAR, nombre: 'Eliminar movimientos de racimos' },
  { codigo: PERMISSIONS.RACIMO_MOVIMIENTO_EDITAR_HISTORICO, nombre: 'Crear/eliminar movimientos de semanas anteriores' },
  { codigo: PERMISSIONS.RACIMO_MOVIMIENTO_FORZAR_SALDO_NEGATIVO, nombre: 'Forzar registro de movimientos con saldo negativo' },
  { codigo: PERMISSIONS.RACIMO_MOVIMIENTO_ELIMINAR_MASIVO, nombre: 'Eliminar movimientos de racimos en bloque' },

  { codigo: PERMISSIONS.PRODUCCION_VER, nombre: 'Ver producción semanal' },
  { codigo: PERMISSIONS.PRODUCCION_CREAR, nombre: 'Crear producción semanal' },
  { codigo: PERMISSIONS.PRODUCCION_ELIMINAR, nombre: 'Eliminar producción semanal' },
  { codigo: PERMISSIONS.PRODUCCION_ACTUALIZAR_MASIVO, nombre: 'Actualizar en bloque producción semanal ya cargada' },

  { codigo: PERMISSIONS.PRONOSTICO_VER, nombre: 'Ver pronóstico de cajas' },

  { codigo: PERMISSIONS.PRECIPITACION_DIARIA_VER, nombre: 'Ver precipitación diaria y su configuración' },
  { codigo: PERMISSIONS.PRECIPITACION_DIARIA_CONFIGURAR, nombre: 'Programar captura obligatoria de precipitación diaria' },
  { codigo: PERMISSIONS.PRECIPITACION_DIARIA_PROPAGAR_CLIMA, nombre: 'Al registrar Precipitación Diaria, copiar el dato también en Clima' },
  { codigo: PERMISSIONS.PRECIPITACION_DIARIA_SINCRONIZAR, nombre: 'Resolver inconsistencias entre Precipitación Diaria y Clima' },
  { codigo: PERMISSIONS.CLIMA_CREAR, nombre: 'Cargue masivo de clima (precipitación/temperatura/humedad)' },

  { codigo: PERMISSIONS.AREA_LOTE_VER, nombre: 'Ver configuración de área de lotes' },
  { codigo: PERMISSIONS.AREA_LOTE_CONFIGURAR, nombre: 'Programar captura obligatoria de área de lotes' },

  { codigo: PERMISSIONS.CATEGORIA_LABOR_VER, nombre: 'Ver categorías de labor' },
  { codigo: PERMISSIONS.CATEGORIA_LABOR_CREAR, nombre: 'Crear categorías de labor' },
  { codigo: PERMISSIONS.CATEGORIA_LABOR_EDITAR, nombre: 'Editar categorías de labor' },
  { codigo: PERMISSIONS.CATEGORIA_LABOR_ELIMINAR, nombre: 'Eliminar categorías de labor' },

  { codigo: PERMISSIONS.LABOR_VER, nombre: 'Ver labores' },
  { codigo: PERMISSIONS.LABOR_CREAR, nombre: 'Crear labores' },
  { codigo: PERMISSIONS.LABOR_EDITAR, nombre: 'Editar labores' },
  { codigo: PERMISSIONS.LABOR_ELIMINAR, nombre: 'Eliminar labores' },

  { codigo: PERMISSIONS.COLABORADOR_VER, nombre: 'Ver colaboradores' },
  { codigo: PERMISSIONS.COLABORADOR_CREAR, nombre: 'Crear colaboradores' },
  { codigo: PERMISSIONS.COLABORADOR_EDITAR, nombre: 'Editar colaboradores' },
  { codigo: PERMISSIONS.COLABORADOR_ELIMINAR, nombre: 'Eliminar colaboradores' },

  { codigo: PERMISSIONS.LABOR_PROGRAMACION_VER, nombre: 'Ver el calendario de labores' },
  { codigo: PERMISSIONS.LABOR_PROGRAMACION_CREAR, nombre: 'Programar labores (únicas o recurrentes)' },
  { codigo: PERMISSIONS.LABOR_PROGRAMACION_EDITAR, nombre: 'Editar programaciones de labores' },
  { codigo: PERMISSIONS.LABOR_PROGRAMACION_ELIMINAR, nombre: 'Eliminar programaciones de labores' },

  { codigo: PERMISSIONS.LABOR_EVALUACION_VER, nombre: 'Ver evaluación de labores (visitas de sanidad/labor cultural)' },

  { codigo: PERMISSIONS.PROGRAMACION_CORTE_VER, nombre: 'Ver programación de corte' },
  { codigo: PERMISSIONS.PROGRAMACION_CORTE_CREAR, nombre: 'Cargar programación de corte' },
  { codigo: PERMISSIONS.PROGRAMACION_CORTE_ELIMINAR, nombre: 'Eliminar programación de corte' },

  { codigo: PERMISSIONS.SISTEMA_RESET_DATOS, nombre: 'Borrar todos los datos que no vienen de los seeders' },

  { codigo: PERMISSIONS.MENU_MAESTROS, nombre: 'Ver sección Maestros en el menú' },
  { codigo: PERMISSIONS.MENU_MAESTROS_FINCAS, nombre: 'Ver submenú Fincas' },
  { codigo: PERMISSIONS.MENU_MAESTROS_PRODUCTOS, nombre: 'Ver submenú Productos' },
  { codigo: PERMISSIONS.MENU_MAESTROS_GRUPOS_FINCA, nombre: 'Ver submenú Grupos de Finca' },
  { codigo: PERMISSIONS.MENU_MAESTROS_AREA_LOTES, nombre: 'Ver submenú Área de Lotes' },
  { codigo: PERMISSIONS.MENU_MAESTROS_USUARIOS, nombre: 'Ver submenú Usuarios' },
  { codigo: PERMISSIONS.MENU_MAESTROS_ROLES, nombre: 'Ver submenú Roles' },
  { codigo: PERMISSIONS.MENU_MAESTROS_SEMANAS, nombre: 'Ver submenú Semanas' },
  { codigo: PERMISSIONS.MENU_MAESTROS_CALENDARIO, nombre: 'Ver submenú Calendario' },
  { codigo: PERMISSIONS.MENU_MAESTROS_MOTIVOS_REPIQUE, nombre: 'Ver submenú Motivos de Repique' },
  { codigo: PERMISSIONS.MENU_MAESTROS_MOTIVOS_RECUSE, nombre: 'Ver submenú Motivos de Recuse' },
  { codigo: PERMISSIONS.MENU_MAESTROS_CATEGORIAS_LABOR, nombre: 'Ver submenú Categorías de Labor' },
  { codigo: PERMISSIONS.MENU_MAESTROS_LABORES, nombre: 'Ver submenú Labores' },
  { codigo: PERMISSIONS.MENU_MAESTROS_ESTADIOS_SIGATOKA, nombre: 'Ver submenú Estadios de Sigatoka' },
  { codigo: PERMISSIONS.MENU_MAESTROS_VERSION_APP, nombre: 'Ver submenú Versión App Móvil' },
  { codigo: PERMISSIONS.MENU_MAESTROS_COLABORADORES, nombre: 'Ver submenú Colaboradores' },

  { codigo: PERMISSIONS.MENU_RACIMOS, nombre: 'Ver sección Racimos en el menú' },
  { codigo: PERMISSIONS.MENU_RACIMOS_MOVIMIENTOS, nombre: 'Ver submenú Movimientos' },
  { codigo: PERMISSIONS.MENU_RACIMOS_REGISTRAR, nombre: 'Ver submenús Registrar Embolse/Repique/Corte' },
  { codigo: PERMISSIONS.MENU_RACIMOS_SALDOS_LOTES_CINTAS, nombre: 'Ver submenú Saldos × Lotes y Cintas' },
  { codigo: PERMISSIONS.MENU_RACIMOS_REPORTE_EMBOLSES, nombre: 'Ver submenú Reporte de Embolses' },

  { codigo: PERMISSIONS.MENU_LABORES, nombre: 'Ver sección Labores en el menú' },
  { codigo: PERMISSIONS.MENU_LABORES_CALENDARIO, nombre: 'Ver submenú Calendario de Labores' },
  { codigo: PERMISSIONS.MENU_LABORES_ESTADOS, nombre: 'Ver submenú Estados de Labores' },

  { codigo: PERMISSIONS.MENU_SANIDAD_VEGETAL, nombre: 'Ver sección Sanidad Vegetal en el menú' },
  { codigo: PERMISSIONS.MENU_SANIDAD_VEGETAL_EVALUACIONES, nombre: 'Ver submenú Evaluaciones' },
  { codigo: PERMISSIONS.MENU_SANIDAD_VEGETAL_GRAFICOS, nombre: 'Ver submenú Gráficos' },
  { codigo: PERMISSIONS.MENU_SANIDAD_VEGETAL_LABORES, nombre: 'Ver submenú Evaluación de Labores' },
  { codigo: PERMISSIONS.MENU_SANIDAD_VEGETAL_ALERTAS, nombre: 'Ver submenú Alertas' },

  { codigo: PERMISSIONS.MENU_PRECIPITACION_DIARIA, nombre: 'Ver ítem de menú Precipitación Diaria' },
  { codigo: PERMISSIONS.MENU_PRODUCCION_SEMANAL, nombre: 'Ver ítem de menú Producción Semanal' },
  { codigo: PERMISSIONS.MENU_PRONOSTICO, nombre: 'Ver ítem de menú Pronóstico de Cajas' },
  { codigo: PERMISSIONS.MENU_CARGUE_MASIVO, nombre: 'Ver ítem de menú Cargue Masivo' },
  { codigo: PERMISSIONS.MENU_PROGRAMACION_CORTE, nombre: 'Ver ítem de menú Programación de Corte' },
  { codigo: PERMISSIONS.MENU_REPORTES, nombre: 'Ver ítem de menú Reportes' },

  { codigo: PERMISSIONS.INVENTARIO_DASHBOARD_VER, nombre: 'Ver dashboard de Inventarios' },
  { codigo: PERMISSIONS.INVENTARIO_CATEGORIAS_VER, nombre: 'Ver categorías de productos (Inventarios)' },
  { codigo: PERMISSIONS.INVENTARIO_CATEGORIAS_CREAR, nombre: 'Crear categorías de productos' },
  { codigo: PERMISSIONS.INVENTARIO_CATEGORIAS_EDITAR, nombre: 'Editar categorías de productos' },
  { codigo: PERMISSIONS.INVENTARIO_CATEGORIAS_ELIMINAR, nombre: 'Eliminar categorías de productos' },
  { codigo: PERMISSIONS.INVENTARIO_UNIDADES_VER, nombre: 'Ver unidades de medida' },
  { codigo: PERMISSIONS.INVENTARIO_UNIDADES_CREAR, nombre: 'Crear unidades de medida' },
  { codigo: PERMISSIONS.INVENTARIO_UNIDADES_EDITAR, nombre: 'Editar unidades de medida' },
  { codigo: PERMISSIONS.INVENTARIO_UNIDADES_ELIMINAR, nombre: 'Eliminar unidades de medida' },
  { codigo: PERMISSIONS.INVENTARIO_PRODUCTOS_VER, nombre: 'Ver productos de inventario' },
  { codigo: PERMISSIONS.INVENTARIO_PRODUCTOS_CREAR, nombre: 'Crear productos de inventario' },
  { codigo: PERMISSIONS.INVENTARIO_PRODUCTOS_EDITAR, nombre: 'Editar productos de inventario' },
  { codigo: PERMISSIONS.INVENTARIO_PRODUCTOS_ELIMINAR, nombre: 'Eliminar productos de inventario' },
  { codigo: PERMISSIONS.INVENTARIO_ALMACENES_VER, nombre: 'Ver almacenes' },
  { codigo: PERMISSIONS.INVENTARIO_ALMACENES_CREAR, nombre: 'Crear almacenes' },
  { codigo: PERMISSIONS.INVENTARIO_ALMACENES_EDITAR, nombre: 'Editar almacenes' },
  { codigo: PERMISSIONS.INVENTARIO_ALMACENES_ELIMINAR, nombre: 'Eliminar almacenes' },
  { codigo: PERMISSIONS.MENU_INVENTARIOS, nombre: 'Ver sección Inventarios en el menú' },
  { codigo: PERMISSIONS.MENU_INVENTARIOS_DASHBOARD, nombre: 'Ver submenú Dashboard (Inventarios)' },
  { codigo: PERMISSIONS.MENU_INVENTARIOS_PRODUCTOS, nombre: 'Ver submenú Productos (Inventarios)' },
  { codigo: PERMISSIONS.MENU_INVENTARIOS_CATEGORIAS, nombre: 'Ver submenú Categorías (Inventarios)' },
  { codigo: PERMISSIONS.MENU_INVENTARIOS_UNIDADES, nombre: 'Ver submenú Unidades (Inventarios)' },
  { codigo: PERMISSIONS.MENU_INVENTARIOS_ALMACENES, nombre: 'Ver submenú Almacenes (Inventarios)' },
  { codigo: PERMISSIONS.INVENTARIO_MOTIVOS_VER, nombre: 'Ver motivos (Inventarios)' },
  { codigo: PERMISSIONS.INVENTARIO_MOTIVOS_CREAR, nombre: 'Crear motivos' },
  { codigo: PERMISSIONS.INVENTARIO_MOTIVOS_EDITAR, nombre: 'Editar motivos' },
  { codigo: PERMISSIONS.INVENTARIO_MOTIVOS_ELIMINAR, nombre: 'Eliminar motivos' },
  { codigo: PERMISSIONS.INVENTARIO_MOVIMIENTOS_VER, nombre: 'Ver movimientos de inventario' },
  { codigo: PERMISSIONS.INVENTARIO_MOVIMIENTOS_CREAR, nombre: 'Crear movimientos de inventario' },
  { codigo: PERMISSIONS.MENU_INVENTARIOS_MOTIVOS, nombre: 'Ver submenú Motivos (Inventarios)' },
  { codigo: PERMISSIONS.MENU_INVENTARIOS_MOVIMIENTOS, nombre: 'Ver submenú Movimientos (Inventarios)' },
];
