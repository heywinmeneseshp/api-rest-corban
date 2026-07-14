import { MenuItem, Permiso } from '../../database/associations.js';

export const menuItemRepository = {
  findAll() {
    return MenuItem.findAll({
      order: [['orden', 'ASC']],
      include: [{ model: Permiso, as: 'permiso', attributes: ['id', 'uuid', 'codigo'] }],
    });
  },

  findByUuid(uuid) {
    return MenuItem.findOne({ where: { uuid } });
  },

  findById(id) {
    return MenuItem.findByPk(id);
  },

  create(data, { transaction } = {}) {
    return MenuItem.create(data, { transaction });
  },

  async update(menuItem, data, { transaction } = {}) {
    await menuItem.update(data, { transaction });
    return menuItem;
  },

  async softDelete(menuItem, deletedBy, { transaction } = {}) {
    await menuItem.update({ deletedBy }, { transaction });
    await menuItem.destroy({ transaction });
    return menuItem;
  },
};

export default menuItemRepository;
