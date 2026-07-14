import swaggerJSDoc from 'swagger-jsdoc';
import { env } from '../config/env.config.js';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Corbana - Control Sanitario de Banano',
      version: '1.0.0',
      description:
        'API REST para el control sanitario de banano (fase 1: autenticación, usuarios, roles, permisos y menú).',
    },
    servers: [{ url: `http://localhost:${env.port}${env.apiPrefix}` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/**/*.routes.js'],
};

export const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
