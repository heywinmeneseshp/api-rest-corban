// `Date#toISOString()` devuelve formato ISO 8601 ("2026-08-24T16:36:39.051Z",
// con 'T', 'Z' y milisegundos). Cuando ese string se pasa como valor de un
// replacement en una consulta SQL cruda (`sequelize.query`, no un modelo
// Sequelize) hacia una columna DATETIME, MySQL lo rechaza con
// "Incorrect datetime value" — a diferencia de los modelos Sequelize, el SQL
// crudo no hace esa conversión de formato automáticamente.
//
// Convierte a "YYYY-MM-DD HH:MM:SS" (sin milisegundos, sin 'T'/'Z'), que
// MySQL sí acepta como literal DATETIME.
export function toMysqlDatetime(isoString) {
  return new Date(isoString).toISOString().slice(0, 19).replace('T', ' ');
}

export default { toMysqlDatetime };
