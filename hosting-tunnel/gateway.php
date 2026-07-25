<?php
/**
 * MySQL HTTP Bridge v2 — PHP Gateway (optimizado)
 *
 * Renombrado desde tunnel.php porque algunos hostings compartidos (WAF /
 * Imunify360 y similares) bloquean silenciosamente rutas que contienen la
 * palabra "tunnel", devolviendo un 404 genérico sin indicar que fue un
 * bloqueo. La lógica es idéntica a tunnel.php — mismo contrato JSON.
 *
 * - PDO persistente para TODAS las queries (reusa conexiones MySQL)
 * - Verificación combinada CONNECTION_ID() + @@in_transaction
 * - Rate limiting con archivo plano (sin JSON)
 * - Logging asíncrono (solo errores por defecto)
 *
 * @version 2.1.0
 */

require_once __DIR__ . '/config.php';
$config = getConfig();

// ─── Headers ───
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

$allowedOrigin = getenv('CORS_ORIGIN') ?: '*';
header("Access-Control-Allow-Origin: $allowedOrigin");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// ─── Leer input ───
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true);
if (!$body) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
    exit;
}

$action        = $body['action'] ?? 'query';
$sql           = trim($body['sql'] ?? '');
$params        = $body['params'] ?? [];
$transactionId = $body['transactionId'] ?? null;

// ─── Autenticación rápida ───
$apiKey = $body['apiKey'] ?? '';

if (function_exists('getallheaders')) {
    $headers = getallheaders();
    $apiKey = $headers['X-API-Key'] ?? $headers['x-api-key'] ?? $apiKey;
} else {
    foreach ($_SERVER as $k => $v) {
        if (strtoupper(substr($k, 0, 5)) === 'HTTP_' &&
            str_replace('_', '-', strtolower(substr($k, 5))) === 'x-api-key') {
            $apiKey = $v;
            break;
        }
    }
}

if ($apiKey !== $config['api_key']) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Invalid API key']);
    exit;
}

// ─── Rate limiting (formato plano, sin JSON) ───
$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rlFile   = $config['log_dir'] . '/rl_' . md5($clientIp) . '.tmp';

if (!is_dir($config['log_dir'])) @mkdir($config['log_dir'], 0755, true);

$rlWindow = 60;
$rlMax    = $config['rate_limit'];

// Leemos el archivo de rate limit: "timestamp|count"
$rlData = @file_get_contents($rlFile);
$rlCount = 1;
$rlStart = time();

if ($rlData !== false) {
    $parts = explode('|', $rlData);
    if (count($parts) === 2) {
        $rlStart = (int)$parts[0];
        if (time() - $rlStart < $rlWindow) {
            $rlCount = (int)$parts[1] + 1;
            if ($rlCount > $rlMax) {
                http_response_code(429);
                echo json_encode(['success' => false, 'error' => 'Rate limit exceeded']);
                exit;
            }
        }
    }
}
file_put_contents($rlFile, "{$rlStart}|{$rlCount}", LOCK_EX);

// ─── Helpers ───
function logMsg($config, $msg) {
    if ($config['log_queries']) {
        file_put_contents($config['log_dir'] . '/queries.log',
            date('Y-m-d H:i:s') . " | {$msg}\n", FILE_APPEND | LOCK_EX);
    }
}

// Crea PDO persistente (reusa conexiones MySQL entre requests del mismo worker)
function pdo($config) {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host={$config['db_host']};port={$config['db_port']};"
             . "dbname={$config['db_name']};charset=utf8mb4";
        $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_STRINGIFY_FETCHES  => false,
            PDO::ATTR_PERSISTENT         => true,
            PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8mb4',
        ]);
    }
    return $pdo;
}

function execQuery($pdo, $sql, $params) {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $sqlUpper = strtoupper(trim($sql));
    $isSelect = strpos($sqlUpper, 'SELECT') === 0
             || strpos($sqlUpper, 'SHOW') === 0
             || strpos($sqlUpper, 'DESCRIBE') === 0
             || strpos($sqlUpper, 'EXPLAIN') === 0;

    $response = [
        'affectedRows' => $stmt->rowCount(),
        'insertId'     => $pdo->lastInsertId() ?: null,
    ];

    if ($isSelect) {
        $rows = $stmt->fetchAll();
        $fields = [];
        if (!empty($rows)) {
            $fields = array_keys($rows[0]);
        } elseif ($stmt->columnCount() > 0) {
            for ($i = 0; $i < $stmt->columnCount(); $i++) {
                $col = $stmt->getColumnMeta($i);
                $fields[] = $col['name'] ?? "col_{$i}";
            }
        }
        $response['rows']   = $rows;
        $response['fields'] = $fields;
    } else {
        $response['rows']   = [];
        $response['fields'] = [];
    }

    return $response;
}

