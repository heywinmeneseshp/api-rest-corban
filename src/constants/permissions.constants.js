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

  PRODUCCION_VER: 'produccion.ver',
  PRODUCCION_CREAR: 'produccion.crear',

  // Captura diaria de precipitación desde app-corbana (distinta del registro
  // de clima que hace la app móvil): un rol programado debe digitar la
  // precipitación del día anterior o queda bloqueado con un modal hasta
  // ponerse al día. VER es para listar/consultar registros y la
  // configuración; CONFIGURAR es para programar qué rol/finca/semana exige
  // el registro (solo administración).
  PRECIPITACION_DIARIA_VER: 'precipitacion_diaria.ver',
  PRECIPITACION_DIARIA_CONFIGURAR: 'precipitacion_diaria.configurar',

  SISTEMA_RESET_DATOS: 'sistema.reset_datos',
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

  { codigo: PERMISSIONS.PRODUCCION_VER, nombre: 'Ver producción semanal' },
  { codigo: PERMISSIONS.PRODUCCION_CREAR, nombre: 'Crear producción semanal' },

  { codigo: PERMISSIONS.PRECIPITACION_DIARIA_VER, nombre: 'Ver precipitación diaria y su configuración' },
  { codigo: PERMISSIONS.PRECIPITACION_DIARIA_CONFIGURAR, nombre: 'Programar captura obligatoria de precipitación diaria' },

  { codigo: PERMISSIONS.SISTEMA_RESET_DATOS, nombre: 'Borrar todos los datos que no vienen de los seeders' },
];
