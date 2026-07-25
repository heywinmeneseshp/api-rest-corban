/**
 * MySQL HTTP Bridge v2 — Reemplazo DROP-IN para mysql2 en Sequelize
 *
 * Copiado desde el proyecto "Conector DB PHP" (fuente canónica del adaptador
 * y de tunnel.php). Se guarda como .cjs porque este proyecto es ESM
 * ("type": "module") y este módulo usa CommonJS (require/module.exports);
 * Node permite importarlo igual con `import mysqlHttpBridge from './mysqlHttpBridge.cjs'`.
 *
 * Optimizado: HTTP keep-alive, persistent PDO en PHP, verificación combinada.
 *
 * Uso (ver src/config/database.config.js):
 *   dialect: 'mysql',
 *   dialectModule: mysqlHttpBridge,
 *   dialectOptions: { bridgeUrl: ..., bridgeApiKey: ... }
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const zlib = require('zlib');
const { EventEmitter } = require('events');

// ─── Reintentos ante fallas transitorias ───
// El hosting compartido pone Imunify360 delante del túnel; bajo ráfagas de
// tráfico a veces responde con una página de desafío HTML en vez del JSON
// esperado (detectable: falla el parseo), o directamente corta la
// conexión. En esos casos la query casi seguro NUNCA llegó a ejecutarse en
// el servidor (el firewall la interceptó antes), así que reintentar es
// seguro — a diferencia de un error real de la BD (clave duplicada, SQL
// bloqueado, etc.), que jamás se reintenta para no duplicar escrituras.
const MAX_REINTENTOS = 4;
const BACKOFF_BASE_MS = 500;
const esErrorTransitorio = (err) => /Bridge non-JSON|Bridge connection:/.test(err.message || '');
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// gateway.php SIEMPRE incluye un `error` en cualquier respuesta
// success:false (verificado: no hay ningún caso en el PHP que devuelva
// success:false sin texto de error). Si llega un success:false SIN mensaje,
// esa respuesta no salió de nuestro script — es alguna otra capa (firewall
// del hosting, caché, etc.) devolviendo un JSON con esa forma por las
// suyas. Es igual de seguro reintentarlo que los casos de "non-JSON".
const esRespuestaFallidaSinOrigenPropio = (resp) => resp && resp.success === false && !resp.error;

// ─── HTTP Agent con keep-alive (reusa sockets TCP/TLS) ───
const KEEP_ALIVE_MS = 60000;

const agents = {
    'https:': new https.Agent({
        keepAlive: true,
        keepAliveMsecs: KEEP_ALIVE_MS,
        maxSockets: 25,
        maxFreeSockets: 10,
        timeout: KEEP_ALIVE_MS,
    }),
    'http:': new http.Agent({
        keepAlive: true,
        keepAliveMsecs: KEEP_ALIVE_MS,
        maxSockets: 25,
        maxFreeSockets: 10,
    }),
};

// ─── UUID v4 (fallback para Node < 19) ───
const randomUUID = crypto.randomUUID || (() => {
    const hex = crypto.randomBytes(16);
    hex[6] = (hex[6] & 0x0f) | 0x40;
    hex[8] = (hex[8] & 0x3f) | 0x80;
    const s = hex.toString('hex');
    return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
});

// ─── Regex de comandos de transacción ───
const TXN_BEGIN_RE    = /^\s*(?:BEGIN|START\s+TRANSACTION)\s*;?\s*$/i;
const TXN_COMMIT_RE   = /^\s*COMMIT\s*;?\s*$/i;
const TXN_ROLLBACK_RE = /^\s*ROLLBACK\s*;?\s*$/i;

// ─── Cache de URL parseada ───
const _urlCache = new Map();

function parseBridgeUrl(url) {
    let cached = _urlCache.get(url);
    if (cached) return cached;
    const re = /^(https?:\/\/[^\/]+)(\/.*)?$/;
    const m = url.match(re);
    if (!m) throw new Error(`Invalid bridgeUrl: ${url}`);
    const u = new URL(m[1]);
    cached = {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? '443' : '80'),
        pathname: m[2] || '/tunnel.php',
    };
    _urlCache.set(url, cached);
    return cached;
}

// ─── Petición HTTP POST (reusable) ───
function httpPost(urlObj, body, apiKey, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const mod = urlObj.protocol === 'https:' ? https : http;
        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
            'Connection': 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Origin': `${urlObj.protocol}//${urlObj.hostname}`,
        };
        if (apiKey) headers['X-API-Key'] = apiKey;

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname,
            method: 'POST',
            headers,
            agent: agents[urlObj.protocol],
            rejectUnauthorized: true,
            timeout: timeoutMs,
        };

        const req = mod.request(options, (res) => {
            const buffers = [];
            res.on('data', (chunk) => { buffers.push(chunk); });
            res.on('end', () => {
                const raw = Buffer.concat(buffers);
                // El servidor puede responder comprimido (gzip/deflate/br) porque
                // mandamos Accept-Encoding; hay que descomprimir antes de parsear JSON.
                const encoding = (res.headers['content-encoding'] || '').toLowerCase();
                let decompress;
                if (encoding === 'gzip') decompress = zlib.gunzipSync;
                else if (encoding === 'br') decompress = zlib.brotliDecompressSync;
                else if (encoding === 'deflate') decompress = zlib.inflateSync;

                let text;
                try {
                    text = (decompress ? decompress(raw) : raw).toString('utf8');
                    resolve({ status: res.statusCode, body: JSON.parse(text) });
                } catch (e) {
                    reject(Object.assign(
                        new Error(`Bridge non-JSON (HTTP ${res.statusCode})`),
                        { statusCode: res.statusCode, raw: (text || raw.toString('utf8')).slice(0, 500) }
                    ));
                }
            });
        });

        req.on('error',  (err) => reject(new Error(`Bridge connection: ${err.message}`)));
        req.on('timeout', () => { req.destroy(); reject(new Error('Bridge request timed out')); });
        req.write(data);
        req.end();
    });
}

// ─── Connection class ───
class HttpBridgeConnection extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.threadId = Math.floor(Math.random() * 100000) + 1;
        this._destroyed = false;
        this._transactionId = null;

        // Sequelize's ConnectionManager.validate() (usado por el pool antes
        // de reusar una conexión) revisa `connection.stream.destroyed`,
        // asumiendo el socket TCP interno de mysql2 real. No tenemos socket,
        // así que exponemos un `stream` sintético reflejando `_destroyed`.
        Object.defineProperty(this, 'stream', {
            get: () => ({ destroyed: this._destroyed }),
        });

        const dopts = config.dialectOptions || {};
        this._bridgeUrl = dopts.bridgeUrl || config.bridgeUrl || process.env.BRIDGE_URL;
        this._apiKey   = dopts.bridgeApiKey || config.bridgeApiKey || process.env.BRIDGE_API_KEY;

        if (!this._bridgeUrl) throw new Error(
            'BRIDGE_URL required. Set in .env, config.bridgeUrl, or dialectOptions.bridgeUrl');
        if (!this._apiKey) throw new Error(
            'BRIDGE_API_KEY required. Set in .env, config.bridgeApiKey, or dialectOptions.bridgeApiKey');

        this._urlObj = parseBridgeUrl(this._bridgeUrl);

        // Sequelize (dialecto mysql2) NO llama a .connect() como método: crea
        // la conexión y luego escucha el EVENTO 'connect' (once) / 'error'
        // sobre el objeto devuelto por createConnection(), asumiendo el
        // comportamiento de auto-conexión de mysql2 real. Sin este emit, la
        // promesa de conexión de Sequelize se queda esperando para siempre.
        // Se agenda con setImmediate para que corra después de que Sequelize
        // alcance a registrar sus listeners (código síncrono justo después
        // de createConnection()).
        setImmediate(() => this.connect((err) => {
            if (err) this.emit('error', err);
            else this.emit('connect');
        }));
    }

    // ─── connect ───
    connect(callback) {
        if (this._destroyed) return this._error(new Error('Connection destroyed'), callback);
        this._send({ action: 'query', sql: 'SELECT 1 AS test', params: [] }, (err) => {
            if (err) { return callback && callback(err); }
            callback && callback(null);
        });
    }

    // ─── query ───
    // Nota: Sequelize hace `connection.query(...).setMaxListeners(100)`,
    // asumiendo que mysql2 devuelve un emisor de eventos (soporta streaming).
    // Por eso SIEMPRE devolvemos `this` (somos un EventEmitter) al final,
    // sin importar la rama que se ejecutó — nunca `undefined`.
    query(sql, params, callback) {
        if (typeof params === 'function') { callback = params; params = []; }
        if (typeof sql === 'object') {
            params = sql.values || sql.parameters || [];
            sql = sql.sql || sql.query || '';
        }
        callback = callback || (() => {});

        if (TXN_BEGIN_RE.test(sql))    { this._begin(callback); return this; }
        if (TXN_COMMIT_RE.test(sql))   { this._commit(callback); return this; }
        if (TXN_ROLLBACK_RE.test(sql)) { this._rollback(callback); return this; }

        if (this._transactionId) {
            this._send({
                action: 'query', transactionId: this._transactionId,
                sql, params: params || [],
            }, (err, resp) => {
                if (err) return callback(err);
                this._formatAndCallback(sql, resp, callback);
            });
            return this;
        }

        this._send({ action: 'query', sql, params: params || [] }, (err, resp) => {
            if (err) return callback(err);
            this._formatAndCallback(sql, resp, callback);
        });
        return this;
    }

    // ─── execute ───
    execute(sql, params, callback) {
        if (typeof params === 'function') { callback = params; params = []; }
        callback = callback || (() => {});

        if (this._transactionId) {
            this._send({
                action: 'query', transactionId: this._transactionId,
                sql, params: params || [],
            }, (err, resp) => {
                if (err) return callback(err);
                this._formatAndCallback(sql, resp, callback);
            });
            return this;
        }

        this._send({ action: 'query', sql, params: params || [] }, (err, resp) => {
            if (err) return callback(err);
            this._formatAndCallback(sql, resp, callback);
        });
        return this;
    }

    // ─── Transacciones ───
    _begin(callback) {
        if (this._transactionId) return callback(null, { affectedRows: 0, insertId: 0 });
        this._transactionId = randomUUID();
        this._send({ action: 'begin', transactionId: this._transactionId }, (err) => {
            if (err) { this._transactionId = null; return callback(err); }
            callback(null, { affectedRows: 0, insertId: 0 });
        });
    }

    _commit(callback) {
        const txnId = this._transactionId;
        if (!txnId) return callback(null, { affectedRows: 0, insertId: 0 });
        this._transactionId = null;
        this._send({ action: 'commit', transactionId: txnId }, (err) => {
            if (err) return callback(err);
            callback(null, { affectedRows: 0, insertId: 0 });
        });
    }

    _rollback(callback) {
        const txnId = this._transactionId;
        if (!txnId) return callback(null, { affectedRows: 0, insertId: 0 });
        this._transactionId = null;
        this._send({ action: 'rollback', transactionId: txnId }, () => {
            callback(null, { affectedRows: 0, insertId: 0 });
        });
    }

    // ─── Envío al bridge (con reintento ante fallas transitorias) ───
    _send(body, callback) {
        if (this._destroyed) return this._error(new Error('Connection destroyed'), callback);
        body.apiKey = this._apiKey;

        const intentar = async (intento) => {
            try {
                const { body: resp } = await httpPost(this._urlObj, body, this._apiKey);

                if (esRespuestaFallidaSinOrigenPropio(resp) && intento < MAX_REINTENTOS) {
                    await esperar(BACKOFF_BASE_MS * 2 ** (intento - 1));
                    return intentar(intento + 1);
                }

                if (!resp.success) {
                    const err = new Error(resp.error || 'Bridge query failed (respuesta sin mensaje — probablemente no es del gateway)');
                    err.code = resp.code || 'ER_BRIDGE_ERROR';
                    err.sqlState = resp.sqlState || 'HY000';
                    return callback(err, resp);
                }
                callback(null, resp);
            } catch (err) {
                if (esErrorTransitorio(err) && intento < MAX_REINTENTOS) {
                    await esperar(BACKOFF_BASE_MS * 2 ** (intento - 1));
                    return intentar(intento + 1);
                }
                this.emit('error', err);
                callback(err);
            }
        };

        intentar(1);
    }

    // ─── Formateo de resultados ───
    _formatAndCallback(sql, resp, callback) {
        const isSelect = /^(SELECT|SHOW|DESCRIBE|EXPLAIN)\b/i.test(sql.trim());
        if (isSelect) {
            const rows = resp.rows || [];
            const fields = (resp.fields || (rows.length ? Object.keys(rows[0]) : []))
                .map((name) => ({ name, type: 253 }));
            callback(null, rows, fields);
        } else {
            callback(null, {
                fieldCount: 0,
                affectedRows: resp.affectedRows || 0,
                insertId: resp.insertId != null ? Number(resp.insertId) : 0,
                serverStatus: 2, warningCount: 0, message: '',
                protocol41: true, changedRows: resp.affectedRows || 0,
            });
        }
    }

    // ─── end / destroy ───
    end(callback) {
        if (this._transactionId) {
            this._rollback(() => { this._destroyed = true; callback && callback(null); });
        } else {
            this._destroyed = true;
            callback && callback(null);
        }
    }

    destroy() { this._destroyed = true; this._transactionId = null; }

    // ─── Otros ───
    ping(cb)            { cb && cb(null); }
    changeUser(o, cb)   { if (typeof o === 'function') cb = o; cb && cb(null); }
    pause() {}
    resume() {}

    _error(err, cb) { this.emit('error', err); cb && cb(err); }

    escape(v) {
        if (v == null) return 'NULL';
        if (typeof v === 'number') return String(v);
        if (typeof v === 'boolean') return v ? '1' : '0';
        if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
        return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    escapeId(v) { return '`' + String(v).replace(/`/g, '``') + '`'; }
    format(sql, values) {
        if (!values) return sql;
        const copy = [...values];
        return sql.replace(/\?/g, () => this.escape(copy.shift()));
    }
}

// ─── Envío de lote: varias queries en UNA sola petición HTTP ───
// Pensado para cargues masivos: en vez de una petición por cada tanda de
// filas (lo normal con Sequelize, una query = un _send()), se manda un
// array de {sql, params} y el gateway.php las corre TODAS en una
// transacción real del lado del servidor (mismo proceso PHP, así que es
// atómico de verdad — a diferencia de mandar queries sueltas bajo el mismo
// transactionId, que depende de que caigan en el mismo worker de PHP-FPM).
// Baja drásticamente la cantidad de peticiones externas, que es lo que
// dispara los bloqueos del firewall del hosting bajo ráfagas de tráfico.
async function sendBatch(bridgeUrl, bridgeApiKey, queries) {
    const urlObj = parseBridgeUrl(bridgeUrl);
    const body = { action: 'batch', queries, apiKey: bridgeApiKey };

    for (let intento = 1; ; intento += 1) {
        try {
            const { body: resp } = await httpPost(urlObj, body, bridgeApiKey, 60000);

            if (esRespuestaFallidaSinOrigenPropio(resp) && intento < MAX_REINTENTOS) {
                await esperar(BACKOFF_BASE_MS * 2 ** (intento - 1));
                continue;
            }

            if (!resp.success) {
                const err = new Error(resp.error || 'Batch query failed (respuesta sin mensaje — probablemente no es del gateway)');
                err.code = resp.code || 'ER_BRIDGE_ERROR';
                err.sqlState = resp.sqlState || 'HY000';
                throw err;
            }
            return resp.results;
        } catch (err) {
            if (esErrorTransitorio(err) && intento < MAX_REINTENTOS) {
                await esperar(BACKOFF_BASE_MS * 2 ** (intento - 1));
                continue;
            }
            throw err;
        }
    }
}

// ─── Exports ───
module.exports = {
    sendBatch,
    createConnection: (config) => new HttpBridgeConnection(config),
    createPool: (config) => {
        const conn = new HttpBridgeConnection(config);
        return {
            getConnection: (cb) => cb(null, conn),
            query: (sql, p, cb) => conn.query(sql, p, cb),
            execute: (sql, p, cb) => conn.execute(sql, p, cb),
            end: (cb) => { conn.destroy(); cb && cb(); },
            on: () => {},
        };
    },
};
