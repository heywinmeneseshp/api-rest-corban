# Bridge HTTP MySQL — despliegue para api-rest-corbana

Permite que esta API conecte a una base de datos MySQL en un **hosting
compartido que bloquea conexiones externas al puerto 3306** (típico en
cPanel/Plesk). En vez de conectar directo, la API envía las queries por
HTTPS a un script PHP en el mismo hosting, que las ejecuta contra MySQL
`localhost` y devuelve el resultado.

```
Node.js (api-rest-corbana) ──HTTPS──▶ gateway.php (hosting) ──PDO──▶ MySQL (localhost)
```

> **⚠️ Importante — subir SIN subcarpeta:** en algunas cuentas/dominios
> (confirmado en un dominio de cPanel recién creado) el servidor solo sirve
> archivos que están **directamente en la raíz del document root**;
> cualquier archivo dentro de una subcarpeta (`tunnel/`, `bridge/`,
> `puente/`, el nombre que sea) da 404 aunque exista, tenga los permisos
> correctos, y no sea tema de caché ni de PHP. Por eso `gateway.php` y
> `config.php` van sueltos aquí, sin subcarpeta — súbelos así:
> `/public_html/gateway.php` (o la raíz del dominio que corresponda), **no**
> `/public_html/algo/gateway.php`. Si tu hosting sí sirve subcarpetas sin
> problema, puedes organizarlos en una si prefieres — pero si te da 404
> "fantasma" (el archivo existe pero nunca responde), este es el motivo.

Guía completa y solución de problemas (versión larga, con más contexto):
`C:\Users\onides\Documents\GitHub\Conector DB PHP\USAGE.md`
(este README es la versión corta ya adaptada a las rutas/variables de
**este** proyecto).

## 1. Editar `config.php`

Antes de subir nada, edita los valores `CAMBIAR_*` en [config.php](config.php)
con las credenciales **reales** de la base de datos del hosting (las
consigues en su panel: cPanel → "MySQL Databases", etc. — el `host` para
PHP siempre es `localhost`, aunque desde tu PC uses otro hostname):

```php
'db_name' => getenv('DB_NAME') ?: 'tu_basededatos_real',
'db_user' => getenv('DB_USER') ?: 'tu_usuario_real',
'db_pass' => getenv('DB_PASS') ?: 'tu_password_real',
'api_key' => getenv('BRIDGE_API_KEY') ?: 'una-clave-larga-y-unica',
```

Genera la `api_key` con (PowerShell):
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

## 2. Subir por FTP

Sube `gateway.php` y `config.php` (los dos archivos de esta carpeta)
**directo a la raíz** del document root del dominio, sin meterlos en ninguna
subcarpeta:
```
/public_html/gateway.php
/public_html/config.php
```
(ajusta `public_html` si tu dominio usa otra carpeta como document root).
Verifica que carguen visitando `https://tudominio.com/gateway.php` en el
navegador — debe responder `{"success":false,"error":"Method not allowed"}`
(es correcto, solo acepta POST).

**Si en cambio ves un 404 real** (página genérica del servidor, no ese
JSON) y confirmaste que el archivo SÍ está ahí (Administrador de Archivos),
prueba primero moviéndolo a la raíz si lo tenías en una subcarpeta — es la
causa más común (ver nota de arriba). Si aun así 404 en la raíz, revisa el
Error Log de cPanel o contacta soporte del hosting.

## 3. Probar desde tu PC

```bash
curl -X POST https://tudominio.com/gateway.php \
  -H "Content-Type: application/json" \
  -H "X-API-Key: TU_API_KEY" \
  -d "{\"sql\":\"SELECT 1 AS test\",\"params\":[]}"
```
Respuesta esperada: `{"success":true,...,"rows":[{"test":1}],...}`

## 4. Activar el modo bridge en la API

En `api-rest-corbana/.env`:
```env
DB_MODE=bridge
BRIDGE_URL=https://tudominio.com/gateway.php
BRIDGE_API_KEY=TU_API_KEY
# DB_NAME/DB_USER/DB_PASSWORD deben coincidir con lo que pusiste en config.php
# (Sequelize los usa para su propio bookkeeping; la conexión real la hace PHP)
```

Para volver al modo directo (MySQL local), simplemente `DB_MODE=direct`.

## 5. Arrancar y verificar

```bash
npm run dev
```
El log de arranque mostrará `Conexión a la base de datos establecida
correctamente (modo: bridge)`. Prueba un endpoint (`GET /api/v1/fincas` con
token) — si responde con datos, el bridge funciona.

## Notas importantes

- **Migraciones** (`npm run db:migrate`) funcionan por el bridge: `CREATE` y
  `ALTER` están permitidos. `DROP`/`TRUNCATE` están bloqueados por seguridad
  — si necesitas `db:migrate:undo` en una migración que hace `DROP TABLE`,
  coméntalo temporalmente en `blocked_commands` de `config.php`, ejecútalo,
  y vuelve a bloquearlo. No lo dejes destrabado en producción.
- **Transacciones**: funcionan mientras las queries de una misma transacción
  caigan en el mismo worker de PHP-FPM (lo normal en APIs de tráfico bajo).
  Si ves `"Transaction context lost"`, agrega `{ retry: { max: 3 } }` a
  `sequelize.transaction(...)` en el servicio afectado.
- **Latencia**: cada query agrega ~30-100ms (HTTP) vs ~1-2ms de MySQL
  directo. Aceptable para una API administrativa/de campo como esta.
- **Nunca** commitees `config.php` con credenciales reales si el repo es
  público — considera moverlas a variables de entorno del hosting si el
  panel lo permite, dejando los `CAMBIAR_*` como fallback local únicamente.