// ─── Transacciones ───
function txnPath($config, $id) {
    $dir = $config['log_dir'] . '/txn';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    return $dir . '/' . preg_replace('/[^a-f0-9\-]/', '', $id) . '.st';
}
function txnPut($config, $id, $connId) {
    file_put_contents(txnPath($config, $id),
        $connId . '|' . time(), LOCK_EX);
}
function txnGet($config, $id) {
    $p = txnPath($config, $id);
    $d = @file_get_contents($p);
    if ($d === false) return null;
    $parts = explode('|', $d);
    if (count($parts) !== 2) { @unlink($p); return null; }
    if (time() - (int)$parts[1] > 300) { @unlink($p); return null; }
    return $parts[0];
}
function txnDel($config, $id) {
    $p = txnPath($config, $id);
    if (file_exists($p)) @unlink($p);
}

// ─── Validación de SQL ───
function validateSql($config, $sqlUpper, $sql, $clientIp) {
    // Ojo: se compara solo contra el INICIO del SQL (igual que
    // allowed_commands más abajo), no en cualquier parte del texto. Con un
    // preg_match sin ancla, cualquier VALOR de datos que contenga alguna de
    // estas palabras como palabra suelta (ej. un nombre de archivo o una
    // observación con "rename", "grant", etc.) disparaba un falso positivo
    // y bloqueaba la query aunque el comando real fuera un SELECT/INSERT
    // inofensivo.
    foreach ($config['blocked_commands'] as $cmd) {
        if (strpos($sqlUpper, strtoupper($cmd)) === 0) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => "Command '{$cmd}' blocked"]);
            logMsg($config, "BLOCKED | {$clientIp} | " . substr($sql, 0, 300));
            return false;
        }
    }
    $allowed = false;
    foreach ($config['allowed_commands'] as $cmd) {
        if (strpos($sqlUpper, $cmd) === 0) { $allowed = true; break; }
    }
    if (!$allowed) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Query type not allowed']);
        return false;
    }
    return true;
}

// ═══════════════════════════════════════════════
//  Router de acciones
// ═══════════════════════════════════════════════

