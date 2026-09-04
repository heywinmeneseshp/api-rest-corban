import { User } from './models/user.model.js';
import { Role } from './models/role.model.js';
import { Permiso } from './models/permiso.model.js';
import { MenuItem } from './models/menuItem.model.js';
import { RefreshToken } from './models/refreshToken.model.js';
import { UsuarioRol, RolPermiso, UsuarioFinca } from './models/pivotModels.js';

import { Finca } from './models/finca.model.js';
import { GrupoFinca } from './models/grupoFinca.model.js';
import { Lote } from './models/lote.model.js';
import { Planta } from './models/planta.model.js';
import { CategoriaPlanta } from './models/categoriaPlanta.model.js';
import { TipoEvaluacion } from './models/tipoEvaluacion.model.js';
import { Semana } from './models/semana.model.js';
import { Evaluacion } from './models/evaluacion.model.js';
import { Infeccion } from './models/infeccion.model.js';
import { HojaInfectada } from './models/hojaInfectada.model.js';
import { ConteoHojas } from './models/conteoHojas.model.js';
import { SumaBruta } from './models/sumaBruta.model.js';
import { EstadioHoja } from './models/estadioHoja.model.js';
import { Configuracion } from './models/configuracion.model.js';
import { LoteAreaProduccion } from './models/loteAreaProduccion.model.js';
import { LoteAreaConfig } from './models/loteAreaConfig.model.js';
import { MotivoRepique } from './models/motivoRepique.model.js';
import { MotivoRecuse } from './models/motivoRecuse.model.js';
import { RacimoMovimiento } from './models/racimoMovimiento.model.js';
import { ProduccionSemanal } from './models/produccionSemanal.model.js';
import { EstimacionFinca } from './models/estimacionFinca.model.js';
import { CategoriaLabor } from './models/categoriaLabor.model.js';
import { Labor } from './models/labor.model.js';
import { LaborSerie } from './models/laborSerie.model.js';
import { LaborSerieLote } from './models/laborSerieLote.model.js';
import { LaborOcurrencia } from './models/laborOcurrencia.model.js';
import { EstadioSigatoka } from './models/estadioSigatoka.model.js';
import { Colaborador } from './models/colaborador.model.js';
import { ColaboradorLabor } from './models/colaboradorLabor.model.js';
import { ProgramacionCorte } from './models/programacionCorte.model.js';
import { Producto } from './models/producto.model.js';
import { RechazoCorte } from './models/rechazoCorte.model.js';
import { PrecipitacionDiariaConfig } from './models/precipitacionDiariaConfig.model.js';
import { PrecipitacionDiaria } from './models/precipitacionDiaria.model.js';
import { Articulo } from './models/articulo.model.js';
import { ArticuloCategoria } from './models/articuloCategoria.model.js';
import { UnidadMedida } from './models/unidadMedida.model.js';
import { UnidadConversion } from './models/unidadConversion.model.js';
import { Almacen } from './models/almacen.model.js';
import { Motivo } from './models/motivo.model.js';
import { MovimientoInventario } from './models/movimientoInventario.model.js';
import { Mezcla } from './models/mezcla.model.js';
import { MezclaVersion } from './models/mezclaVersion.model.js';
import { MezclaComponente } from './models/mezclaComponente.model.js';
import { Elaboracion } from './models/elaboracion.model.js';
import { Proforma } from './models/proforma.model.js';
import { ProformaDetalle } from './models/proformaDetalle.model.js';
import { Equipo } from './models/equipo.model.js';
import { EquipoTipo } from './models/equipoTipo.model.js';
import { FincaSemanaLiquidacion } from './models/fincaSemanaLiquidacion.model.js';
import { EquipoComponente } from './models/equipoComponente.model.js';
import { PlanMantenimiento } from './models/planMantenimiento.model.js';
import { ProgramacionMantenimiento } from './models/programacionMantenimiento.model.js';
import { OrdenMantenimiento } from './models/ordenMantenimiento.model.js';
import { OrdenDetalle } from './models/ordenDetalle.model.js';
import { OrdenManoObra } from './models/ordenManoObra.model.js';
import { OrdenServicio } from './models/ordenServicio.model.js';
import { Proveedor } from './models/proveedor.model.js';
import { Existencia } from './models/existencia.model.js';
import { Factura } from './models/factura.model.js';
import { FacturaDetalle } from './models/facturaDetalle.model.js';

const withAuditAssociations = (TargetModel) => {
  TargetModel.belongsTo(User, { as: 'creadoPor', foreignKey: 'createdBy' });
  TargetModel.belongsTo(User, { as: 'actualizadoPor', foreignKey: 'updatedBy' });
  TargetModel.belongsTo(User, { as: 'eliminadoPor', foreignKey: 'deletedBy' });
};

const withAuditAssociationsNoDelete = (TargetModel) => {
  TargetModel.belongsTo(User, { as: 'creadoPor', foreignKey: 'createdBy' });
  TargetModel.belongsTo(User, { as: 'actualizadoPor', foreignKey: 'updatedBy' });
};

