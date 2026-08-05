import { User } from './models/user.model.js';
import { Role } from './models/role.model.js';
import { Permiso } from './models/permiso.model.js';
import { MenuItem } from './models/menuItem.model.js';
import { RefreshToken } from './models/refreshToken.model.js';
import { UsuarioRol, RolPermiso, UsuarioFinca } from './models/pivotModels.js';

import { Finca } from './models/finca.model.js';
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
import { MotivoRepique } from './models/motivoRepique.model.js';
import { MotivoRecuse } from './models/motivoRecuse.model.js';
import { RacimoMovimiento } from './models/racimoMovimiento.model.js';
import { ProduccionSemanal } from './models/produccionSemanal.model.js';
import { CategoriaLabor } from './models/categoriaLabor.model.js';
import { Labor } from './models/labor.model.js';
import { LaborSerie } from './models/laborSerie.model.js';
import { LaborSerieLote } from './models/laborSerieLote.model.js';
import { LaborOcurrencia } from './models/laborOcurrencia.model.js';
import { EstadioSigatoka } from './models/estadioSigatoka.model.js';

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

  Lote.hasMany(Planta, { foreignKey: 'loteId', as: 'plantas' });
  Planta.belongsTo(Lote, { foreignKey: 'loteId', as: 'lote' });

  // Historial de área en producción (append-only, sin updated_by)
  Lote.hasMany(LoteAreaProduccion, { foreignKey: 'loteId', as: 'areaProduccionHistorial' });
  LoteAreaProduccion.belongsTo(Lote, { foreignKey: 'loteId', as: 'lote' });
  LoteAreaProduccion.belongsTo(User, { foreignKey: 'createdBy', as: 'creadoPor' });

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

  // Producción semanal: cajas de 20kg por finca y semana
  Finca.hasMany(ProduccionSemanal, { foreignKey: 'fincaId', as: 'produccionSemanal' });
  ProduccionSemanal.belongsTo(Finca, { foreignKey: 'fincaId', as: 'finca' });

  Semana.hasMany(ProduccionSemanal, { foreignKey: 'semanaId', as: 'produccionSemanal' });
  ProduccionSemanal.belongsTo(Semana, { foreignKey: 'semanaId', as: 'semana' });

  // Auditoría — Fase 2 (maestras con deleted_by, transaccionales sin deleted_by)
  withAuditAssociations(Finca);
  withAuditAssociations(Lote);
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

  // Calendario de Labores: CategoriaLabor -> Labor -> LaborSerie -> (LaborSerieLote | LaborOcurrencia)
  CategoriaLabor.hasMany(Labor, { foreignKey: 'categoriaLaborId', as: 'labores' });
  Labor.belongsTo(CategoriaLabor, { foreignKey: 'categoriaLaborId', as: 'categoria' });

  Labor.hasMany(LaborSerie, { foreignKey: 'laborId', as: 'series' });
  LaborSerie.belongsTo(Labor, { foreignKey: 'laborId', as: 'labor' });

  Finca.hasMany(LaborSerie, { foreignKey: 'fincaId', as: 'laborSeries' });
  LaborSerie.belongsTo(Finca, { foreignKey: 'fincaId', as: 'finca' });

  Lote.hasMany(LaborSerie, { foreignKey: 'loteId', as: 'laborSeries' });
  LaborSerie.belongsTo(Lote, { foreignKey: 'loteId', as: 'lote' });

  User.hasMany(LaborSerie, { foreignKey: 'responsableId', as: 'laborSeriesResponsable' });
  LaborSerie.belongsTo(User, { foreignKey: 'responsableId', as: 'responsable' });

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

  User.hasMany(LaborOcurrencia, { foreignKey: 'responsableId', as: 'laborOcurrenciasResponsable' });
  LaborOcurrencia.belongsTo(User, { foreignKey: 'responsableId', as: 'responsable' });

  withAuditAssociations(CategoriaLabor);
  withAuditAssociations(Labor);
  withAuditAssociations(LaborSerie);
  withAuditAssociations(LaborOcurrencia);

  // Valores configurables por estadio de Sigatoka para el cálculo de Suma Bruta.
  withAuditAssociations(EstadioSigatoka);
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
  MotivoRepique,
  MotivoRecuse,
  RacimoMovimiento,
  ProduccionSemanal,
  CategoriaLabor,
  Labor,
  LaborSerie,
  LaborSerieLote,
  LaborOcurrencia,
  EstadioSigatoka,
};

export default setupAssociations;
