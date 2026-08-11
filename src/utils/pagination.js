export const getPagination = (query) => {
  const page = Math.max(1, Number(query.page) || 1);
  // El tope real por endpoint lo pone cada Joi validator (la mayoría sigue
  // en 100) — este 500 es solo el techo absoluto de la utilidad compartida,
  // para endpoints puntuales (ej. racimo-movimientos) que necesitan permitir
  // páginas más grandes.
  const limit = Math.min(500, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

export const buildPaginationMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 1,
});
