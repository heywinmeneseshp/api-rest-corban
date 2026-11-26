// Visitas de «Evaluación de labores» de demostración, SOLO para la base local (no envía correos: inserta directo en la tabla).
// Crea 10 visitas en las últimas semanas, en 4 fincas con 2-3 lotes cada una; la mitad aprobadas y la otra mitad pendientes.
// Todas llevan «[DEMO]» al inicio de la observación. Para borrarlas:  node scripts/demo-visitas-labores.mjs --borrar
import 'dotenv/config';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { sequelize } from '../src/database/connection.js';
import { setupAssociations, Finca, Lote, Semana, User } from '../src/database/associations.js';
import { laborCulturalService } from '../src/services/agricola/laborCultural.service.js';

if (!['localhost', '127.0.0.1'].includes(process.env.DB_HOST || 'localhost') || process.env.DB_MODE === 'bridge') {
  console.error('Este script solo corre contra la base local.');
  process.exit(1);
}
setupAssociations();
const TABLE = 'labores_culturales';

if (process.argv.includes('--borrar')) {
  const [, r] = await sequelize.query(`DELETE FROM ${TABLE} WHERE observacion LIKE '[DEMO]%'`);
  console.log('Filas demo borradas:', r?.affectedRows ?? r);
  process.exit(0);
}

// Crea la tabla si todavía no existe (la crea el servicio la primera vez que se usa).
await laborCulturalService.listVisitas({ limit: 1 }, { id: 1, roles: ['Administrador'] });

const ESTADOS = ['Hecho', 'En ejecucion', 'Pendiente'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const OBS = [
  'Condición fitosanitaria y labores agronómicas\nDurante la visita se evidenció una condición relativamente estable, con YLI ubicado en hojas 6 y 7. Sin embargo, se identificaron sectores con mayor presión de Sigatoka negra.\nRecomendaciones:\n•Reforzar el seguimiento fitosanitario.\n•Priorizar el fitosaneo en los sectores con mayor presión.',
  'Se observaron canales con oportunidades de mejora en mantenimiento y acumulación de material vegetal.\nRecomendaciones:\n1. Limpiar los canales terciarios.\n2. Retirar el material vegetal acumulado.\n3. Revisar las compuertas.',
  'El control de maleza avanza según lo programado. El desmache está al día en la mayoría de los lotes.',
  'Fallas en el sistema de riego: bajas presiones y fugas en el sector norte. Se recomienda revisar las válvulas.',
];

const fincas = await Finca.findAll({ where: { estado: true }, order: [['nombre', 'ASC']], limit: 30 });
const conLotes = [];
for (const f of fincas) {
  const lotes = await Lote.findAll({ where: { fincaId: f.id }, limit: 6, order: [['nombre', 'ASC']] });
  if (lotes.length >= 2) conLotes.push({ f, lotes });
  if (conLotes.length === 4) break;
}
const hoy = new Date().toISOString().slice(0, 10);
const semanas = await Semana.findAll({ where: { fechaInicio: { [Op.lte]: hoy } }, order: [['fechaInicio', 'DESC']], limit: 4 });
const usuarios = await User.findAll({ where: { estado: true }, limit: 3, order: [['id', 'ASC']] });
if (!conLotes.length || !semanas.length || !usuarios.length) {
  console.error('Faltan fincas con lotes, semanas o usuarios en la base local.');
  process.exit(1);
}

let n = 0;
for (let i = 0; i < 10; i++) {
  const { f, lotes } = conLotes[i % conLotes.length];
  const semana = semanas[i % semanas.length];
  const autor = usuarios[i % usuarios.length];
  const aprobada = i % 2 === 0;
  const revisor = usuarios.find((u) => u.id !== autor.id) || autor;
  const visitaUuid = crypto.randomUUID();
  const fecha = String(semana.fechaInicio).slice(0, 10);
  const lotesVisita = lotes.slice(0, 2 + (i % 2));
  const moko = i === 3 ? 1 : 0;
  for (const l of lotesVisita) {
    await sequelize.query(
      `INSERT INTO ${TABLE} (uuid, fecha, semana_uuid, semana_codigo, finca_uuid, finca_nombre, lote_uuid, lote_nombre,
         control_maleza, drenajes, desmache, programa_fertilizacion, fitosaneo, reduccion_inoculo, observacion,
         usuario_nombre, usuario_uuid, usuario_cargo, created_at, moko_presente, moko_lotes, fusarium_presente, fusarium_lotes,
         cumple_protocolo_foc_r4, cumple_protocolo_moko, checklist_observacion, visita_uuid,
         revisado_por_uuid, revisado_por_nombre, revisado_por_cargo, revisado_en)
       VALUES (:uuid, :fecha, :semanaUuid, :semanaCodigo, :fincaUuid, :fincaNombre, :loteUuid, :loteNombre,
         :a, :b, :c, :d, :e, :g, :obs, :autorNombre, :autorUuid, :autorCargo, NOW(), :moko, :mokoLotes, 0, NULL,
         1, 1, NULL, :visitaUuid, :revUuid, :revNombre, :revCargo, :revEn)`,
      {
        replacements: {
          uuid: crypto.randomUUID(),
          fecha,
          semanaUuid: semana.uuid,
          semanaCodigo: semana.codigo,
          fincaUuid: f.uuid,
          fincaNombre: f.nombre,
          loteUuid: l.uuid,
          loteNombre: l.nombre,
          a: pick(ESTADOS),
          b: pick(ESTADOS),
          c: pick(ESTADOS),
          d: pick(ESTADOS),
          e: pick(ESTADOS),
          g: pick(ESTADOS),
          obs: `[DEMO] ${pick(OBS)}`,
          autorNombre: `${autor.nombre} ${autor.apellido || ''}`.trim(),
          autorUuid: autor.uuid,
          autorCargo: autor.cargo || null,
          moko,
          mokoLotes: moko ? l.nombre : null,
          visitaUuid,
          revUuid: aprobada ? revisor.uuid : null,
          revNombre: aprobada ? `${revisor.nombre} ${revisor.apellido || ''}`.trim() : null,
          revCargo: aprobada ? revisor.cargo || null : null,
          revEn: aprobada ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
        },
      },
    );
    n++;
  }
  console.log(`${aprobada ? 'APROBADA ' : 'PENDIENTE'} ${semana.codigo} ${f.nombre} (${lotesVisita.length} lotes) por ${autor.usuario}`);
}
console.log(`Listo: 10 visitas demo (${n} filas).`);
process.exit(0);
