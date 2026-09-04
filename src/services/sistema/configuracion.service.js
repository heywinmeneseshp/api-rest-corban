import { configuracionRepository } from '../../repositories/sistema/configuracion.repository.js';
import { env } from '../../config/env.config.js';

export const CLAVE_BANARICA_API_URL = 'banarica_api_url';
export const CLAVE_BANARICA_API_KEY = 'banarica_api_key';
export const CLAVE_APP_VERSION_INFO = 'app_version_info';
export const CLAVE_TASA_CONVERSION = 'tasa_conversion';
export const CLAVE_PRIMERA_SEMANA_PROGRAMACION = 'primera_semana_programacion_id';
export const CLAVE_MARCA_APP = 'marca_app';
export const CLAVE_LABOR_REVISOR_CC = 'sanidad_vegetal_revisor_cc';
export const CLAVE_ALERTAS_SANIDAD_DESTINATARIOS = 'sanidad_vegetal_alertas_destinatarios';
export const CLAVE_SB_HOJA_UMBRALES = 'sanidad_vegetal_sb_hoja_umbrales';

// "Cajas de 20kg" es el nombre convencional de la unidad, pero el peso neto
// real de referencia es otro (ej. 18.6) — configurable en vez de fijo por
// si en el futuro cambia el estándar. Usado para convertir las cajas de
// Programación de Corte (que vienen en cajas del producto real, con su
// propio peso neto) a esta unidad histórica de Producción Semanal.
const TASA_CONVERSION_DEFAULT = 18.6;

// Valor por defecto si nunca se configuró nada — evita que la app móvil
// reciba un 404/error al arrancar en un ambiente recién desplegado.
const APP_VERSION_DEFAULT = {
  latestVersion: '1.0.0',
  minSupportedVersion: '1.0.0',
  downloadUrl: '',
  releaseNotes: '',
};

// logoUrl: data URL base64 (subida desde Configuración → Marca) o null para
// usar el logo por defecto de la app (components/CorbanaLogo.js).
const MARCA_APP_DEFAULT = {
  nombreApp: 'Corbana',
  logoUrl: null,
};

// Sin valor guardado todavía = nada en copia.
const LABOR_REVISOR_CC_DEFAULT = { correos: [], rolesUuids: [], usuariosUuids: [] };
// Sin valor guardado todavía = nadie recibe el correo de alertas de Sanidad
// Vegetal (ni el automático semanal ni el botón de envío manual mandan nada).
const ALERTAS_SANIDAD_DESTINATARIOS_DEFAULT = { correos: [], rolesUuids: [], usuariosUuids: [] };
// Líneas de referencia del gráfico "Promedio de Suma Bruta por Hoja" —
// mismos valores que estaban hardcodeados en PromedioSumaBrutaPorHojaChart
// antes de hacerlos configurables. `alerta` (rojo) además dispara el aviso
// en Alertas de Sanidad Vegetal cuando el promedio de la semana lo supera.
const SB_HOJA_UMBRALES_DEFAULT = { advertencia: 450, alerta: 650 };

