import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Historial de lo que se cambió al ejecutar una aspersión. `cantidadAnterior` NULL = insumo adicional agregado.
export class AspersionCantidadAjuste extends Model {}

AspersionCantidadAjuste.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    aspersionProgramacionId: { type: DataTypes.INTEGER, allowNull: false, field: 'aspersion_programacion_id' },
    articuloNombre: { type: DataTypes.STRING(200), allowNull: false, field: 'articulo_nombre' },
    unidadSimbolo: { type: DataTypes.STRING(20), allowNull: true, field: 'unidad_simbolo' },
    cantidadAnterior: { type: DataTypes.DECIMAL(14, 4), allowNull: true, field: 'cantidad_anterior' },
    cantidadNueva: { type: DataTypes.DECIMAL(14, 4), allowNull: false, field: 'cantidad_nueva' },
    usuarioId: { type: DataTypes.INTEGER, allowNull: true, field: 'usuario_id' },
  },
  {
    sequelize,
    modelName: 'AspersionCantidadAjuste',
    tableName: 'aspersion_cantidad_ajustes',
    underscored: true,
  },
);

export default AspersionCantidadAjuste;
