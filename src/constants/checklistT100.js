// Plantilla de checklist del mantenimiento de 100 horas del DJI Agras T100: las 7 secciones y los ítems tal como aparecen en el «Formato para ejecución de
// servicio 100 horas» (documento DJI-T100-TC-001). Se siembra en la migración 20261231000036 y se puede copiar o editar desde Planes → Plantillas.
export const PLANTILLA_T100_NOMBRE = 'Mantenimiento 100 h – DJI Agras T100';
export const PLANTILLA_T100_DESCRIPCION = 'Checklist del servicio de 100 horas del DJI Agras T100 (7 secciones, 46 ítems), tomado del formato de ejecución de servicio.';

export const PLANTILLA_T100_SECCIONES = [
  {
    seccion: 'Estructura, propulsión y fijaciones',
    items: [
      'Condición general y limpieza de estructura central, carenados y componentes expuestos.',
      'Brazos, puntos de plegado, seguros, abrazaderas y uniones: fisuras, deformación, juego, desgaste y correcta fijación.',
      'Hélices de 62 in y clamps: grietas, bordes, deformación, desgaste, holguras y fijaciones.',
      'Motores (8) y conjuntos de propulsión: giro libre, rodamientos, contaminación, fijación y daños visibles.',
      'ESC y cableado de motores: conectores, fijación, aislamiento, señales de sobretemperatura o fricción.',
      'Tren de aterrizaje, soportes, uniones y tornillería.',
      'Luces auxiliares / componentes inferiores accesibles: fijación, daños y conectores.',
      'Verificación de tornillería y pares de apriete aplicables según procedimiento vigente.',
    ],
  },
  {
    seccion: 'Safety System 3.0, navegación y comunicaciones',
    items: [
      'LiDAR: limpieza, integridad física, fijación, conectores y prueba funcional disponible.',
      'Radar de onda milimétrica frontal: superficie, fijación, conectores, alertas y prueba funcional.',
      'Radar de onda milimétrica inferior: superficie, fijación, conectores, alertas y prueba funcional.',
      'Radar de onda milimétrica posterior: superficie, fijación, conectores, alertas y prueba funcional.',
      'Sistema de visión 360° / Penta-Vision y cámara FPV: lentes, fijación, imagen, conectores y ausencia de daños.',
      'GNSS/RTK: antenas, conectores, posicionamiento y estabilidad de señal.',
      'Comunicación aeronave-control remoto TKPL 2 / transmisión O4; relay si está instalado.',
      'Prueba de percepción de obstáculos y revisión de alertas del sistema de seguridad.',
    ],
  },
  {
    seccion: 'Sistema de aspersión LS100',
    items: [
      'Tanque de 100 L, soporte, conexiones y sistema de medición/peso: integridad, contaminación y fijación.',
      'Brazos de aspersión: articulaciones, seguros, tuberías y fijación.',
      'Bombas de impulsor con accionamiento magnético (2): fijación, ruido, conectores, operación y fugas.',
      'Aspersores/boquillas: 2 estándar o 4 opcionales; limpieza, giro, desgaste, fijación y conectores.',
      'Mangueras, filtros, sellos, uniones y conectores: fugas, endurecimiento, obstrucción y deterioro.',
      'Prueba de estanqueidad y fugas del circuito de líquido.',
      'Prueba de flujo y operación del sistema; calibración según configuración instalada.',
    ],
  },
  {
    seccion: 'Sistema eléctrico, baterías y carga',
    items: [
      'Baterías DB2160: serie, ciclos, alertas, temperatura, deformaciones, humedad/contaminación y estado físico.',
      'Conectores y terminales de batería: desgaste, carbonización, daño, limpieza y fijación.',
      'Cableado de potencia, distribución eléctrica y conectores accesibles durante el servicio.',
      'Soportes y sistema de fijación de batería / doble batería cuando aplique.',
      'Equipo de carga entregado (C12000, D14000iE u otro): inspección visual, conectores, ventilación y alertas.',
      'Prueba de carga y registro de tiempos/alertas cuando sea posible.',
    ],
  },
  {
    seccion: 'Software, control y diagnóstico',
    items: [
      'Versión de firmware de aeronave y módulos; registro de actualizaciones ejecutadas.',
      'Control remoto TKPL 2: estado físico, batería, puertos, pantalla, firmware y comunicación.',
      'Revisión de historial de errores, logs y eventos relevantes de mantenimiento.',
      'Conectividad con DJI Assistant 2 for MG / herramienta de diagnóstico disponible, cuando aplique.',
      'Calibraciones requeridas de IMU, brújula, percepción, RTK y sistema de aplicación.',
    ],
  },
  {
    seccion: 'Accesorios opcionales (marcar N/A si no están instalados)',
    items: [
      'Spreading System 4.0: tanque, alimentador por tornillo, sinfín/auger, disco centrífugo, actuadores y fijaciones.',
      'Spreading System 4.0: prueba funcional, calibración y revisión de obstrucciones/desgaste.',
      'Sistema de elevación: soportes, cable, gancho, fijaciones y condición general.',
      'Sistema de elevación: sistema de desconexión/escape de emergencia y prueba disponible.',
      'Sistema LS100-DB de aspersión con doble batería: estructura, conexiones y fijaciones.',
      'DJI O4 Relay / D-RTK 3 AG u otros accesorios entregados con el equipo.',
    ],
  },
  {
    seccion: 'Cierre, armado y pruebas finales',
    items: [
      'Armado controlado y verificación cruzada de conectores, seguros, fijaciones y pares de apriete.',
      'Prueba funcional en tierra del sistema de propulsión y ausencia de alertas críticas.',
      'Prueba funcional del Safety System 3.0 y sistemas de posicionamiento/comunicación.',
      'Prueba de aspersión, caudal, estanqueidad y respuesta de bombas/aspersores.',
      'Prueba controlada de vuelo posterior al mantenimiento, si las condiciones operacionales y de seguridad lo permiten.',
      'Registro fotográfico, hallazgos, repuestos, pendientes y recomendaciones para retorno al servicio.',
    ],
  },
];
