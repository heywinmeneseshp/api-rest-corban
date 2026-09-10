import { Op } from 'sequelize';

// Genera un número correlativo tipo "PREFIJO-0001" basado en el último registro
// existente con ese prefijo. Debe llamarse siempre dentro de la misma transacción
// en la que se inserta el registro, con `transaction` seteado, para que el lock
// de la fila leída (`FOR UPDATE`) y el insert queden lo más cerca posible — el
// unique constraint sobre la columna es la última línea de defensa si dos
// solicitudes concurrentes generan el mismo número.
export async function generarCorrelativo(model, { prefijo, columna = 'numero', padding = 4, transaction }) {
  const last = await model.findOne({
    where: { [columna]: { [Op.like]: `${prefijo}-%` } },
    order: [['id', 'DESC']],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
    // En un modelo paranoid (soft-delete), Sequelize excluye por defecto
    // las filas eliminadas (`deleted_at IS NULL` implícito) — sin esto, al
    // eliminarse el último registro con un número dado, el siguiente
    // cálculo volvía a generar ese mismo número, chocando con el UNIQUE de
    // la columna (que sí sigue contando las filas soft-eliminadas). Los
    // números correlativos nunca se reutilizan, se eliminen o no sus filas.
    paranoid: false,
  });

  let siguiente = 1;
  if (last) {
    const match = String(last[columna]).match(/(\d+)$/);
    if (match) siguiente = parseInt(match[1], 10) + 1;
  }
  return `${prefijo}-${String(siguiente).padStart(padding, '0')}`;
}

export default { generarCorrelativo };