export const configuracionService = {
  async getBanaricaApiUrl() {
    const config = await configuracionRepository.findByClave(CLAVE_BANARICA_API_URL);
    return config?.valor || env.integrations.banaricaBaseUrl;
  },

  async setBanaricaApiUrl(url, actorId) {
    const config = await configuracionRepository.upsert(CLAVE_BANARICA_API_URL, url, actorId);
    return { clave: CLAVE_BANARICA_API_URL, valor: config.valor };
  },

  // API key del header `api` que exige api-rest-banarica en
  // /almacenes/ y /programacion-corte para integraciones servidor-a-servidor
  // (ver checkApiKeyOrJwt allá) — se guarda en texto plano en
  // `configuraciones`, igual que el enlace del API. Nunca se devuelve
  // completa al frontend (solo si hay una guardada), solo se usa server-side.
  async getBanaricaApiKey() {
    const config = await configuracionRepository.findByClave(CLAVE_BANARICA_API_KEY);
    return config?.valor || env.integrations.banaricaApiKey;
  },

  async setBanaricaApiKey(apiKey, actorId) {
    const config = await configuracionRepository.upsert(CLAVE_BANARICA_API_KEY, apiKey, actorId);
    return config.valor;
  },

  async getTasaConversion() {
    const config = await configuracionRepository.findByClave(CLAVE_TASA_CONVERSION);
    const valor = config?.valor ? Number(config.valor) : NaN;
    return Number.isFinite(valor) && valor > 0 ? valor : TASA_CONVERSION_DEFAULT;
  },

  async setTasaConversion(peso, actorId) {
    const config = await configuracionRepository.upsert(CLAVE_TASA_CONVERSION, String(peso), actorId);
    return Number(config.valor);
  },

  // Id de la primera semana (cronológicamente) a la que se le cargó
  // Programación de Corte alguna vez — usada para decidir si un aviso de
  // Rechazos de Logística de una semana previa a esa debe ignorarse (ver
  // rechazoCorteService.syncSemanaWebhook): esas semanas quedaron fuera del
  // seguimiento de Corbana desde antes de que este existiera.
  async getPrimeraSemanaProgramacionId() {
    const config = await configuracionRepository.findByClave(CLAVE_PRIMERA_SEMANA_PROGRAMACION);
    const valor = config?.valor ? Number(config.valor) : NaN;
    return Number.isInteger(valor) ? valor : null;
  },

  async setPrimeraSemanaProgramacionId(semanaId, actorId) {
    await configuracionRepository.upsert(CLAVE_PRIMERA_SEMANA_PROGRAMACION, String(semanaId), actorId);
  },

  async getAppVersionInfo() {
    const config = await configuracionRepository.findByClave(CLAVE_APP_VERSION_INFO);
    if (!config?.valor) return APP_VERSION_DEFAULT;
    try {
      return { ...APP_VERSION_DEFAULT, ...JSON.parse(config.valor) };
    } catch {
      return APP_VERSION_DEFAULT;
    }
  },

  async setAppVersionInfo(info, actorId) {
    const valor = JSON.stringify({
      latestVersion: info.latestVersion,
      minSupportedVersion: info.minSupportedVersion,
      downloadUrl: info.downloadUrl || '',
      releaseNotes: info.releaseNotes || '',
    });
    const config = await configuracionRepository.upsert(CLAVE_APP_VERSION_INFO, valor, actorId);
    return JSON.parse(config.valor);
  },

  async getMarcaApp() {
    const config = await configuracionRepository.findByClave(CLAVE_MARCA_APP);
    if (!config?.valor) return MARCA_APP_DEFAULT;
    try {
      return { ...MARCA_APP_DEFAULT, ...JSON.parse(config.valor) };
    } catch {
      return MARCA_APP_DEFAULT;
    }
  },

  async setMarcaApp(info, actorId) {
    const valor = JSON.stringify({
      nombreApp: info.nombreApp || MARCA_APP_DEFAULT.nombreApp,
      logoUrl: info.logoUrl || null,
    });
    const config = await configuracionRepository.upsert(CLAVE_MARCA_APP, valor, actorId);
    return JSON.parse(config.valor);
  },

  // Config de a quién poner en copia (CC) en los avisos de Sanidad Vegetal
  // — Evaluación de Labores (cargue y revisión aprobada), además de los
  // usuarios con el rol revisor configurado (ver
  // laborCultural.service.js#obtenerDestinatariosRevisores). Guarda tres
  // formas de agregar gente en copia — correos sueltos, roles completos
  // (cualquier usuario con ese rol, sin importar la finca) y usuarios
  // puntuales — la resolución a emails reales (roles/usuarios → email) se
  // hace en laborCultural.service.js#resolverCcCompleto, que sí tiene
  // acceso a los modelos User/Role.
  async getLaborRevisorCc() {
    const config = await configuracionRepository.findByClave(CLAVE_LABOR_REVISOR_CC);
    if (!config?.valor) return LABOR_REVISOR_CC_DEFAULT;
    try {
      const guardado = JSON.parse(config.valor);
      // Compatibilidad con el formato viejo (un array plano de correos).
      if (Array.isArray(guardado)) return { ...LABOR_REVISOR_CC_DEFAULT, correos: guardado };
      return { ...LABOR_REVISOR_CC_DEFAULT, ...guardado };
    } catch {
      return LABOR_REVISOR_CC_DEFAULT;
    }
  },

  async setLaborRevisorCc(cc, actorId) {
    const valor = JSON.stringify({
      correos: Array.isArray(cc?.correos) ? cc.correos : [],
      rolesUuids: Array.isArray(cc?.rolesUuids) ? cc.rolesUuids : [],
      usuariosUuids: Array.isArray(cc?.usuariosUuids) ? cc.usuariosUuids : [],
    });
    const config = await configuracionRepository.upsert(CLAVE_LABOR_REVISOR_CC, valor, actorId);
    return JSON.parse(config.valor);
  },

  // Config de quién recibe el correo semanal de Alertas de Sanidad Vegetal
  // (fincas con YLI bajo / Índice de Infección alto) — mismo formato que
  // getLaborRevisorCc: correos sueltos, roles completos y usuarios puntuales.
  // Resolución a emails reales en evaluacion.service.js#resolverDestinatariosAlertas.
  async getAlertasSanidadDestinatarios() {
    const config = await configuracionRepository.findByClave(CLAVE_ALERTAS_SANIDAD_DESTINATARIOS);
    if (!config?.valor) return ALERTAS_SANIDAD_DESTINATARIOS_DEFAULT;
    try {
      return { ...ALERTAS_SANIDAD_DESTINATARIOS_DEFAULT, ...JSON.parse(config.valor) };
    } catch {
      return ALERTAS_SANIDAD_DESTINATARIOS_DEFAULT;
    }
  },

  async setAlertasSanidadDestinatarios(destinatarios, actorId) {
    const valor = JSON.stringify({
      correos: Array.isArray(destinatarios?.correos) ? destinatarios.correos : [],
      rolesUuids: Array.isArray(destinatarios?.rolesUuids) ? destinatarios.rolesUuids : [],
      usuariosUuids: Array.isArray(destinatarios?.usuariosUuids) ? destinatarios.usuariosUuids : [],
    });
    const config = await configuracionRepository.upsert(CLAVE_ALERTAS_SANIDAD_DESTINATARIOS, valor, actorId);
    return JSON.parse(config.valor);
  },

  // Umbrales (líneas de referencia) del gráfico de Suma Bruta por Hoja —
  // ver evaluacion.service.js#alertasSemanaCerrada para el uso de `alerta`
  // como disparador de alerta por finca.
  async getSbHojaUmbrales() {
    const config = await configuracionRepository.findByClave(CLAVE_SB_HOJA_UMBRALES);
    if (!config?.valor) return SB_HOJA_UMBRALES_DEFAULT;
    try {
      const guardado = JSON.parse(config.valor);
      return { ...SB_HOJA_UMBRALES_DEFAULT, ...guardado };
    } catch {
      return SB_HOJA_UMBRALES_DEFAULT;
    }
  },

  async setSbHojaUmbrales(umbrales, actorId) {
    const advertencia = Number(umbrales?.advertencia);
    const alerta = Number(umbrales?.alerta);
    const valor = JSON.stringify({
      advertencia: Number.isFinite(advertencia) ? advertencia : SB_HOJA_UMBRALES_DEFAULT.advertencia,
      alerta: Number.isFinite(alerta) ? alerta : SB_HOJA_UMBRALES_DEFAULT.alerta,
    });
    const config = await configuracionRepository.upsert(CLAVE_SB_HOJA_UMBRALES, valor, actorId);
    return JSON.parse(config.valor);
  },
};

export default configuracionService;
