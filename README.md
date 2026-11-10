# CafeBackend-

API REST del sistema CaféIA. Gestiona autenticación, fincas, lotes, variables de producción, catas SCA, predicciones, recomendaciones comerciales y estado del servicio de IA.

## Stack

- Node.js + Express
- Prisma ORM
- SQLite por defecto, PostgreSQL opcional
- JWT + bcryptjs
- express-validator

## Inicio

```powershell
npm install
Copy-Item .env.example .env
npx prisma db push
npm run db:seed
npm run dev
```

API: <http://localhost:3000>
Health: <http://localhost:3000/health>

Credenciales demo:

- `admin@cafeia.com / Admin1234`
- `productor@cafeia.com / Productor1234`

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor con nodemon |
| `npm start` | Servidor de producción |
| `npm run db:push` | Sincroniza el schema con la base |
| `npm run db:generate` | Genera Prisma Client |
| `npm run db:studio` | Explorador visual |
| `npm run db:seed` | Datos demo |
| `npm test` | Pruebas con `node --test` |

## Variables de entorno

Ver `.env.example`. Las clave:

| Variable | Descripción |
| --- | --- |
| `JWT_SECRET` | Firma de tokens |
| `FRONTEND_URL` | Origen permitido por CORS |
| `AI_SERVICE_URL` | URL del servicio FastAPI |
| `AI_TIMEOUT_MS` | Timeout de IA |
| `AI_FALLBACK_ENABLED` | Usa reglas si la IA falla |

## Base de datos

SQLite por defecto (`prisma/dev.db`). Para PostgreSQL cambia `provider` y `url` en `prisma/schema.prisma`, define `DATABASE_URL` y ejecuta:

```powershell
npx prisma generate
npx prisma db push
```

`db push` crea las tablas automáticamente. Detalle en [`../docs/DATABASE.md`](../docs/DATABASE.md).

## Servicios principales

- `src/services/ai.service.js`: cliente HTTP del servicio de IA.
- `src/services/prediction.service.js`: payload, normalización y fallback determinista.
- `src/services/recommendation.service.js`: motor de mercados y recomendaciones.
- `src/services/quality.service.js`: clasificación por puntaje.

## Pruebas

```powershell
npm test
```

Cubre el motor comercial y el fallback determinista.

## Documentación

- [`../docs/API.md`](../docs/API.md)
- [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
- [`../docs/DATABASE.md`](../docs/DATABASE.md)
- [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)
