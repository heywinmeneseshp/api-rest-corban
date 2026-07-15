import { Configuracion } from '../../database/associations.js';

export const configuracionRepository = {
  findByClave(clave) {
    return Configuracion.findOne({ where: { clave } });
  },

  async upsert(clave, valor, updatedBy) {
    const existing = await this.findByClave(clave);
    if (existing) {
      await existing.update({ valor, updatedBy });
      return existing;
    }
    return Configuracion.create({ clave, valor, updatedBy });
  },
};

export default configuracionRepository;
