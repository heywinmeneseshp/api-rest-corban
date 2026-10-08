'use strict';

// Catálogo FRAC inicial (códigos FRAC con su modo de acción y reglas de manejo de resistencia del FRAC Banana
// Working Group, y grupos químicos). Idempotente: solo inserta lo que no existe; nunca pisa lo que el usuario ya
// editó. Los ingredientes activos se clasifican desde la pantalla FRAC / Ingredientes Activos.
const CATALOGO = {
  "codigos": [
    {
      "codigo": "5",
      "modoAccion": "Biosíntesis de esteroles en membranas: Δ14-reductasa y Δ8→Δ7-isomerasa",
      "maxAplicaciones": 15,
      "maxPorcentaje": "50.00",
      "maxConsecutivas": 2,
      "intervaloMinimoDias": null,
      "soloEnMezclas": 0,
      "restricciones": "Solo o en mezcla (mejor en mezcla); bloques de máximo 2 aplicaciones consecutivas; se prefiere la alternancia total.",
      "fuente": "FRAC Banana Working Group — recomendaciones de manejo de resistencia (Sigatoka negra), frac.info/frac-teams/working-groups/banana-group"
    },
    {
      "codigo": "M03",
      "modoAccion": "Actividad multisitio (contacto): ditiocarbamatos",
      "maxAplicaciones": null,
      "maxPorcentaje": null,
      "maxConsecutivas": null,
      "intervaloMinimoDias": null,
      "soloEnMezclas": 0,
      "restricciones": "Multisitio: sin límite dentro de la etiqueta; solo o en mezcla.",
      "fuente": "FRAC Banana Working Group — recomendaciones de manejo de resistencia (Sigatoka negra), frac.info/frac-teams/working-groups/banana-group"
    },
    {
      "codigo": "3",
      "modoAccion": "Biosíntesis de esteroles en membranas: inhibidores de la desmetilación C14 (DMI)",
      "maxAplicaciones": 8,
      "maxPorcentaje": "50.00",
      "maxConsecutivas": 1,
      "intervaloMinimoDias": null,
      "soloEnMezclas": 1,
      "restricciones": "Solo en mezclas con otros modos de acción; alternancia total (idealmente 2 ciclos de otros modos entre usos); iniciar al comienzo de la curva anual de la enfermedad.",
      "fuente": "FRAC Banana Working Group — recomendaciones de manejo de resistencia (Sigatoka negra), frac.info/frac-teams/working-groups/banana-group"
    },
    {
      "codigo": "9",
      "modoAccion": "Síntesis de aminoácidos y proteínas: biosíntesis de metionina (hipótesis)",
      "maxAplicaciones": 8,
      "maxPorcentaje": "50.00",
      "maxConsecutivas": 1,
      "intervaloMinimoDias": null,
      "soloEnMezclas": 1,
      "restricciones": "Solo en mezclas; alternancia total.",
      "fuente": "FRAC Banana Working Group — recomendaciones de manejo de resistencia (Sigatoka negra), frac.info/frac-teams/working-groups/banana-group"
    },
    {
      "codigo": "7",
      "modoAccion": "Respiración: inhibidores de la succinato deshidrogenasa (SDHI, complejo II)",
      "maxAplicaciones": 3,
      "maxPorcentaje": "33.00",
      "maxConsecutivas": 1,
      "intervaloMinimoDias": 90,
      "soloEnMezclas": 1,
      "restricciones": "Solo en mezclas; en alternancia, sin bloques consecutivos; al menos 3 meses sin SDHI; un drench al suelo para nematodos cuenta como una aplicación SDHI.",
      "fuente": "FRAC Banana Working Group — recomendaciones de manejo de resistencia (Sigatoka negra), frac.info/frac-teams/working-groups/banana-group"
    },
    {
      "codigo": "21",
      "modoAccion": "Respiración: inhibidores del complejo III en el sitio Qi (QiI)",
      "maxAplicaciones": 3,
      "maxPorcentaje": "33.00",
      "maxConsecutivas": 1,
      "intervaloMinimoDias": null,
      "soloEnMezclas": 1,
      "restricciones": "Solo en mezclas (preferible con multisitios); en alternancia, sin aplicaciones consecutivas.",
      "fuente": "FRAC Banana Working Group — recomendaciones de manejo de resistencia (Sigatoka negra), frac.info/frac-teams/working-groups/banana-group"
    },
    {
      "codigo": "P03",
      "modoAccion": "Inducción de defensas de la planta (benzisotiazol)",
      "maxAplicaciones": null,
      "maxPorcentaje": null,
      "maxConsecutivas": null,
      "intervaloMinimoDias": null,
      "soloEnMezclas": 0,
      "restricciones": null,
      "fuente": null
    },
    {
      "codigo": "M04",
      "modoAccion": "Actividad multisitio (contacto): ftalimidas",
      "maxAplicaciones": null,
      "maxPorcentaje": null,
      "maxConsecutivas": null,
      "intervaloMinimoDias": null,
      "soloEnMezclas": 0,
      "restricciones": "Multisitio: sin límite dentro de la etiqueta; solo o en mezcla.",
      "fuente": "FRAC Banana Working Group — recomendaciones de manejo de resistencia (Sigatoka negra), frac.info/frac-teams/working-groups/banana-group"
    },
    {
      "codigo": "10",
      "modoAccion": "Citoesqueleto y proteínas motoras: ensamblaje de la β-tubulina en la mitosis",
      "maxAplicaciones": 3,
      "maxPorcentaje": "33.00",
      "maxConsecutivas": 1,
      "intervaloMinimoDias": 90,
      "soloEnMezclas": 1,
      "restricciones": "Solo en mezclas; en alternancia, sin bloques consecutivos; al menos 3 meses sin N-fenil carbamatos entre aplicaciones.",
      "fuente": "FRAC Banana Working Group — recomendaciones de manejo de resistencia (Sigatoka negra), frac.info/frac-teams/working-groups/banana-group"
    },
    {
      "codigo": "M05",
      "modoAccion": "Actividad multisitio (contacto): cloronitrilos",
      "maxAplicaciones": null,
      "maxPorcentaje": null,
      "maxConsecutivas": null,
      "intervaloMinimoDias": null,
      "soloEnMezclas": 0,
      "restricciones": "Multisitio: sin límite dentro de la etiqueta; solo o en mezcla.",
      "fuente": "FRAC Banana Working Group — recomendaciones de manejo de resistencia (Sigatoka negra), frac.info/frac-teams/working-groups/banana-group"
    },
    {
      "codigo": "BM02",
      "modoAccion": "Biológico con múltiples modos de acción (Bacillus)",
      "maxAplicaciones": null,
      "maxPorcentaje": null,
      "maxConsecutivas": null,
      "intervaloMinimoDias": null,
      "soloEnMezclas": 0,
      "restricciones": "Biológico: sin límite dentro de la etiqueta; solo o en mezcla.",
      "fuente": "FRAC Banana Working Group — recomendaciones de manejo de resistencia (Sigatoka negra), frac.info/frac-teams/working-groups/banana-group"
    },
    {
      "codigo": "U12",
      "modoAccion": "Modo de acción desconocido (guanidinas)",
      "maxAplicaciones": 6,
      "maxPorcentaje": "33.00",
      "maxConsecutivas": 1,
      "intervaloMinimoDias": 42,
      "soloEnMezclas": 1,
      "restricciones": "Solo en mezclas; en alternancia, sin bloques consecutivos; al menos 6 semanas sin guanidinas entre aplicaciones.",
      "fuente": "FRAC Banana Working Group — recomendaciones de manejo de resistencia (Sigatoka negra), frac.info/frac-teams/working-groups/banana-group"
    },
    {
      "codigo": "11",
      "modoAccion": "Respiración: inhibidores del complejo III en el sitio Qo (QoI)",
      "maxAplicaciones": 3,
      "maxPorcentaje": "33.00",
      "maxConsecutivas": 1,
      "intervaloMinimoDias": 90,
      "soloEnMezclas": 1,
      "restricciones": "Solo en mezclas; en alternancia, sin aplicaciones consecutivas; al menos 3 meses sin QoI entre aplicaciones; iniciar con la enfermedad en nivel bajo.",
      "fuente": "FRAC Banana Working Group — recomendaciones de manejo de resistencia (Sigatoka negra), frac.info/frac-teams/working-groups/banana-group"
    },
    {
      "codigo": "1",
      "modoAccion": "Citoesqueleto y proteínas motoras: ensamblaje de la β-tubulina en la mitosis",
      "maxAplicaciones": 3,
      "maxPorcentaje": "33.00",
      "maxConsecutivas": 1,
      "intervaloMinimoDias": 90,
      "soloEnMezclas": 1,
      "restricciones": "Solo en mezclas; en alternancia, sin bloques consecutivos; al menos 3 meses sin benzimidazoles entre aplicaciones.",
      "fuente": "FRAC Banana Working Group — recomendaciones de manejo de resistencia (Sigatoka negra), frac.info/frac-teams/working-groups/banana-group"
    },
    {
      "codigo": "M01",
      "modoAccion": "Actividad multisitio (contacto): cobre",
      "maxAplicaciones": null,
      "maxPorcentaje": null,
      "maxConsecutivas": null,
      "intervaloMinimoDias": null,
      "soloEnMezclas": 0,
      "restricciones": "Sin límite dentro de la etiqueta; solo o en mezcla.",
      "fuente": "FRAC Banana Working Group — recomendaciones de manejo de resistencia (Sigatoka negra), frac.info/frac-teams/working-groups/banana-group"
    },
    {
      "codigo": "M02",
      "modoAccion": "Actividad multisitio (contacto): azufre",
      "maxAplicaciones": null,
      "maxPorcentaje": null,
      "maxConsecutivas": null,
      "intervaloMinimoDias": null,
      "soloEnMezclas": 0,
      "restricciones": "Sin límite dentro de la etiqueta; solo o en mezcla.",
      "fuente": "FRAC Banana Working Group — recomendaciones de manejo de resistencia (Sigatoka negra), frac.info/frac-teams/working-groups/banana-group"
    },
    {
      "codigo": "P01",
      "modoAccion": "Inducción de defensas de la planta (benzo-tiadiazol)",
      "maxAplicaciones": null,
      "maxPorcentaje": null,
      "maxConsecutivas": null,
      "intervaloMinimoDias": null,
      "soloEnMezclas": 0,
      "restricciones": null,
      "fuente": null
    }
  ],
  "grupos": [
    {
      "nombre": "Morfolinas",
      "codigo": "5"
    },
    {
      "nombre": "Piperidinas",
      "codigo": "5"
    },
    {
      "nombre": "Espiroquetalaminas",
      "codigo": "5"
    },
    {
      "nombre": "Ditiocarbamatos",
      "codigo": "M03"
    },
    {
      "nombre": "Triazoles",
      "codigo": "3"
    },
    {
      "nombre": "Anilino-pirimidinas",
      "codigo": "9"
    },
    {
      "nombre": "Piridin-carboxamidas",
      "codigo": "7"
    },
    {
      "nombre": "Pirazol-4-carboxamidas",
      "codigo": "7"
    },
    {
      "nombre": "Picolinamidas (QiI)",
      "codigo": "21"
    },
    {
      "nombre": "Benzisotiazoles",
      "codigo": "P03"
    },
    {
      "nombre": "Ftalimidas",
      "codigo": "M04"
    },
    {
      "nombre": "N-fenil carbamatos",
      "codigo": "10"
    },
    {
      "nombre": "Cloronitrilos",
      "codigo": "M05"
    },
    {
      "nombre": "Microbianos (Bacillus)",
      "codigo": "BM02"
    },
    {
      "nombre": "Guanidinas",
      "codigo": "U12"
    },
    {
      "nombre": "Metoxi-acrilatos (QoI)",
      "codigo": "11"
    },
    {
      "nombre": "Metoxi-carbamatos (QoI)",
      "codigo": "11"
    },
    {
      "nombre": "Oximino-acetatos (QoI)",
      "codigo": "11"
    },
    {
      "nombre": "Dihidro-dioxazinas (QoI)",
      "codigo": "11"
    },
    {
      "nombre": "Tetrazolinonas (QoI)",
      "codigo": "11"
    },
    {
      "nombre": "Isopropanol-azoles",
      "codigo": "3"
    },
    {
      "nombre": "Triazolintionas",
      "codigo": "3"
    },
    {
      "nombre": "Imidazoles",
      "codigo": "3"
    },
    {
      "nombre": "Piridinil-etil-benzamidas",
      "codigo": "7"
    },
    {
      "nombre": "N-metoxi-(fenil-etil)-pirazol-carboxamidas",
      "codigo": "7"
    },
    {
      "nombre": "Benzimidazoles (MBC)",
      "codigo": "1"
    },
    {
      "nombre": "Tiofanatos (MBC)",
      "codigo": "1"
    },
    {
      "nombre": "Inorgánicos (cobre)",
      "codigo": "M01"
    },
    {
      "nombre": "Inorgánicos (azufre)",
      "codigo": "M02"
    },
    {
      "nombre": "Benzo-tiadiazoles",
      "codigo": "P01"
    }
  ]
};

