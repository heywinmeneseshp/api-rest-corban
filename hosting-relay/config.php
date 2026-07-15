<?php
/**
 * MySQL HTTP Bridge — Configuration (RELAY en otro hosting)
 *
 * Esta copia corre en un servidor DISTINTO al de la base de datos de
 * banarica. A diferencia de hosting-tunnel/config.php (que conecta a
 * MySQL por 'localhost' porque corre en el mismo servidor que la BD),
 * aquí 'db_host' debe apuntar a la IP/host REMOTO del servidor de
 * banarica, ya que este script y la base de datos viven en máquinas
 * diferentes.
 *
 * Requisito: la IP pública de ESTE servidor (donde corre este script)
 * debe estar autorizada en "MySQL Remoto" del cPanel de banarica.
 *
 * IMPORTANTE: reemplaza los valores CAMBIAR_* por los datos reales antes
 * de subir este archivo. Nunca reutilices credenciales de otro proyecto.
 */

function getConfig() {
    return [
        // ─── Conexión REMOTA a MySQL de banarica (no localhost) ───
        'db_host' => getenv('DB_HOST') ?: 'CAMBIAR_ip_o_host_de_banarica', // ej: 184.107.175.201
        'db_port' => getenv('DB_PORT') ?: '3306',
        'db_name' => getenv('DB_NAME') ?: 'CAMBIAR_nombre_base_datos',
        'db_user' => getenv('DB_USER') ?: 'CAMBIAR_usuario_mysql',
        'db_pass' => getenv('DB_PASS') ?: 'CAMBIAR_password_mysql',

        // ─── Seguridad ───
        // Debe ser EXACTAMENTE la misma que BRIDGE_API_KEY del .env/Vercel de la API.
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
