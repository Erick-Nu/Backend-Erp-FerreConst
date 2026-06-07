# esnt-backend-ferreteria

Backend API para gestion de una ferreteria, construido con Node.js, TypeScript, Express y PostgreSQL.

El proyecto resuelve tres frentes principales:

- API REST autenticada con JWT para el ERP de ferreteria.
- Generacion de proformas PDF y exposicion de archivos por `/uploads`.
- Procesos en segundo plano para envio de proformas por correo y generacion de alertas de stock bajo.

## Que hace el proyecto

La API concentra modulos de negocio para:

- autenticacion y manejo de sesion
- empresas, usuarios, sucursales y cajas
- catalogos base como categorias, marcas, medidas y proveedores
- productos, stock y clientes
- proformas, pago/cancelacion y generacion de PDF
- configuraciones por empresa
- alertas de stock con consulta paginada y notificaciones SSE

Ademas incluye dos agentes asincronos:

- `sendProforma`: envia por correo proformas pendientes con su PDF adjunto
- `stockAlert`: detecta productos con stock bajo y crea/actualiza alertas

## Stack tecnico

- Node.js `>=22.22.1`
- npm `>=10.9.4`
- TypeScript
- Express 5
- PostgreSQL
- `postgres` como cliente SQL
- JWT para autenticacion
- `multer` para carga de imagenes
- `pdfkit` + `pdfkit-table` para PDFs
- `nodemailer` para correo
- `pino` + `morgan` para logging

## Arquitectura

La API sigue una estructura modular por capas. En la mayoria de modulos se repite este patron:

- `dto`: contratos de entrada/salida
- `model`: tipos del dominio o filas consultadas
- `dao`: acceso a base de datos
- `service`: reglas de negocio
- `controller`: adaptacion HTTP
- `route`: definicion de endpoints

El flujo tipico de una peticion es:

`route -> controller -> service -> dao -> PostgreSQL`

## Estructura del proyecto

```text
src/
  agents/
    sendProforma/
    stockAlert/
  config/
  middlewares/
  modules/
    alert/
    auth/
    branch/
    brand/
    category/
    checkout/
    client/
    company/
    config/
    medida/
    playmentMethod/
    product/
    proforma/
    proveedor/
    sequence/
    stock/
    user/
  services/
  types/
  utils/
    pdf/
  app.ts
  server.ts
documentacion/
ecosystem.config.cjs
```

## Componentes clave

### API HTTP

- Punto de entrada: `src/server.ts`
- Configuracion de Express y rutas: `src/app.ts`
- Ruta base publica: `GET /`
- Archivos estaticos: `/uploads`

### Base de datos

- Conexion centralizada en `src/config/database.ts`
- Se usa `DATABASE_URL` como unica cadena de conexion
- El repo no incluye migraciones ni schema versionado; la estructura de la BD debe existir previamente

### Autenticacion

- Login: `POST /auth/login`
- Refresh: `POST /auth/refresh`
- Logout: `POST /auth/logout`
- El middleware `authenticate` valida el bearer token y adjunta `usid`, `usemid` y `usrol` al request

### Proformas y PDFs

- Las proformas se generan y consultan bajo `/proformas`
- El PDF se construye con `pdfkit` y se guarda en `uploads/proformas/<ruc>/`
- La plantilla PDF vive en `src/utils/pdf/`

### Alertas

- Consulta paginada: `GET /alerts`
- Streaming SSE: `GET /alerts/events`
- Marcado como visto: `PATCH /alerts/:id/visto`

### Agentes

- `sendProforma` consulta proformas pendientes, arma el correo HTML y adjunta el PDF
- `stockAlert` revisa stock bajo y alimenta la tabla de alertas

## Requisitos previos

Antes de levantar el proyecto debes tener:

- Node.js compatible con la version definida en `package.json`
- npm instalado
- PostgreSQL disponible
- variables de entorno configuradas
- estructura de base de datos ya creada