module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    for (const c of CATALOGO.codigos) {
      const [existe] = await q.query('SELECT id FROM frac_codigos WHERE codigo = :codigo', { replacements: { codigo: c.codigo } });
      if (existe.length) continue;
      await q.query(
        `INSERT INTO frac_codigos (uuid, codigo, modo_accion, max_aplicaciones, max_porcentaje_aplicaciones, max_consecutivas,
                                   intervalo_minimo_dias, solo_en_mezclas, restricciones, fuente)
         VALUES (UUID(), :codigo, :modoAccion, :maxAplicaciones, :maxPorcentaje, :maxConsecutivas, :intervaloMinimoDias, :soloEnMezclas, :restricciones, :fuente)`,
        { replacements: { ...c, soloEnMezclas: c.soloEnMezclas ? 1 : 0 } },
      );
    }
    for (const g of CATALOGO.grupos) {
      const [fc] = await q.query('SELECT id FROM frac_codigos WHERE codigo = :codigo', { replacements: { codigo: g.codigo } });
      if (!fc.length) continue;
      const [existe] = await q.query('SELECT id FROM grupos_quimicos WHERE nombre = :nombre AND frac_codigo_id = :fid', { replacements: { nombre: g.nombre, fid: fc[0].id } });
      if (existe.length) continue;
      await q.query('INSERT INTO grupos_quimicos (uuid, nombre, frac_codigo_id) VALUES (UUID(), :nombre, :fid)', { replacements: { nombre: g.nombre, fid: fc[0].id } });
    }
  },

  async down() {
    // Datos de catálogo: no se borran al revertir.
  },
};
