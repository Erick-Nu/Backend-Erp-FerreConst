# esnt-backend-ferreteria

Backend API para gestion de ferreteria construido con Node.js, TypeScript y Express.

## Estado actual del backend

- API REST modular por capas: `model`, `dto`, `dao`, `service`, `controller`, `route`.
- Autenticacion con JWT.
- Manejo de carga de imagenes con `multer`.
- Persistencia en PostgreSQL usando `postgres`.
- Logging con `pino` y salida de request HTTP via `morgan`.
- Endpoints de negocio para empresas, usuarios, clientes, productos, stock, proformas y catalogos.

## Stack tecnico

- Node.js `>=22.22.1`
- npm `>=10.9.4`
- TypeScript
- Express 5
- PostgreSQL

## Requisitos

- Node.js `v22.22.1` o superior
- npm `10.9.4` o superior

## Instalacion

```bash
npm install
cp .env.example .env
```

## Variables de entorno

Variables requeridas (ver [.env.example](.env.example)):

- `LOG_LEVEL`: nivel de logs (`info`, `debug`, `error`, etc.).
- `PORT`: puerto HTTP del servidor.
- `CORS_ORIGIN`: origen permitido para CORS.
- `DATABASE_URL`: cadena de conexion a PostgreSQL.
- `PUBLIC_BASE_URL`: URL base publica para construir URLs de imagenes.
- `JWT_SECRET`: secreto para firmar tokens JWT.
- `JWT_EXPIRES_IN`: tiempo de expiracion del token.
- `BCRYPT_SALT_ROUNDS`: rondas de hash para bcrypt.

## Ejecucion y scripts

```bash
npm run dev
npm run build
npm start
npm run typecheck
npm run lint
npm run format
npm run format:check
```

## Rutas base

- `GET /` estado basico del servicio.
- `POST /auth/login` inicio de sesion.
- `POST /auth/logout` cierre de sesion.
- `GET /uploads/*` acceso a recursos estaticos cargados.

## Autenticacion

- Salvo login/logout y la ruta raiz, los endpoints usan `Authorization: Bearer <token>`.
- El middleware valida token JWT y adjunta el usuario autenticado al request.

## Modulos expuestos por la API

- `auth`
- `companies`
- `users`
- `branches`
- `checkouts`
- `categories`
- `brands`
- `proveedores`
- `medidas`
- `products`
- `stocks`
- `clients`
- `playment-methods`
- `proformas`

## Documentacion de endpoints (segun docs)

### Empresas

- [POST /companies](docs/register-company-endpoint.md)
- [GET /companies](docs/get-companies-endpoint.md)
- [GET /companies/:id](docs/get-company-by-id-endpoint.md)
- [PATCH /companies/:id](docs/update-company-endpoint.md)
- [PATCH /companies/:id/status](docs/update-company-status-endpoint.md)

### Usuarios

- [POST /users](docs/register-user-endpoint.md)
- [GET /users](docs/get-users-endpoint.md)
- [GET /users/:id](docs/get-user-by-id-endpoint.md)
- [PATCH /users/:id](docs/update-user-endpoint.md)
- [PATCH /users/:id/status](docs/update-user-status-endpoint.md)

### Sucursales

- [POST /branches](docs/register-branch-endpoint.md)
- [GET /branches](docs/get-branches-endpoint.md)
- [GET /branches/:id](docs/get-branch-by-id-endpoint.md)
- [PATCH /branches/:id](docs/update-branch-endpoint.md)

### Categorias

- [POST /categories](docs/register-category-endpoint.md)
- [GET /categories](docs/get-categories-endpoint.md)
- [GET /categories/:id](docs/get-category-by-id-endpoint.md)
- [PATCH /categories/:id](docs/update-category-endpoint.md)

### Marcas

- [POST /brands](docs/register-brand-endpoint.md)
- [GET /brands](docs/get-brands-endpoint.md)
- [GET /brands/:id](docs/get-brand-by-id-endpoint.md)
- [PATCH /brands/:id](docs/update-brand-endpoint.md)

### Checkouts

- [POST /checkouts](docs/register-checkout-endpoint.md)
- [GET /checkouts](docs/get-checkouts-endpoint.md)
- [GET /checkouts/:id](docs/get-checkout-by-id-endpoint.md)
- [PATCH /checkouts/:id/status](docs/update-checkout-endpoint.md)

### Clientes

- [POST /clients](docs/register-client-endpoint.md)
- [GET /clients](docs/get-clients-endpoint.md)
- [GET /clients/:id](docs/get-client-by-id-endpoint.md)
- [PATCH /clients/:id](docs/update-client-endpoint.md)

### Medidas

- [POST /medidas](docs/register-medida-endpoint.md)
- [GET /medidas](docs/get-medidas-endpoint.md)
- [GET /medidas/:id](docs/get-medida-by-id-endpoint.md)
- [PATCH /medidas/:id](docs/update-medida-endpoint.md)

### Metodos de pago

- [POST /playment-methods](docs/register-playment-method-endpoint.md)
- [GET /playment-methods](docs/get-playment-methods-endpoint.md)
- [GET /playment-methods/:id](docs/get-playment-method-by-id-endpoint.md)
- [PATCH /playment-methods/:id](docs/update-playment-method-endpoint.md)

### Productos

- [POST /products](docs/register-product-endpoint.md)
- [GET /products](docs/get-products-endpoint.md)
- [GET /products/:id](docs/get-product-by-id-endpoint.md)
- [PATCH /products/:id](docs/update-product-endpoint.md)

### Proveedores

- [POST /proveedores](docs/register-proveedor-endpoint.md)
- [GET /proveedores](docs/get-proveedores-endpoint.md)
- [GET /proveedores/:id](docs/get-proveedor-by-id-endpoint.md)
- [PATCH /proveedores/:id](docs/update-proveedor-endpoint.md)

### Stocks

- [POST /stocks](docs/register-stock-endpoint.md)
- [GET /stocks](docs/get-stocks-endpoint.md)
- [GET /stocks/all](docs/get-stocks-by-company-endpoint.md)
- [GET /stocks/:id](docs/get-stock-by-id-endpoint.md)
- [PATCH /stocks/:id](docs/update-stock-endpoint.md)

### Proformas

- [POST /proformas](docs/register-proforma-endpoint.md)
- [GET /proformas](docs/get-proformas-endpoint.md)
- [GET /proformas/:id](docs/get-proforma-by-id-endpoint.md)
- [PUT /proformas/:id](docs/replace-proforma-endpoint.md)
- [Estructura de respuesta de proforma](docs/proforma-response-structure.md)

## Notas

- La carpeta `uploads/` se sirve publicamente en `/uploads`.
- La ruta antigua de healthcheck (`/api/health`) ya no forma parte de la API actual.
