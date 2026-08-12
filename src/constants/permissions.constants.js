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

  PLANTA_VER: 'planta.ver',
  PLANTA_CREAR: 'planta.crear',
  PLANTA_EDITAR: 'planta.editar',
  PLANTA_ELIMINAR: 'planta.eliminar',

  CATEGORIA_PLANTA_VER: 'categoria_planta.ver',
  CATEGORIA_PLANTA_CREAR: 'categoria_planta.crear',
  CATEGORIA_PLANTA_EDITAR: 'categoria_planta.editar',
  CATEGORIA_PLANTA_ELIMINAR: 'categoria_planta.eliminar',

  TIPO_EVALUACION_VER: 'tipo_evaluacion.ver',
  TIPO_EVALUACION_CREAR: 'tipo_evaluacion.crear',
  TIPO_EVALUACION_EDITAR: 'tipo_evaluacion.editar',
  TIPO_EVALUACION_ELIMINAR: 'tipo_evaluacion.eliminar',

  SEMANA_VER: 'semana.ver',
  SEMANA_CREAR: 'semana.crear',
  SEMANA_EDITAR: 'semana.editar',
  SEMANA_ELIMINAR: 'semana.eliminar',

  EVALUACION_VER: 'evaluacion.ver',
  EVALUACION_CREAR: 'evaluacion.crear',
  EVALUACION_EDITAR: 'evaluacion.editar',
  EVALUACION_ELIMINAR: 'evaluacion.eliminar',

  INFECCION_VER: 'infeccion.ver',
  INFECCION_CREAR: 'infeccion.crear',
  INFECCION_EDITAR: 'infeccion.editar',

  CONTEO_HOJAS_VER: 'conteo_hojas.ver',
  CONTEO_HOJAS_CREAR: 'conteo_hojas.crear',
  CONTEO_HOJAS_EDITAR: 'conteo_hojas.editar',

  SUMA_BRUTA_VER: 'suma_bruta.ver',
  SUMA_BRUTA_CREAR: 'suma_bruta.crear',
  SUMA_BRUTA_EDITAR: 'suma_bruta.editar',

  // Valores numéricos configurables por estadio de Sigatoka (1-, 1+, 2-, …,
  // 6+, 6-) usados para calcular automáticamente la Suma Bruta de una
  // evaluación. Solo lo administra un rol de administración.
  ESTADIO_SIGATOKA_VER: 'estadio_sigatoka.ver',
  ESTADIO_SIGATOKA_CREAR: 'estadio_sigatoka.crear',
  ESTADIO_SIGATOKA_EDITAR: 'estadio_sigatoka.editar',
  ESTADIO_SIGATOKA_ELIMINAR: 'estadio_sigatoka.eliminar',

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

  LABOR_PROGRAMACION_VER: 'labor_programacion.ver',
  LABOR_PROGRAMACION_CREAR: 'labor_programacion.crear',
  LABOR_PROGRAMACION_EDITAR: 'labor_programacion.editar',
  LABOR_PROGRAMACION_ELIMINAR: 'labor_programacion.eliminar',

  // Reporte de visitas de sanidad/labor cultural registradas desde la app
  // móvil (Sanidad Vegetal › Evaluación de Labores). Antes reutilizaba
  // labor.ver (el maestro de Labores), lo que impedía asignarlo aparte.
  LABOR_EVALUACION_VER: 'labor_evaluacion.ver',

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

  // Ítems planos del menú (hoy sin submenú propio, un solo código cada uno).
  MENU_PRECIPITACION_DIARIA: 'menu.precipitacion_diaria',
  MENU_PRODUCCION_SEMANAL: 'menu.produccion_semanal',
  MENU_PRONOSTICO: 'menu.pronostico',
  MENU_CARGUE_MASIVO: 'menu.cargue_masivo',
  MENU_REPORTES: 'menu.reportes',
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

  { codigo: PERMISSIONS.GRUPO_FINCA_VER, nombre: 'Ver grupos de finca' },
  { codigo: PERMISSIONS.GRUPO_FINCA_CREAR, nombre: 'Crear grupos de finca' },
  { codigo: PERMISSIONS.GRUPO_FINCA_EDITAR, nombre: 'Editar grupos de finca' },
  { codigo: PERMISSIONS.GRUPO_FINCA_ELIMINAR, nombre: 'Eliminar grupos de finca' },

  { codigo: PERMISSIONS.LOTE_VER, nombre: 'Ver lotes' },
  { codigo: PERMISSIONS.LOTE_CREAR, nombre: 'Crear lotes' },
  { codigo: PERMISSIONS.LOTE_EDITAR, nombre: 'Editar lotes' },
  { codigo: PERMISSIONS.LOTE_ELIMINAR, nombre: 'Eliminar lotes' },

  { codigo: PERMISSIONS.PLANTA_VER, nombre: 'Ver plantas' },
  { codigo: PERMISSIONS.PLANTA_CREAR, nombre: 'Crear plantas' },
  { codigo: PERMISSIONS.PLANTA_EDITAR, nombre: 'Editar plantas' },
  { codigo: PERMISSIONS.PLANTA_ELIMINAR, nombre: 'Eliminar plantas' },

  { codigo: PERMISSIONS.CATEGORIA_PLANTA_VER, nombre: 'Ver categorías de planta' },
  { codigo: PERMISSIONS.CATEGORIA_PLANTA_CREAR, nombre: 'Crear categorías de planta' },
  { codigo: PERMISSIONS.CATEGORIA_PLANTA_EDITAR, nombre: 'Editar categorías de planta' },
  { codigo: PERMISSIONS.CATEGORIA_PLANTA_ELIMINAR, nombre: 'Eliminar categorías de planta' },

  { codigo: PERMISSIONS.TIPO_EVALUACION_VER, nombre: 'Ver tipos de evaluación' },
  { codigo: PERMISSIONS.TIPO_EVALUACION_CREAR, nombre: 'Crear tipos de evaluación' },
  { codigo: PERMISSIONS.TIPO_EVALUACION_EDITAR, nombre: 'Editar tipos de evaluación' },
  { codigo: PERMISSIONS.TIPO_EVALUACION_ELIMINAR, nombre: 'Eliminar tipos de evaluación' },

  { codigo: PERMISSIONS.SEMANA_VER, nombre: 'Ver semanas' },
  { codigo: PERMISSIONS.SEMANA_CREAR, nombre: 'Crear semanas' },
  { codigo: PERMISSIONS.SEMANA_EDITAR, nombre: 'Editar semanas' },
  { codigo: PERMISSIONS.SEMANA_ELIMINAR, nombre: 'Eliminar semanas' },

  { codigo: PERMISSIONS.EVALUACION_VER, nombre: 'Ver evaluaciones' },
  { codigo: PERMISSIONS.EVALUACION_CREAR, nombre: 'Crear evaluaciones' },
  { codigo: PERMISSIONS.EVALUACION_EDITAR, nombre: 'Editar evaluaciones' },
  { codigo: PERMISSIONS.EVALUACION_ELIMINAR, nombre: 'Eliminar evaluaciones' },

  { codigo: PERMISSIONS.INFECCION_VER, nombre: 'Ver infecciones' },
  { codigo: PERMISSIONS.INFECCION_CREAR, nombre: 'Crear infecciones' },
  { codigo: PERMISSIONS.INFECCION_EDITAR, nombre: 'Editar infecciones' },

  { codigo: PERMISSIONS.CONTEO_HOJAS_VER, nombre: 'Ver conteo de hojas' },
  { codigo: PERMISSIONS.CONTEO_HOJAS_CREAR, nombre: 'Crear conteo de hojas' },
  { codigo: PERMISSIONS.CONTEO_HOJAS_EDITAR, nombre: 'Editar conteo de hojas' },

  { codigo: PERMISSIONS.SUMA_BRUTA_VER, nombre: 'Ver suma bruta' },
  { codigo: PERMISSIONS.SUMA_BRUTA_CREAR, nombre: 'Crear suma bruta' },
  { codigo: PERMISSIONS.SUMA_BRUTA_EDITAR, nombre: 'Editar suma bruta' },

  { codigo: PERMISSIONS.ESTADIO_SIGATOKA_VER, nombre: 'Ver estadios de Sigatoka' },
  { codigo: PERMISSIONS.ESTADIO_SIGATOKA_CREAR, nombre: 'Crear estadios de Sigatoka' },
  { codigo: PERMISSIONS.ESTADIO_SIGATOKA_EDITAR, nombre: 'Editar estadios de Sigatoka' },
  { codigo: PERMISSIONS.ESTADIO_SIGATOKA_ELIMINAR, nombre: 'Eliminar estadios de Sigatoka' },

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

  { codigo: PERMISSIONS.LABOR_PROGRAMACION_VER, nombre: 'Ver el calendario de labores' },
  { codigo: PERMISSIONS.LABOR_PROGRAMACION_CREAR, nombre: 'Programar labores (únicas o recurrentes)' },
  { codigo: PERMISSIONS.LABOR_PROGRAMACION_EDITAR, nombre: 'Editar programaciones de labores' },
  { codigo: PERMISSIONS.LABOR_PROGRAMACION_ELIMINAR, nombre: 'Eliminar programaciones de labores' },

  { codigo: PERMISSIONS.LABOR_EVALUACION_VER, nombre: 'Ver evaluación de labores (visitas de sanidad/labor cultural)' },

  { codigo: PERMISSIONS.SISTEMA_RESET_DATOS, nombre: 'Borrar todos los datos que no vienen de los seeders' },

  { codigo: PERMISSIONS.MENU_MAESTROS, nombre: 'Ver sección Maestros en el menú' },
  { codigo: PERMISSIONS.MENU_MAESTROS_FINCAS, nombre: 'Ver submenú Fincas' },
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

  { codigo: PERMISSIONS.MENU_PRECIPITACION_DIARIA, nombre: 'Ver ítem de menú Precipitación Diaria' },
  { codigo: PERMISSIONS.MENU_PRODUCCION_SEMANAL, nombre: 'Ver ítem de menú Producción Semanal' },
  { codigo: PERMISSIONS.MENU_PRONOSTICO, nombre: 'Ver ítem de menú Pronóstico de Cajas' },
  { codigo: PERMISSIONS.MENU_CARGUE_MASIVO, nombre: 'Ver ítem de menú Cargue Masivo' },
  { codigo: PERMISSIONS.MENU_REPORTES, nombre: 'Ver ítem de menú Reportes' },
];