Para `sendProforma` tambien necesitas:

- acceso SMTP funcional
- plantilla HTML en `uploads/templates/send-proforma-email.html`
- configuracion en base de datos para las empresas que enviaran correos

## Instalacion

```bash
npm install
cp .env.example .env
```

Luego ajusta `.env` con los valores reales del entorno.

## Variables de entorno

El proyecto carga variables con `dotenv` desde `.env`.

Referencia base:

```bash
cp .env.example .env
```

Valores de ejemplo actuales:

```env
LOG_LEVEL=info
PORT=3000
CORS_ORIGIN=*
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/esnt_ferreteria
PUBLIC_BASE_URL=http://localhost:3000
JWT_SECRET=change-this-secret-with-at-least-32-characters
ACCESS_TOKEN_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN_HOURS=168
BCRYPT_SALT_ROUNDS=10
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
```

### Requeridas para la API

| Variable | Descripcion |
| --- | --- |
| `LOG_LEVEL` | Nivel de logs para `pino` como `info`, `warn`, `error` o `debug`. |
| `PORT` | Puerto HTTP de la API. Debe ser entero. |
| `CORS_ORIGIN` | Origen permitido por CORS. Puede ser `*` en desarrollo. |
| `DATABASE_URL` | Cadena de conexion PostgreSQL completa. |
| `PUBLIC_BASE_URL` | URL publica base usada para construir rutas de archivos expuestos por `/uploads`. |
| `JWT_SECRET` | Secreto para firmar tokens. Debe ser fuerte y privado. |
| `ACCESS_TOKEN_EXPIRES_IN` | Duracion del access token en formato compatible con la libreria JWT, por ejemplo `1h`. |
| `REFRESH_TOKEN_EXPIRES_IN_HOURS` | Duracion del refresh token en horas. Debe ser entero. |
| `BCRYPT_SALT_ROUNDS` | Rondas para hashing de password. Debe ser entero. |

### Requeridas si usas `sendProforma`

| Variable | Descripcion |
| --- | --- |
| `SMTP_HOST` | Host SMTP, por ejemplo `smtp.gmail.com`. |
| `SMTP_PORT` | Puerto SMTP. Debe ser entero. |
| `SMTP_SECURE` | Booleano. Acepta `true`, `false`, `1` o `0`. |

### Opcionales

| Variable | Descripcion |
| --- | --- |
| `GMAIL_API_KEY` | Variable admitida por `src/config/env.ts`, pero actualmente no participa en la logica activa del proyecto. |

Notas importantes:

- Las variables obligatorias de la API se validan al arrancar el proceso y si faltan, el proyecto falla en startup.
- `SMTP_HOST`, `SMTP_PORT` y `SMTP_SECURE` son opcionales para la API general, pero necesarias para usar el agente `sendProforma`.
- Las credenciales del correo del agente no salen de `.env`: se obtienen por empresa desde la tabla `configuracion`.
- Para `sendProforma`, la empresa debe tener configuradas las claves `sendproforma.email.user` y `sendproforma.email.password`.
- `src/config/env.ts` recorta espacios en blanco y valida tipos numericos y booleanos.

## Scripts disponibles

```bash
npm run dev
npm run build
npm start
npm run typecheck
npm run lint
npm run format
npm run format:check
```

## Como levantar el proyecto

### Desarrollo

API:

```bash
npm run dev
```

Agente `sendProforma`:

```bash
node --import tsx src/agents/sendProforma/task/sendProformaTask.ts
```

Agente `stockAlert`:

```bash
node --import tsx src/agents/stockAlert/task/stockAlertTask.ts
```

### Produccion

Compila primero:

```bash
npm run build
```

Luego puedes arrancar la API compilada:

```bash
npm start
```

El archivo `ecosystem.config.cjs` existe para PM2, pero actualmente contiene rutas absolutas de despliegue especificas del entorno original. Si vas a reutilizarlo en otra maquina, revisa y ajusta `cwd` y scripts antes de usarlo.