let associationsReady = false;

export const setupAssociations = () => {
  // Idempotente: en entornos serverless (Vercel) un mismo contenedor
  // "caliente" puede invocar esta función más de una vez entre requests;
  // Sequelize no permite redefinir la misma asociación/alias dos veces.
  if (associationsReady) return;
  associationsReady = true;

  // Usuarios <-> Roles (N:M)
  User.belongsToMany(Role, {
    through: UsuarioRol,
    foreignKey: 'userId',
    otherKey: 'roleId',
    as: 'roles',
  });
  Role.belongsToMany(User, {
    through: UsuarioRol,
    foreignKey: 'roleId',
    otherKey: 'userId',
    as: 'usuarios',
  });
  UsuarioRol.belongsTo(User, { foreignKey: 'userId', as: 'usuario' });
  UsuarioRol.belongsTo(Role, { foreignKey: 'roleId', as: 'rol' });

  // Usuarios <-> Fincas (N:M) — qué fincas puede administrar/ver cada
  // usuario. Administrador se salta esta restricción (ver auth.service.js).
  User.belongsToMany(Finca, {
    through: UsuarioFinca,
    foreignKey: 'userId',
    otherKey: 'fincaId',
    as: 'fincas',
  });
  Finca.belongsToMany(User, {
    through: UsuarioFinca,
    foreignKey: 'fincaId',
    otherKey: 'userId',
    as: 'usuarios',
  });
  UsuarioFinca.belongsTo(User, { foreignKey: 'userId', as: 'usuario' });
  UsuarioFinca.belongsTo(Finca, { foreignKey: 'fincaId', as: 'finca' });

  // Roles <-> Permisos (N:M)
  Role.belongsToMany(Permiso, {
    through: RolPermiso,
    foreignKey: 'roleId',
    otherKey: 'permisoId',
    as: 'permisos',
  });
  Permiso.belongsToMany(Role, {
    through: RolPermiso,
    foreignKey: 'permisoId',
    otherKey: 'roleId',
    as: 'roles',
  });
  RolPermiso.belongsTo(Role, { foreignKey: 'roleId', as: 'rol' });
  RolPermiso.belongsTo(Permiso, { foreignKey: 'permisoId', as: 'permiso' });

  // Menu (árbol) + permiso asociado
  MenuItem.belongsTo(MenuItem, { foreignKey: 'parentId', as: 'padre' });
  MenuItem.hasMany(MenuItem, { foreignKey: 'parentId', as: 'hijos' });
  MenuItem.belongsTo(Permiso, { foreignKey: 'permisoId', as: 'permiso' });

  // Refresh tokens
  User.hasMany(RefreshToken, { foreignKey: 'userId', as: 'refreshTokens' });
  RefreshToken.belongsTo(User, { foreignKey: 'userId', as: 'usuario' });

  // Auditoría (created_by / updated_by / deleted_by -> users.id) — Fase 1
  withAuditAssociations(Role);
  withAuditAssociations(Permiso);
  withAuditAssociations(MenuItem);
  withAuditAssociations(User);

  // Ubicación agrícola: Fincas -> Lotes -> Plantas
  Finca.hasMany(Lote, { foreignKey: 'fincaId', as: 'lotes' });
  Lote.belongsTo(Finca, { foreignKey: 'fincaId', as: 'finca' });

  // Grupo de Finca: fincas registradas por separado que operativamente son
  // una sola (ver utils/fincaScope.js). Opt-in: grupoFincaId nulo = sin
  // agrupar, comportamiento idéntico al de antes de esta feature.
  GrupoFinca.hasMany(Finca, { foreignKey: 'grupoFincaId', as: 'fincas' });
  Finca.belongsTo(GrupoFinca, { foreignKey: 'grupoFincaId', as: 'grupoFinca' });

  Lote.hasMany(Planta, { foreignKey: 'loteId', as: 'plantas' });
  Planta.belongsTo(Lote, { foreignKey: 'loteId', as: 'lote' });

  // Historial de área en producción (append-only, sin updated_by)
  Lote.hasMany(LoteAreaProduccion, { foreignKey: 'loteId', as: 'areaProduccionHistorial' });
  LoteAreaProduccion.belongsTo(Lote, { foreignKey: 'loteId', as: 'lote' });
  LoteAreaProduccion.belongsTo(User, { foreignKey: 'createdBy', as: 'creadoPor' });

  // Configuración de campaña de Área de Lotes: qué rol debe confirmar el
  // área total y en producción de todos los lotes de una finca, a partir de
  // qué fecha (ver services/agricola/loteAreaConfig.service.js).
  Finca.hasMany(LoteAreaConfig, { foreignKey: 'fincaId', as: 'areaLoteConfigs' });
  LoteAreaConfig.belongsTo(Finca, { foreignKey: 'fincaId', as: 'finca' });
  Role.hasMany(LoteAreaConfig, { foreignKey: 'rolId', as: 'areaLoteConfigs' });
  LoteAreaConfig.belongsTo(Role, { foreignKey: 'rolId', as: 'rol' });

  CategoriaPlanta.hasMany(Planta, { foreignKey: 'categoriaPlantaId', as: 'plantas' });
  Planta.belongsTo(CategoriaPlanta, { foreignKey: 'categoriaPlantaId', as: 'categoriaPlanta' });

  // Evaluaciones
  Planta.hasMany(Evaluacion, { foreignKey: 'plantaId', as: 'evaluaciones' });
  Evaluacion.belongsTo(Planta, { foreignKey: 'plantaId', as: 'planta' });

  User.hasMany(Evaluacion, { foreignKey: 'usuarioId', as: 'evaluaciones' });
  Evaluacion.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });

  TipoEvaluacion.hasMany(Evaluacion, { foreignKey: 'tipoEvaluacionId', as: 'evaluaciones' });
  Evaluacion.belongsTo(TipoEvaluacion, { foreignKey: 'tipoEvaluacionId', as: 'tipoEvaluacion' });

  Semana.hasMany(Evaluacion, { foreignKey: 'semanaId', as: 'evaluaciones' });
  Evaluacion.belongsTo(Semana, { foreignKey: 'semanaId', as: 'semana' });

  // Infección (1:1 con evaluación) + hojas infectadas (1:N con infección)
  Evaluacion.hasOne(Infeccion, { foreignKey: 'evaluacionId', as: 'infeccion' });
  Infeccion.belongsTo(Evaluacion, { foreignKey: 'evaluacionId', as: 'evaluacion' });

  Infeccion.hasMany(HojaInfectada, { foreignKey: 'infeccionId', as: 'hojas' });
  HojaInfectada.belongsTo(Infeccion, { foreignKey: 'infeccionId', as: 'infeccion' });

  // Conteo de hojas (1:1 con evaluación, referencia semana de embolse)
  Evaluacion.hasOne(ConteoHojas, { foreignKey: 'evaluacionId', as: 'conteoHojas' });
  ConteoHojas.belongsTo(Evaluacion, { foreignKey: 'evaluacionId', as: 'evaluacion' });
  Semana.hasMany(ConteoHojas, { foreignKey: 'semanaEmbolseId', as: 'conteosEmbolse' });
  ConteoHojas.belongsTo(Semana, { foreignKey: 'semanaEmbolseId', as: 'semanaEmbolse' });

  // Suma bruta (1:1 con evaluación) + estadios por hoja (1:N con suma bruta)
  Evaluacion.hasOne(SumaBruta, { foreignKey: 'evaluacionId', as: 'sumaBruta' });
  SumaBruta.belongsTo(Evaluacion, { foreignKey: 'evaluacionId', as: 'evaluacion' });

  SumaBruta.hasMany(EstadioHoja, { foreignKey: 'sumaBrutaId', as: 'estadios' });
  EstadioHoja.belongsTo(SumaBruta, { foreignKey: 'sumaBrutaId', as: 'sumaBruta' });

  // Inventario de racimos embolsados: movimientos por cohorte (finca + lote
  // + semana de embolse). EMBOLSE suma; REPIQUE/RECUSE/PROCESADO restan.
  Finca.hasMany(RacimoMovimiento, { foreignKey: 'fincaId', as: 'racimoMovimientos' });
  RacimoMovimiento.belongsTo(Finca, { foreignKey: 'fincaId', as: 'finca' });

  Lote.hasMany(RacimoMovimiento, { foreignKey: 'loteId', as: 'racimoMovimientos' });
  RacimoMovimiento.belongsTo(Lote, { foreignKey: 'loteId', as: 'lote' });

  Semana.hasMany(RacimoMovimiento, { foreignKey: 'semanaEmbolseId', as: 'racimosEmbolsados' });
  RacimoMovimiento.belongsTo(Semana, { foreignKey: 'semanaEmbolseId', as: 'semanaEmbolse' });

  Semana.hasMany(RacimoMovimiento, { foreignKey: 'semanaRegistroId', as: 'racimosRegistrados' });
  RacimoMovimiento.belongsTo(Semana, { foreignKey: 'semanaRegistroId', as: 'semanaRegistro' });

  MotivoRepique.hasMany(RacimoMovimiento, { foreignKey: 'motivoRepiqueId', as: 'movimientos' });
  RacimoMovimiento.belongsTo(MotivoRepique, { foreignKey: 'motivoRepiqueId', as: 'motivoRepique' });

  MotivoRecuse.hasMany(RacimoMovimiento, { foreignKey: 'motivoRecuseId', as: 'movimientos' });
  RacimoMovimiento.belongsTo(MotivoRecuse, { foreignKey: 'motivoRecuseId', as: 'motivoRecuse' });

  // Liquidación de semana por finca — informativa (no bloquea registro).
  Finca.hasMany(FincaSemanaLiquidacion, { foreignKey: 'fincaId', as: 'liquidaciones' });
  FincaSemanaLiquidacion.belongsTo(Finca, { foreignKey: 'fincaId', as: 'finca' });

  Semana.hasMany(FincaSemanaLiquidacion, { foreignKey: 'semanaId', as: 'liquidacionesFinca' });
  FincaSemanaLiquidacion.belongsTo(Semana, { foreignKey: 'semanaId', as: 'semana' });

  // Producción semanal: cajas de 20kg por finca y semana
  Finca.hasMany(ProduccionSemanal, { foreignKey: 'fincaId', as: 'produccionSemanal' });
  ProduccionSemanal.belongsTo(Finca, { foreignKey: 'fincaId', as: 'finca' });

  Semana.hasMany(ProduccionSemanal, { foreignKey: 'semanaId', as: 'produccionSemanal' });
  ProduccionSemanal.belongsTo(Semana, { foreignKey: 'semanaId', as: 'semana' });

  // Estimaciones de cajas por finca y semana (propias de cada usuario)
  Finca.hasMany(EstimacionFinca, { foreignKey: 'fincaId', as: 'estimaciones' });
  EstimacionFinca.belongsTo(Finca, { foreignKey: 'fincaId', as: 'finca' });

  Semana.hasMany(EstimacionFinca, { foreignKey: 'semanaId', as: 'estimaciones' });
  EstimacionFinca.belongsTo(Semana, { foreignKey: 'semanaId', as: 'semana' });

  // Auditoría — Fase 2 (maestras con deleted_by, transaccionales sin deleted_by)
  withAuditAssociations(Finca);
  withAuditAssociations(GrupoFinca);
  withAuditAssociations(Lote);
  withAuditAssociations(LoteAreaConfig);
  withAuditAssociations(Planta);
  withAuditAssociations(CategoriaPlanta);
  withAuditAssociations(TipoEvaluacion);
  withAuditAssociations(Semana);
  withAuditAssociationsNoDelete(Evaluacion);
  withAuditAssociationsNoDelete(Infeccion);
  withAuditAssociationsNoDelete(HojaInfectada);
  withAuditAssociationsNoDelete(ConteoHojas);
  withAuditAssociationsNoDelete(SumaBruta);
  withAuditAssociationsNoDelete(EstadioHoja);
  withAuditAssociations(MotivoRepique);
  withAuditAssociations(MotivoRecuse);
  withAuditAssociations(RacimoMovimiento);
  withAuditAssociations(ProduccionSemanal);
  withAuditAssociations(EstimacionFinca);

  // Calendario de Labores: CategoriaLabor -> Labor -> LaborSerie -> (LaborSerieLote | LaborOcurrencia)
  CategoriaLabor.hasMany(Labor, { foreignKey: 'categoriaLaborId', as: 'labores' });
  Labor.belongsTo(CategoriaLabor, { foreignKey: 'categoriaLaborId', as: 'categoria' });

  Labor.hasMany(LaborSerie, { foreignKey: 'laborId', as: 'series' });
  LaborSerie.belongsTo(Labor, { foreignKey: 'laborId', as: 'labor' });

  Finca.hasMany(LaborSerie, { foreignKey: 'fincaId', as: 'laborSeries' });
  LaborSerie.belongsTo(Finca, { foreignKey: 'fincaId', as: 'finca' });

  Lote.hasMany(LaborSerie, { foreignKey: 'loteId', as: 'laborSeries' });
  LaborSerie.belongsTo(Lote, { foreignKey: 'loteId', as: 'lote' });

  LaborSerie.hasMany(LaborSerieLote, { foreignKey: 'laborSerieId', as: 'lotesRotacion' });
  LaborSerieLote.belongsTo(LaborSerie, { foreignKey: 'laborSerieId', as: 'serie' });
  Lote.hasMany(LaborSerieLote, { foreignKey: 'loteId', as: 'laborSerieLotes' });
  LaborSerieLote.belongsTo(Lote, { foreignKey: 'loteId', as: 'lote' });

  LaborSerie.hasMany(LaborOcurrencia, { foreignKey: 'serieId', as: 'ocurrencias' });
  LaborOcurrencia.belongsTo(LaborSerie, { foreignKey: 'serieId', as: 'serie' });

  Finca.hasMany(LaborOcurrencia, { foreignKey: 'fincaId', as: 'laborOcurrencias' });
  LaborOcurrencia.belongsTo(Finca, { foreignKey: 'fincaId', as: 'finca' });

  Lote.hasMany(LaborOcurrencia, { foreignKey: 'loteId', as: 'laborOcurrencias' });
  LaborOcurrencia.belongsTo(Lote, { foreignKey: 'loteId', as: 'lote' });

  Labor.hasMany(LaborOcurrencia, { foreignKey: 'laborId', as: 'ocurrencias' });
  LaborOcurrencia.belongsTo(Labor, { foreignKey: 'laborId', as: 'labor' });

  withAuditAssociations(CategoriaLabor);
  withAuditAssociations(Labor);
  withAuditAssociations(LaborSerie);
  withAuditAssociations(LaborOcurrencia);

  // Valores configurables por estadio de Sigatoka para el cálculo de Suma Bruta.
  withAuditAssociations(EstadioSigatoka);

  // Colaboradores (trabajadores de campo, sin login) y su calificación
  // (1-5) por Labor — de acá sale la lista de responsables sugeridos.
  Finca.hasMany(Colaborador, { foreignKey: 'fincaId', as: 'colaboradores' });
  Colaborador.belongsTo(Finca, { foreignKey: 'fincaId', as: 'finca' });

  Colaborador.hasMany(ColaboradorLabor, { foreignKey: 'colaboradorId', as: 'labores' });
  ColaboradorLabor.belongsTo(Colaborador, { foreignKey: 'colaboradorId', as: 'colaborador' });

  Labor.hasMany(ColaboradorLabor, { foreignKey: 'laborId', as: 'colaboradorLabores' });
  ColaboradorLabor.belongsTo(Labor, { foreignKey: 'laborId', as: 'labor' });

  withAuditAssociations(Colaborador);

  // Programación de Corte (cargue masivo de cuándo se espera cortar cada
  // finca y cuántas cajas se programan) — mismo patrón que ProduccionSemanal.
  Finca.hasMany(ProgramacionCorte, { foreignKey: 'fincaId', as: 'programacionesCorte' });
  ProgramacionCorte.belongsTo(Finca, { foreignKey: 'fincaId', as: 'finca' });

  Semana.hasMany(ProgramacionCorte, { foreignKey: 'semanaId', as: 'programacionesCorte' });
  ProgramacionCorte.belongsTo(Semana, { foreignKey: 'semanaId', as: 'semana' });

  Producto.hasMany(ProgramacionCorte, { foreignKey: 'productoId', as: 'programacionesCorte' });
  ProgramacionCorte.belongsTo(Producto, { foreignKey: 'productoId', as: 'producto' });

  Finca.hasMany(RechazoCorte, { foreignKey: 'fincaId', as: 'rechazosCorte' });
  RechazoCorte.belongsTo(Finca, { foreignKey: 'fincaId', as: 'finca' });

  Semana.hasMany(RechazoCorte, { foreignKey: 'semanaId', as: 'rechazosCorte' });
  RechazoCorte.belongsTo(Semana, { foreignKey: 'semanaId', as: 'semana' });

  Producto.hasMany(RechazoCorte, { foreignKey: 'productoId', as: 'rechazosCorte' });
  RechazoCorte.belongsTo(Producto, { foreignKey: 'productoId', as: 'producto' });

  withAuditAssociations(ProgramacionCorte);
  withAuditAssociations(Producto);

  // Precipitación Diaria — relaciones reales agregadas después (la tabla se
  // creó con SQL crudo, ver precipitacionDiaria.service.js y la migración
  // 20260821000003-fk-precipitacion-diaria).
  Finca.hasMany(PrecipitacionDiariaConfig, { foreignKey: 'fincaId', as: 'precipitacionDiariaConfigs' });
  PrecipitacionDiariaConfig.belongsTo(Finca, { foreignKey: 'fincaId', as: 'finca' });

  Role.hasMany(PrecipitacionDiariaConfig, { foreignKey: 'rolId', as: 'precipitacionDiariaConfigs' });
  PrecipitacionDiariaConfig.belongsTo(Role, { foreignKey: 'rolId', as: 'rol' });

  // FK apunta a semanas.uuid (no a semanas.id) — la columna ya se llamaba
  // semana_inicio_uuid antes de que existiera esta relación formal.
  Semana.hasMany(PrecipitacionDiariaConfig, { foreignKey: 'semanaInicioUuid', sourceKey: 'uuid', as: 'precipitacionDiariaConfigs' });
  PrecipitacionDiariaConfig.belongsTo(Semana, { foreignKey: 'semanaInicioUuid', targetKey: 'uuid', as: 'semanaInicio' });

  Finca.hasMany(PrecipitacionDiaria, { foreignKey: 'fincaId', as: 'precipitacionesDiarias' });
  PrecipitacionDiaria.belongsTo(Finca, { foreignKey: 'fincaId', as: 'finca' });

  User.hasMany(PrecipitacionDiaria, { foreignKey: 'usuarioId', as: 'precipitacionesDiarias' });
  PrecipitacionDiaria.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });

  // Inventarios - FASE 1: Catálogo
  ArticuloCategoria.hasMany(Articulo, { foreignKey: 'categoriaId', as: 'articulos' });
  Articulo.belongsTo(ArticuloCategoria, { foreignKey: 'categoriaId', as: 'categoria' });

  UnidadMedida.hasMany(Articulo, { foreignKey: 'unidadMedidaId', as: 'articulos' });
  Articulo.belongsTo(UnidadMedida, { foreignKey: 'unidadMedidaId', as: 'unidadMedida' });

  UnidadMedida.hasMany(UnidadConversion, { foreignKey: 'unidadOrigenId', as: 'conversionesOrigen' });
  UnidadMedida.hasMany(UnidadConversion, { foreignKey: 'unidadDestinoId', as: 'conversionesDestino' });
  UnidadConversion.belongsTo(UnidadMedida, { foreignKey: 'unidadOrigenId', as: 'unidadOrigen' });
  UnidadConversion.belongsTo(UnidadMedida, { foreignKey: 'unidadDestinoId', as: 'unidadDestino' });

  // Almacenes jerárquicos (self) + ubicación en finca + responsable
  Almacen.hasMany(Almacen, { foreignKey: 'parentId', as: 'hijos' });
  Almacen.belongsTo(Almacen, { foreignKey: 'parentId', as: 'padre' });
  Almacen.belongsTo(Finca, { foreignKey: 'ubicacionFincaId', as: 'finca' });
  Finca.hasMany(Almacen, { foreignKey: 'ubicacionFincaId', as: 'almacenes' });
  Almacen.belongsTo(User, { foreignKey: 'responsableId', as: 'responsable' });

  withAuditAssociations(ArticuloCategoria);
  withAuditAssociations(Articulo);
  withAuditAssociations(UnidadMedida);
  withAuditAssociations(Almacen);
  withAuditAssociationsNoDelete(UnidadConversion);

  // Inventarios - FASE 2: Motor de movimientos
  withAuditAssociations(Motivo);
  Almacen.hasMany(MovimientoInventario, { foreignKey: 'almacenId', as: 'movimientos' });
  MovimientoInventario.belongsTo(Almacen, { foreignKey: 'almacenId', as: 'almacen' });
  Articulo.hasMany(MovimientoInventario, { foreignKey: 'articuloId', as: 'movimientos' });
  MovimientoInventario.belongsTo(Articulo, { foreignKey: 'articuloId', as: 'articulo' });
  UnidadMedida.hasMany(MovimientoInventario, { foreignKey: 'unidadId', as: 'movimientos' });
  MovimientoInventario.belongsTo(UnidadMedida, { foreignKey: 'unidadId', as: 'unidad' });
  Motivo.hasMany(MovimientoInventario, { foreignKey: 'motivoId', as: 'movimientos' });
  MovimientoInventario.belongsTo(Motivo, { foreignKey: 'motivoId', as: 'motivo' });
  User.hasMany(MovimientoInventario, { foreignKey: 'usuarioId', as: 'movimientosInventario' });
  MovimientoInventario.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });

  // Cache de saldo por (almacén, producto) — ver stock.helper.js. La fuente
  // de verdad sigue siendo movimientos_inventario (kárdex); esto solo evita
  // recalcular SUM() sobre todo el histórico en cada lectura/escritura.
  Almacen.hasMany(Existencia, { foreignKey: 'almacenId', as: 'existencias' });
  Existencia.belongsTo(Almacen, { foreignKey: 'almacenId', as: 'almacen' });
  Articulo.hasMany(Existencia, { foreignKey: 'articuloId', as: 'existencias' });
  Existencia.belongsTo(Articulo, { foreignKey: 'articuloId', as: 'articulo' });

  // Inventarios - FASE 3: Mezclas y Elaboraciones
  Mezcla.hasMany(MezclaVersion, { foreignKey: 'mezclaId', as: 'versiones' });
  MezclaVersion.belongsTo(Mezcla, { foreignKey: 'mezclaId', as: 'mezcla' });

  MezclaVersion.hasMany(MezclaComponente, { foreignKey: 'mezclaVersionId', as: 'componentes' });
  MezclaComponente.belongsTo(MezclaVersion, { foreignKey: 'mezclaVersionId', as: 'version' });

  Mezcla.belongsTo(Articulo, { foreignKey: 'articuloElaboradoId', as: 'articuloElaborado' });
  Articulo.hasMany(Mezcla, { foreignKey: 'articuloElaboradoId', as: 'mezclas' });

  Mezcla.belongsTo(UnidadMedida, { foreignKey: 'unidadRendimientoId', as: 'unidadRendimiento' });
  UnidadMedida.hasMany(Mezcla, { foreignKey: 'unidadRendimientoId', as: 'mezclasRendimiento' });

  MezclaComponente.belongsTo(Articulo, { foreignKey: 'articuloId', as: 'articulo' });
  Articulo.hasMany(MezclaComponente, { foreignKey: 'articuloId', as: 'mezclaComponentes' });

  MezclaComponente.belongsTo(UnidadMedida, { foreignKey: 'unidadId', as: 'unidad' });
  UnidadMedida.hasMany(MezclaComponente, { foreignKey: 'unidadId', as: 'mezclaComponentes' });

  MezclaVersion.hasMany(Elaboracion, { foreignKey: 'mezclaVersionId', as: 'elaboraciones' });
  Elaboracion.belongsTo(MezclaVersion, { foreignKey: 'mezclaVersionId', as: 'version' });

  Elaboracion.belongsTo(Almacen, { foreignKey: 'almacenId', as: 'almacen' });
  Almacen.hasMany(Elaboracion, { foreignKey: 'almacenId', as: 'elaboraciones' });

  Elaboracion.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });
  User.hasMany(Elaboracion, { foreignKey: 'usuarioId', as: 'elaboraciones' });

  withAuditAssociations(Mezcla);

  // Inventarios - FASE 4: Proformas
  Proforma.hasMany(ProformaDetalle, { foreignKey: 'proformaId', as: 'detalles' });
  ProformaDetalle.belongsTo(Proforma, { foreignKey: 'proformaId', as: 'proforma' });
  ProformaDetalle.belongsTo(Articulo, { foreignKey: 'articuloId', as: 'articulo' });
  Articulo.hasMany(ProformaDetalle, { foreignKey: 'articuloId', as: 'proformaDetalles' });
  Proforma.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });
  User.hasMany(Proforma, { foreignKey: 'usuarioId', as: 'proformas' });
  withAuditAssociations(Proforma);

  // Factura real, generada al convertir una proforma (proforma.service.js#convertir).
  Proforma.hasOne(Factura, { foreignKey: 'proformaId', as: 'factura' });
  Factura.belongsTo(Proforma, { foreignKey: 'proformaId', as: 'proforma' });
  Factura.hasMany(FacturaDetalle, { foreignKey: 'facturaId', as: 'detalles' });
  FacturaDetalle.belongsTo(Factura, { foreignKey: 'facturaId', as: 'factura' });
  FacturaDetalle.belongsTo(Articulo, { foreignKey: 'articuloId', as: 'articulo' });
  Articulo.hasMany(FacturaDetalle, { foreignKey: 'articuloId', as: 'facturaDetalles' });
  Factura.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });
  User.hasMany(Factura, { foreignKey: 'usuarioId', as: 'facturas' });
  // Sin soft-delete: una factura emitida no se borra, se ANULA (ver `estado`).
  withAuditAssociationsNoDelete(Factura);

  // Inventarios - FASE 5: Equipos + repuestos compatibles
  Equipo.belongsTo(EquipoTipo, { foreignKey: 'tipoId', as: 'tipo' });
  EquipoTipo.hasMany(Equipo, { foreignKey: 'tipoId', as: 'equipos' });
  withAuditAssociations(EquipoTipo);
  Equipo.belongsTo(Almacen, { foreignKey: 'ubicacionId', as: 'ubicacion' });
  Almacen.hasMany(Equipo, { foreignKey: 'ubicacionId', as: 'equiposUbicados' });
  Equipo.belongsTo(Almacen, { foreignKey: 'centroCostoId', as: 'centroCosto' });
  Almacen.hasMany(Equipo, { foreignKey: 'centroCostoId', as: 'equiposCentroCosto' });
  Equipo.belongsTo(User, { foreignKey: 'responsableId', as: 'responsable' });
  User.hasMany(Equipo, { foreignKey: 'responsableId', as: 'equiposResponsables' });
  // M2M repuestos compatibles
  Equipo.belongsToMany(Articulo, { through: EquipoComponente, foreignKey: 'equipoId', otherKey: 'articuloId', as: 'repuestosCompatibles' });
  Articulo.belongsToMany(Equipo, { through: EquipoComponente, foreignKey: 'articuloId', otherKey: 'equipoId', as: 'equiposCompatibles' });
  EquipoComponente.belongsTo(Equipo, { foreignKey: 'equipoId', as: 'equipo' });
  EquipoComponente.belongsTo(Articulo, { foreignKey: 'articuloId', as: 'articulo' });
  Equipo.hasMany(EquipoComponente, { foreignKey: 'equipoId', as: 'componentes' });
  Articulo.hasMany(EquipoComponente, { foreignKey: 'articuloId', as: 'equipoComponentes' });
  withAuditAssociations(Equipo);

  // Inventarios - FASE 6: Mantenimiento
  PlanMantenimiento.belongsTo(Equipo, { foreignKey: 'equipoId', as: 'equipo' });
  Equipo.hasMany(PlanMantenimiento, { foreignKey: 'equipoId', as: 'planesMantenimiento' });
  withAuditAssociations(PlanMantenimiento);

  ProgramacionMantenimiento.belongsTo(PlanMantenimiento, { foreignKey: 'planId', as: 'plan' });
  PlanMantenimiento.hasMany(ProgramacionMantenimiento, { foreignKey: 'planId', as: 'programaciones' });
  ProgramacionMantenimiento.belongsTo(Equipo, { foreignKey: 'equipoId', as: 'equipo' });
  Equipo.hasMany(ProgramacionMantenimiento, { foreignKey: 'equipoId', as: 'programacionesMantenimiento' });
  ProgramacionMantenimiento.belongsTo(User, { foreignKey: 'responsableId', as: 'responsable' });
  User.hasMany(ProgramacionMantenimiento, { foreignKey: 'responsableId', as: 'programacionesMantenimiento' });
  withAuditAssociations(ProgramacionMantenimiento);

  OrdenMantenimiento.belongsTo(Equipo, { foreignKey: 'equipoId', as: 'equipo' });
  Equipo.hasMany(OrdenMantenimiento, { foreignKey: 'equipoId', as: 'ordenesMantenimiento' });
  OrdenMantenimiento.belongsTo(PlanMantenimiento, { foreignKey: 'planId', as: 'plan' });
  PlanMantenimiento.hasMany(OrdenMantenimiento, { foreignKey: 'planId', as: 'ordenes' });
  OrdenMantenimiento.belongsTo(ProgramacionMantenimiento, { foreignKey: 'programacionId', as: 'programacion' });
  ProgramacionMantenimiento.hasMany(OrdenMantenimiento, { foreignKey: 'programacionId', as: 'ordenes' });
  OrdenMantenimiento.belongsTo(Almacen, { foreignKey: 'almacenId', as: 'almacen' });
  Almacen.hasMany(OrdenMantenimiento, { foreignKey: 'almacenId', as: 'ordenesMantenimiento' });
  OrdenMantenimiento.belongsTo(User, { foreignKey: 'responsableId', as: 'responsable' });
  User.hasMany(OrdenMantenimiento, { foreignKey: 'responsableId', as: 'ordenesResponsables' });
  OrdenMantenimiento.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });
  User.hasMany(OrdenMantenimiento, { foreignKey: 'usuarioId', as: 'ordenesCreadas' });

  OrdenDetalle.belongsTo(OrdenMantenimiento, { foreignKey: 'ordenId', as: 'orden' });
  OrdenMantenimiento.hasMany(OrdenDetalle, { foreignKey: 'ordenId', as: 'detalles' });
  OrdenDetalle.belongsTo(Articulo, { foreignKey: 'articuloId', as: 'articulo' });
  Articulo.hasMany(OrdenDetalle, { foreignKey: 'articuloId', as: 'ordenDetalles' });
  OrdenDetalle.belongsTo(Almacen, { foreignKey: 'almacenId', as: 'almacen' });

  OrdenManoObra.belongsTo(OrdenMantenimiento, { foreignKey: 'ordenId', as: 'orden' });
  OrdenMantenimiento.hasMany(OrdenManoObra, { foreignKey: 'ordenId', as: 'manoObra' });
  OrdenManoObra.belongsTo(User, { foreignKey: 'responsableId', as: 'responsable' });

  OrdenServicio.belongsTo(OrdenMantenimiento, { foreignKey: 'ordenId', as: 'orden' });
  OrdenMantenimiento.hasMany(OrdenServicio, { foreignKey: 'ordenId', as: 'servicios' });

  OrdenServicio.belongsTo(Proveedor, { foreignKey: 'proveedorId', as: 'proveedorRef' });
  Proveedor.hasMany(OrdenServicio, { foreignKey: 'proveedorId', as: 'servicios' });
  withAuditAssociations(Proveedor);

  withAuditAssociations(OrdenMantenimiento);
};

