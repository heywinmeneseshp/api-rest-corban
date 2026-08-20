require('dotenv/config');

const commonDefine = {
  underscored: true,
  timestamps: true,
};

const directConfig = {
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'corbana_sanitario',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  dialect: 'mysql',
  dialectOptions: {
    dateStrings: true,
    typeCast: true,
  },
  timezone: '+00:00',
  define: commonDefine,
};

const common = {
  ...directConfig,
  // Sin esto, sequelize-cli usa storage 'none' para seeders (a diferencia de
  // migraciones, que sí usan 'sequelize' por default) y `db:seed:all` nunca
  // sabe cuáles ya corrieron: reintenta TODOS desde el primero en cada
  // corrida y revienta con duplicate-key contra datos ya sembrados. Con esto
  // queda trackeado igual que las migraciones, en la tabla `SequelizeData`.
  seederStorage: 'sequelize',
  seederStorageTableName: 'SequelizeData',
};

module.exports = {
  development: common,
  test: common,
  production: common,
};
