# esnt-backend-ferreteria

Backend API para gestion de ferreteria construido con Node.js, TypeScript y Express.

## Estado actual del backend

- API REST modular por capas: `model`, `dto`, `dao`, `service`, `controller`, `route`.
- Autenticacion con JWT.
- Persistencia en PostgreSQL usando `postgres`.
- Carga de imagenes con `multer`.
- Logging con `pino` + `morgan`.
- Recursos estaticos expuestos en `/uploads`.

## Stack tecnico

- Node.js `>=22.22.1`
- npm `>=10.9.4`
- TypeScript
- Express 5
- PostgreSQL

## Instalacion

```bash
npm install
cp .env.example .env
```

## Variables de entorno

Variables requeridas:

- `LOG_LEVEL`
- `PORT`
- `CORS_ORIGIN`
- `DATABASE_URL`
- `PUBLIC_BASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `BCRYPT_SALT_ROUNDS`

## Scripts

```bash
npm run dev
npm run build
npm start
npm run typecheck
npm run lint
npm run format
npm run format:check
```

## Autenticacion y seguridad

- Endpoint publico base: `GET /`
- Login: `POST /auth/login`
- Logout: `POST /auth/logout`
- El resto de endpoints de negocio usan:

```http
Authorization: Bearer <token>
```

- El token incluye datos del usuario autenticado (id, empresa, rol).
- Se validan estados de usuario/empresa segun las reglas de cada modulo.

## Convenciones generales de la API

### Paginacion

Los listados usan query params obligatorios:

- `page` (entero positivo)
- `pageSize` (entero positivo)

Formato de respuesta paginada:

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

Endpoints que soportan imagen permiten:

- `Content-Type: multipart/form-data`
- Campo de archivo: `imagen`
- Formatos: `.png`, `.jpg`
- Tamano maximo: `5MB`

Si no se envia imagen en endpoints que lo soportan, se usa imagen por defecto.

### Estados de entidades

En varios recursos se maneja estado:

- `activo`
- `inactivo`
- `eliminado`

### Errores comunes

- `401 Unauthorized`: token ausente o invalido.
- `400 Bad Request`: validaciones de entrada (params, body o reglas de negocio).
- `404 Not Found`: recurso no encontrado.

## Resumen de endpoints actuales

### Auth

- `POST /auth/login` inicia sesion con `emruc`, `usapodo`, `uspassword`.
- `POST /auth/logout` cierra sesion (respuesta informativa).

### Companies

- `POST /companies`
- `GET /companies`
- `GET /companies/:id`
- `PATCH /companies/:id`
- `PATCH /companies/:id/status`

Notas:
- Soporta imagen de empresa en registro/actualizacion.
- `PATCH /companies/:id/status` actualiza solo `emestado`.

### Users

- `POST /users`
- `GET /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `PATCH /users/:id/status`

Notas:
- Soporta imagen de perfil en registro/actualizacion.
- `PATCH /users/:id/status` actualiza solo `usestado`.

### Branches

- `POST /branches`
- `GET /branches`
- `GET /branches/:id`
- `PATCH /branches/:id`

### Checkouts

- `POST /checkouts`
- `GET /checkouts`
- `GET /checkouts/:id`
- `PATCH /checkouts/:id/status`

Nota:
- `GET /checkouts/:id` requiere query param `cjsuid`.

### Categories

- `POST /categories`
- `GET /categories`
- `GET /categories/:id`
- `PATCH /categories/:id`

### Brands

- `POST /brands`
- `GET /brands`
- `GET /brands/:id`
- `PATCH /brands/:id`

### Proveedores

- `POST /proveedores`
- `GET /proveedores`
- `GET /proveedores/:id`
- `PATCH /proveedores/:id`

### Medidas

- `POST /medidas`
- `GET /medidas`
- `GET /medidas/:id`
- `PATCH /medidas/:id`

### Playment Methods

- `POST /playment-methods`
- `GET /playment-methods`
- `GET /playment-methods/:id`
- `PATCH /playment-methods/:id`

### Products

- `POST /products`
- `GET /products`
- `GET /products/:id`
- `PATCH /products/:id`

Notas:
- Soporta imagen en registro/actualizacion.
- En las respuestas se incluyen relaciones de categoria, marca, proveedor y medida.

### Stocks

- `POST /stocks`
- `GET /stocks`
- `GET /stocks/all`
- `GET /stocks/:id`
- `PATCH /stocks/:id`

Notas:
- `GET /stocks` y `GET /stocks/all` usan filtros por empresa/sucursal y paginacion.
- `PATCH /stocks/:id` exige `stcksuid` y actualiza cantidad/estado.

### Clients

- `POST /clients`
- `GET /clients`
- `GET /clients/:id`
- `PATCH /clients/:id`

Notas:
- Maneja identificacion por tipo (`cedula` o `ruc`) con validaciones.
- Evita duplicados de identificacion/correo dentro de la empresa.

### Proformas

- `POST /proformas`
- `GET /proformas`
- `GET /proformas/:id`
- `PUT /proformas/:id`
- `PATCH /proformas/:id/pay`
- `PATCH /proformas/:id/cancel`

Notas:
- `POST` y `PUT` validan consistencia de subtotal/descuento/total y detalle.
- `PUT /proformas/:id` reemplaza cabecera + detalle de forma atomica.
- La respuesta de proforma incluye documento completo (emisor, receptor, detalle, totales, estado y metadata).

## Estructura principal del proyecto

```text
src/
  config/
  middlewares/
  modules/
    auth/
    company/
    user/
    branch/
    checkout/
    category/
    brand/
    proveedor/
    medida/
    playmentMethod/
    product/
    stock/
    client/
    proforma/
    sequence/
  types/
  utils/
  app.ts
  server.ts
```

## Notas operativas

- `uploads/` es un recurso local y esta ignorado por git.
