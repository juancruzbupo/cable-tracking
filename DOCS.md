# Cable Tracking — Documentación

Este archivo es un índice. La documentación completa está en `docs/`.

## Documentación técnica

| Documento | Contenido |
|---|---|
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Stack, estructura de carpetas, módulos, patrones |
| [docs/MODELO-DATOS.md](docs/MODELO-DATOS.md) | 13 tablas, 10 enums, diagrama de relaciones |
| [docs/REGLAS-NEGOCIO.md](docs/REGLAS-NEGOCIO.md) | Cálculo de deuda, importación, promociones, facturación |
| [docs/API.md](docs/API.md) | 60+ endpoints con métodos, roles y parámetros |
| [docs/ROLES-PERMISOS.md](docs/ROLES-PERMISOS.md) | Matriz de permisos por rol (ADMIN/OPERADOR/VISOR) |
| [docs/FUNCIONALIDADES.md](docs/FUNCIONALIDADES.md) | Features completas por fase (6 fases) |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Setup local y deploy a producción |
| [docs/FISCAL_PROVIDER.md](docs/FISCAL_PROVIDER.md) | Guía para conectar proveedor AFIP real |

## Setup rápido

```bash
docker compose up -d          # PostgreSQL
pnpm install                  # Dependencias
cd apps/backend
npx prisma migrate deploy     # Migraciones
npx prisma generate           # Client Prisma
npx ts-node scripts/seed-admin.ts   # Usuario admin
cd ../..
pnpm dev                      # Levantar todo
```

Credenciales: `admin@cable.local` / `Admin1234!`
Frontend: http://localhost:5174
Swagger: http://localhost:3000/api/docs

## Tests

```bash
cd apps/backend && pnpm test   # 38 tests unitarios
```