export {
  User,
  Role,
  Permiso,
  MenuItem,
  RefreshToken,
  UsuarioRol,
  RolPermiso,
  UsuarioFinca,
  Finca,
  GrupoFinca,
  Lote,
  Planta,
  CategoriaPlanta,
  TipoEvaluacion,
  Semana,
  Evaluacion,
  Infeccion,
  HojaInfectada,
  ConteoHojas,
  SumaBruta,
  EstadioHoja,
  Configuracion,
  LoteAreaProduccion,
  LoteAreaConfig,
  MotivoRepique,
  MotivoRecuse,
  RacimoMovimiento,
  ProduccionSemanal,
  EstimacionFinca,
  CategoriaLabor,
  Labor,
  LaborSerie,
  LaborSerieLote,
  LaborOcurrencia,
  EstadioSigatoka,
  Colaborador,
  ColaboradorLabor,
  ProgramacionCorte,
  Producto,
  RechazoCorte,
  PrecipitacionDiariaConfig,
  PrecipitacionDiaria,
  Articulo,
  ArticuloCategoria,
  UnidadMedida,
  UnidadConversion,
  Almacen,
  Motivo,
  MovimientoInventario,
  Mezcla,
  MezclaVersion,
  MezclaComponente,
  Elaboracion,
  Proforma,
  ProformaDetalle,
  Equipo,
  EquipoTipo,
  FincaSemanaLiquidacion,
  EquipoComponente,
  PlanMantenimiento,
  ProgramacionMantenimiento,
  OrdenMantenimiento,
  OrdenDetalle,
  OrdenManoObra,
  OrdenServicio,
  Proveedor,
  Existencia,
  Factura,
  FacturaDetalle,
};

export default setupAssociations;
