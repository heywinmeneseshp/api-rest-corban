import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularIndicadorHoja } from './sumaBrutaTotal.js';

// Helper: arma una "planta" con su sumaBruta ya hidratada (mismo shape que
// produce adjuntarValoresPorHoja) a partir de los valores de hoja 3 y 5.
// `h3`/`h5` en null representan una hoja vacía (no evaluada).
function planta({ candela, h3 = null, h5 = null }) {
  const estadios = [];
  if (h3 !== null) estadios.push({ numeroHoja: 3, valor: h3 });
  if (h5 !== null) estadios.push({ numeroHoja: 5, valor: h5 });
  return { candela, estadios };
}

test('CASO 1: 5 plantas evaluadas, todas con H3 y H5', () => {
  const plantas = [
    planta({ candela: 0.2, h3: 60, h5: 100 }),
    planta({ candela: 0.4, h3: 60, h5: 180 }),
    planta({ candela: 0.6, h3: 100, h5: 60 }),
    planta({ candela: 0.2, h3: 100, h5: 100 }),
    planta({ candela: 0.4, h3: 60, h5: 60 }),
  ];
  // Σvalor=380, ΣCC=(2+4+6+2+4)=18 → ((380-18)/5)*10 = 724
  assert.equal(calcularIndicadorHoja(plantas, 3), 724);
  // Σvalor=500, ΣCC=18 → ((500-18)/5)*10 = 964
  assert.equal(calcularIndicadorHoja(plantas, 5), 964);
});

test('CASO 2: 10 plantas evaluadas — el denominador no queda fijo en 5', () => {
  const plantas = Array.from({ length: 10 }, (_, i) => planta({ candela: 0.2, h3: 100, h5: 60 }));
  // Σvalor=1000, ΣCC=10*2=20 → ((1000-20)/10)*10 = 980
  assert.equal(calcularIndicadorHoja(plantas, 3), 980);
  // Σvalor=600, ΣCC=20 → ((600-20)/10)*10 = 580
  assert.equal(calcularIndicadorHoja(plantas, 5), 580);
});

test('CASO 3: 8 plantas evaluadas', () => {
  const plantas = Array.from({ length: 8 }, () => planta({ candela: 0.4, h3: 80, h5: 100 }));
  // Σvalor=640, ΣCC=8*4=32 → ((640-32)/8)*10 = 760
  assert.equal(calcularIndicadorHoja(plantas, 3), 760);
  // Σvalor=800, ΣCC=32 → ((800-32)/8)*10 = 960
  assert.equal(calcularIndicadorHoja(plantas, 5), 960);
});

test('CASO 4: 7 plantas evaluadas', () => {
  const plantas = Array.from({ length: 7 }, () => planta({ candela: 0.6, h3: 60, h5: 60 }));
  // Σvalor=420, ΣCC=7*6=42 → ((420-42)/7)*10 = 540
  assert.equal(calcularIndicadorHoja(plantas, 3), 540);
  assert.equal(calcularIndicadorHoja(plantas, 5), 540);
});

test('CASO 5: algunas plantas con H3 vacía — igual cuentan para N_plantas', () => {
  const plantas = [
    planta({ candela: 0.2, h3: 100, h5: 60 }),
    planta({ candela: 0.4, h3: null, h5: 80 }), // H3 vacía: aporta 0 a valor y a CC
    planta({ candela: 0.6, h3: 60, h5: 100 }),
    planta({ candela: 0.2, h3: null, h5: 60 }), // H3 vacía
  ];
  // N_plantas = 4 (no 2, aunque solo 2 tengan H3).
  // Σvalor(H3)=100+60=160, ΣCC(H3)=(2+6)=8 solo de las 2 con H3 evaluada.
  // ((160-8)/4)*10 = 380
  assert.equal(calcularIndicadorHoja(plantas, 3), 380);
});

test('CASO 6: algunas plantas con H5 vacía — igual cuentan para N_plantas', () => {
  const plantas = [
    planta({ candela: 0.2, h3: 100, h5: 60 }),
    planta({ candela: 0.4, h3: 80, h5: null }), // H5 vacía
    planta({ candela: 0.6, h3: 60, h5: 100 }),
    planta({ candela: 0.2, h3: 60, h5: null }), // H5 vacía
  ];
  // N_plantas = 4. Σvalor(H5)=60+100=160, ΣCC(H5)=(2+6)=8.
  // ((160-8)/4)*10 = 380
  assert.equal(calcularIndicadorHoja(plantas, 5), 380);
});

test('CASO 7: diferentes valores de candela', () => {
  const plantas = [
    planta({ candela: 0.2, h3: 100, h5: 100 }),
    planta({ candela: 0.8, h3: 100, h5: 100 }),
    planta({ candela: 1, h3: 100, h5: 100 }),
  ];
  // Σvalor=300, ΣCC=(2+8+10)=20 → ((300-20)/3)*10 = 933.33
  assert.equal(calcularIndicadorHoja(plantas, 3), 933.33);
});

test('CASO 8: no asume 5 plantas por lote — un lote con más plantas que otros', () => {
  // El indicador se calcula sobre el grupo completo (finca+semana), sin
  // importar cómo se repartan las plantas entre lotes — acá 12 plantas en
  // total repartidas de forma desigual (7 + 5) deben dar el mismo
  // resultado que si vinieran de un solo lote de 12.
  const lote1 = Array.from({ length: 7 }, () => planta({ candela: 0.2, h3: 100, h5: 60 }));
  const lote2 = Array.from({ length: 5 }, () => planta({ candela: 0.2, h3: 100, h5: 60 }));
  const grupo = [...lote1, ...lote2];
  // N_plantas=12, Σvalor=1200, ΣCC=12*2=24 → ((1200-24)/12)*10 = 980
  assert.equal(calcularIndicadorHoja(grupo, 3), 980);
});

test('CASO 10: caso conocido — San Francisco, semana 19, 15 plantas', () => {
  // Datos reales: 5 plantas por lote (lotes 2, 3 y 16), algunas con H3
  // vacía. Reconstruidos tal cual el registro de campo.
  const plantas = [
    // Lote 2
    planta({ candela: 0.2, h3: 100, h5: 100 }),
    planta({ candela: 0.6, h3: null, h5: 60 }),
    planta({ candela: 0.6, h3: 100, h5: 100 }),
    planta({ candela: 0.4, h3: 100, h5: 100 }),
    planta({ candela: 0.2, h3: 140, h5: 100 }),
    // Lote 3
    planta({ candela: 0.2, h3: null, h5: 20 }),
    planta({ candela: 0.4, h3: 100, h5: 100 }),
    planta({ candela: 0.2, h3: null, h5: 100 }),
    planta({ candela: 0.4, h3: null, h5: 100 }),
    planta({ candela: 0.4, h3: 60, h5: 60 }),
    // Lote 16
    planta({ candela: 0.8, h3: null, h5: 60 }),
    planta({ candela: 0.2, h3: null, h5: 60 }),
    planta({ candela: 0.2, h3: 60, h5: 60 }),
    planta({ candela: 0.6, h3: 60, h5: 100 }),
    planta({ candela: 0.4, h3: null, h5: 60 }),
  ];

  assert.equal(plantas.length, 15);
  assert.equal(calcularIndicadorHoja(plantas, 3), 460);
  assert.equal(calcularIndicadorHoja(plantas, 5), 748);
});

test('grupo vacío devuelve null (no divide por cero)', () => {
  assert.equal(calcularIndicadorHoja([], 3), null);
});
