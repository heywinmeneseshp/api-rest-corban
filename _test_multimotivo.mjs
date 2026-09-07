import { setupAssociations } from './src/database/associations.js';
setupAssociations();
const { racimoMovimientoService } = await import('./src/services/agricola/racimoMovimiento.service.js');

const user = { roles: ['Administrador'], permissions: [] };
const base = await racimoMovimientoService.getReporteEmbolses({ anios: '2026', tipo: 'REPIQUE' }, user);
const [m1, m2] = base.motivosRepique;
console.log(`Individuales: ${m1.nombre}=${m1.total}, ${m2.nombre}=${m2.total}, suma=${m1.total + m2.total}`);

const combo = await racimoMovimientoService.getReporteEmbolses({ anios: '2026', tipo: 'REPIQUE', motivoUuids: `${m1.uuid},${m2.uuid}` }, user);
console.log('Combinado (2 motivos):', combo.anios[0].totalAnual, '- motivosSeleccionados:', combo.motivosSeleccionados);
process.exit(0);