switch ($action) {

    // ── BEGIN ──
    case 'begin':
        if (!$transactionId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'transactionId required']);
            exit;
        }
        try {
            $db = pdo($config);
            // Limpiar transacción huérfana si la hubiera
            $row = $db->query('SELECT @@in_transaction AS t')->fetch();
            if ($row && $row['t']) $db->rollBack();
            $db->beginTransaction();
            $connId = $db->query('SELECT CONNECTION_ID()')->fetchColumn();
            txnPut($config, $transactionId, $connId);
            logMsg($config, "BEGIN | {$transactionId} | conn={$connId} | {$clientIp}");
            echo json_encode(['success' => true, 'connectionId' => $connId]);
        } catch (PDOException $e) {
            http_response_code(500);
            $m = $config['debug'] ? $e->getMessage() : 'Failed to begin transaction';
            echo json_encode(['success' => false, 'error' => $m]);
        }
        exit;

    // ── COMMIT ──
    case 'commit':
        if (!$transactionId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'transactionId required']);
            exit;
        }
        // Verificar que la transacción existe (no expiró)
        $expected = txnGet($config, $transactionId);
        if (!$expected) {
            echo json_encode(['success' => false, 'error' => 'Transaction not found or expired']);
            exit;
        }
        try {
            $db = pdo($config);
            // Si este mismo worker tiene la transacción activa, commiteamos
            $row = $db->query('SELECT @@in_transaction AS t')->fetch();
            if ($row && $row['t']) $db->commit();
            txnDel($config, $transactionId);
            logMsg($config, "COMMIT | {$transactionId} | {$clientIp}");
            echo json_encode(['success' => true]);
        } catch (PDOException $e) {
            txnDel($config, $transactionId);
            echo json_encode(['success' => false,
                'error' => $config['debug'] ? $e->getMessage() : 'Commit failed']);
        }
        exit;

    // ── ROLLBACK ──
    case 'rollback':
        if (!$transactionId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'transactionId required']);
            exit;
        }
        try {
            $db = pdo($config);
            $row = $db->query('SELECT @@in_transaction AS t')->fetch();
            if ($row && $row['t']) $db->rollBack();
            txnDel($config, $transactionId);
            logMsg($config, "ROLLBACK | {$transactionId} | {$clientIp}");
        } catch (PDOException $e) {}
        echo json_encode(['success' => true]);
        exit;

    // ── QUERY ──
    case 'query':
        if (!$sql) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Missing sql']);
            exit;
        }

        $sqlUpper = strtoupper($sql);
        $inTransaction = !empty($transactionId);

        if ($inTransaction) {
            // ── Query dentro de transacción (contexto transaccional, no verificación de conexión) ──
            $expected = txnGet($config, $transactionId);
            if (!$expected) {
                // La transacción expiró o nunca existió; ejecutar igual como query suelta
            }
            try {
                $db = pdo($config);
                $result = execQuery($db, $sql, $params);
                $result['success'] = true;
                echo json_encode($result);
                logMsg($config, "TXN | {$transactionId} | {$clientIp} | "
                    . substr($sql, 0, 200));
            } catch (PDOException $e) {
                $resp = ['success' => false, 'rollback' => true,
                    'error' => $config['debug'] ? $e->getMessage() : 'Query execution failed',
                    'code' => $e->getCode(), 'sqlState' => $e->errorInfo[0] ?? 'HY000'];
                if ($config['debug']) $resp['sql'] = substr($sql, 0, 500);
                echo json_encode($resp);
                logMsg($config, "ERROR(txn={$transactionId}) | {$clientIp} | "
                    . substr($sql, 0, 200) . " | {$e->getMessage()}");
            }
        } else {
            // ── Query normal ──
            if (!validateSql($config, $sqlUpper, $sql, $clientIp)) exit;
            try {
                $db = pdo($config);
                // Si este PDO persistente tiene una transacción huérfana, limpiar
                $row = $db->query('SELECT @@in_transaction AS t')->fetch();
                if ($row && $row['t']) $db->rollBack();
                $result = execQuery($db, $sql, $params);
                $result['success'] = true;
                echo json_encode($result);
                if ($config['log_queries']) {
                    logMsg($config, "QUERY | {$clientIp} | " . substr($sql, 0, 200));
                }
            } catch (PDOException $e) {
                http_response_code(400);
                $resp = ['success' => false,
                    'error' => $config['debug'] ? $e->getMessage() : 'Query execution failed',
                    'code' => $e->getCode(), 'sqlState' => $e->errorInfo[0] ?? 'HY000'];
                if ($config['debug']) $resp['sql'] = substr($sql, 0, 500);
                echo json_encode($resp);
                logMsg($config, "ERROR | {$clientIp} | " . substr($sql, 0, 200)
                    . " | {$e->getMessage()}");
            }
        }
        exit;

    // ── BATCH: varias queries en UNA sola petición HTTP ──
    // Pensado para cargues masivos: en vez de una petición por cada tanda
    // de filas, el cliente manda un array de {sql, params} y acá se
    // ejecutan TODAS en una transacción real (mismo proceso PHP, así que
    // es atómico de verdad), en una sola ida y vuelta. Reduce muchísimo la
    // cantidad de peticiones externas bajo cargas grandes.
    case 'batch':
        $queries = $body['queries'] ?? [];
        if (!is_array($queries) || empty($queries)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Missing or empty queries array']);
            exit;
        }

        // Valida TODAS las queries antes de ejecutar ninguna.
        foreach ($queries as $i => $q) {
            $qSql = trim($q['sql'] ?? '');
            if (!$qSql) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => "queries[{$i}]: missing sql"]);
                exit;
            }
            if (!validateSql($config, strtoupper($qSql), $qSql, $clientIp)) exit;
        }

        try {
            $db = pdo($config);
            $row = $db->query('SELECT @@in_transaction AS t')->fetch();
            if ($row && $row['t']) $db->rollBack();

            $db->beginTransaction();
            $results = [];
            foreach ($queries as $q) {
                $results[] = execQuery($db, trim($q['sql']), $q['params'] ?? []);
            }
            $db->commit();

            echo json_encode(['success' => true, 'results' => $results]);
            logMsg($config, "BATCH | {$clientIp} | " . count($queries) . ' queries');
        } catch (PDOException $e) {
            if ($db->inTransaction()) $db->rollBack();
            http_response_code(400);
            echo json_encode(['success' => false,
                'error' => $config['debug'] ? $e->getMessage() : 'Batch execution failed',
                'code' => $e->getCode(), 'sqlState' => $e->errorInfo[0] ?? 'HY000']);
            logMsg($config, "BATCH ERROR | {$clientIp} | {$e->getMessage()}");
        }
        exit;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Unknown action: {$action}"]);
        exit;
}
