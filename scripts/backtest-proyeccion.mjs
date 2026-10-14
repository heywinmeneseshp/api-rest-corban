/* eslint-disable no-console */
// Backtest de la proyección anual: proyecta un año con los datos disponibles hasta el 31 de diciembre del año anterior y
// lo compara con lo realmente ocurrido (semanas ya transcurridas).
//
// Uso:  node scripts/backtest-proyeccion.mjs [anio=2026] [semanaMax=40] [anios=2023,2024,2025]
import { setupAssociations } from '../src/database/associations.js';

setupAssociations();
const { calcularProyeccion } = await import('../src/services/agricola/proyeccion.service.js');

const anio = Number(process.argv[2] || 2026);
const semanaMax = Number(process.argv[3] || 40);
const anios = (process.argv[4] || '').split(',').map(Number).filter(Boolean);
const admin = { roles: ['Administrador'], permissions: [], fincaIds: null };

// Proyección "ciega": solo datos hasta el 31-dic del año anterior.
const proyectado = await calcularProyeccion({ anio, params: { anios }, areas: [] }, admin, { asOfDate: new Date(`${anio - 1}-12-31`) });
// Real: el comparativo de la proyección del año siguiente trae el año `anio` ya transcurrido.
const referencia = await calcularProyeccion({ anio: anio + 1, params: {}, areas: [] }, admin);
const real = new Map(referencia.comparativo.porSemana.map((s) => [s.numeroSemana, s.valores[anio]]));

const semanas = proyectado.porSemana.filter((s) => s.numeroSemana <= semanaMax);
let proyEmb = 0;
let proyCaj = 0;
let realEmb = 0;
let realCaj = 0;
let apeEmb = 0;
let apeCaj = 0;
let n = 0;
for (const s of semanas) {
  const r = real.get(s.numeroSemana);
  proyEmb += s.embolses;
  proyCaj += s.cajas;
  realEmb += r.embolses;
  realCaj += r.cajas;
  if (r.embolses > 0 && r.cajas > 0) {
    apeEmb += Math.abs(s.embolses - r.embolses) / r.embolses;
    apeCaj += Math.abs(s.cajas - r.cajas) / r.cajas;
    n++;
  }
}
const pct = (a, b) => `${((a / b - 1) * 100).toFixed(1)}%`;
console.log(`Backtest ${anio} (semanas 1-${semanaMax}, años base: ${proyectado.meta.anios.join(', ')})`);
console.log(`Embolses: proyectado ${Math.round(proyEmb)} vs real ${realEmb} (error acumulado ${pct(proyEmb, realEmb)}; MAPE semanal ${((apeEmb / n) * 100).toFixed(1)}%)`);
console.log(`Cajas:    proyectado ${Math.round(proyCaj)} vs real ${realCaj} (error acumulado ${pct(proyCaj, realCaj)}; MAPE semanal ${((apeCaj / n) * 100).toFixed(1)}%)`);
process.exit(0);
