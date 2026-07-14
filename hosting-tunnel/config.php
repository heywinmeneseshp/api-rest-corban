<?php
/**
 * MySQL HTTP Bridge — Configuration (api-rest-corbana)
 *
 * Las variables de entorno tienen prioridad sobre los valores por defecto.
 *
 * IMPORTANTE: reemplaza los valores por defecto de abajo (db_name, db_user,
 * db_pass, api_key) por los datos REALES de tu hosting antes de subir este
 * archivo. Nunca reutilices credenciales de otro proyecto/hosting.
 */

function getConfig() {
    return [
        // ─── Conexión local MySQL (dentro del hosting, host siempre localhost) ───
        'db_host' => getenv('DB_HOST') ?: 'localhost',
        'db_port' => getenv('DB_PORT') ?: '3306',
        'db_name' => getenv('DB_NAME') ?: 'CAMBIAR_nombre_base_datos',
        'db_user' => getenv('DB_USER') ?: 'CAMBIAR_usuario_mysql',
        'db_pass' => getenv('DB_PASS') ?: 'CAMBIAR_password_mysql',

        // ─── Seguridad ───
        // Genera una clave única y larga (ver README.md de esta carpeta) y
        // usa EXACTAMENTE la misma en BRIDGE_API_KEY del .env de la API.
        'api_key' => getenv('BRIDGE_API_KEY') ?: 'CAMBIAR_clave_secreta_larga_y_unica',

        // ─── Rate limiting (peticiones/minuto/IP) ───
        'rate_limit' => 300,

        // ─── Comandos SQL permitidos ───
        'allowed_commands' => [
            'SELECT', 'INSERT', 'UPDATE', 'DELETE',
            'SHOW', 'DESCRIBE', 'EXPLAIN',
            'BEGIN', 'COMMIT', 'ROLLBACK',
            'SET', 'START', 'REPLACE', 'CALL',
            'CREATE', 'ALTER',
        ],

        // ─── Comandos bloqueados ───
        'blocked_commands' => [
            'DROP', 'TRUNCATE',
            'GRANT', 'REVOKE', 'RENAME',
        ],

        // ─── Logging (false = solo errores; true = todas las queries) ───
        'log_queries' => false,

        // ─── Directorio de logs ───
        'log_dir' => __DIR__ . '/logs',

        // ─── Debug (muestra detalles del error — desactivar en producción) ───
        'debug' => false,
    ];
}