## Modulos y rutas base

Las rutas estan registradas en `src/app.ts`.

| Modulo | Ruta base |
| --- | --- |
| system | `/` |
| auth | `/auth` |
| companies | `/companies` |
| users | `/users` |
| branches | `/branches` |
| checkouts | `/checkouts` |
| categories | `/categories` |
| brands | `/brands` |
| proveedores | `/proveedores` |
| medidas | `/medidas` |
| products | `/products` |
| stocks | `/stocks` |
| clients | `/clients` |
| playment-methods | `/playment-methods` |
| proformas | `/proformas` |
| configs | `/configs` |
| alerts | `/alerts` |

## Convenciones de la API

### Autenticacion

Excepto `GET /` y los endpoints de autenticacion, la API espera:

```http
Authorization: Bearer <token>
```

### Paginacion

Los listados paginados devuelven:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalItems": 0,
  "totalPages": 0
}
```

### Carga de imagenes

El middleware de imagen usa:

- `multipart/form-data`
- campo `imagen`
- extensiones permitidas: `.png`, `.jpg`
- tamano maximo: `5MB`

Las imagenes se guardan bajo `uploads/` y luego se publican como URL usando `PUBLIC_BASE_URL`.

### Rate limiting

La API aplica limites por IP:

- `/auth`: `10` requests por minuto
- metodos de escritura (`POST`, `PUT`, `PATCH`, `DELETE`): `60` requests por minuto
- lecturas `GET`: `120` requests por minuto

### Seguridad y middleware

- `helmet` para headers de seguridad
- `cors` configurable por entorno
- `morgan` conectado a `pino`
- middleware global de errores y `notFound`

## Archivos generados y almacenamiento local

El proyecto usa `uploads/` como almacenamiento local para:

- imagenes de empresas
- imagenes de usuarios
- imagenes de productos
- PDFs de proformas
- plantilla HTML de correo para envio de proformas

Rutas importantes:

- `uploads/proformas/`
- `uploads/templates/send-proforma-email.html`

`uploads/` se expone publicamente desde Express y esta ignorado por git.

## Agentes en detalle

### `sendProforma`

Responsabilidad:

- encontrar proformas pendientes por empresa
- marcar estado de procesamiento
- renderizar el HTML del correo
- adjuntar el PDF de la proforma
- enviar el correo y actualizar el estado final

Dependencias operativas:

- `SMTP_*` en `.env`
- `uploads/templates/send-proforma-email.html`
- configuracion global en tabla `configuracion` con clave `sendproforma.email.empresa`
- configuracion por empresa con claves:
  - `sendproforma.email.user`
  - `sendproforma.email.password`

Comportamiento:

- separa empresas por RUC usando `;`
- procesa lotes por empresa
- corre una iteracion inicial y luego vuelve a ejecutar cada 4 minutos

### `stockAlert`

Responsabilidad:

- leer empresas configuradas
- detectar productos con cantidad menor o igual al stock minimo
- crear o actualizar alertas visibles

Dependencias operativas:

- configuracion global en tabla `configuracion` con clave `stockalert.empresa`

Comportamiento:

- separa empresas por RUC usando `;`
- corre una iteracion inicial y luego vuelve a ejecutar cada 5 minutos

## Calidad y desarrollo

TypeScript esta configurado en modo estricto con:

- `strict`
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`

La salida compilada va a `dist/`.

## Resumen rapido para una persona nueva

Si entras por primera vez al proyecto, este es el camino mas corto para entenderlo:

1. Revisa `src/app.ts` para ver todas las rutas montadas.
2. Entra a `src/modules/<modulo>/` para seguir el flujo `route -> controller -> service -> dao`.
3. Si trabajas con proformas, revisa tambien `src/utils/pdf/` y `uploads/templates/`.
4. Si trabajas con automatizaciones, entra a `src/agents/`.
