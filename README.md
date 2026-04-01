# 📡 Cable Tracking - Sistema de Seguimiento de Clientes

Sistema empresarial para gestión y seguimiento de clientes de una empresa de cable.
Controla cobertura mensual, deuda y estado de corte.

## Stack

| Componente | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Ant Design 5 |
| Backend | NestJS 10 + Prisma 5 + PostgreSQL 16 |
| Gráficos | Recharts |
| Monorepo | pnpm workspaces |
| Deploy | Vercel (front) + Railway/Render (back) + Supabase (DB) |

## Arquitectura

```
cable-tracking/
├── apps/
│   ├── backend/
│   │   ├── prisma/            # Schema + migraciones
│   │   ├── scripts/           # Seed + validación
│   │   └── src/
│   │       ├── common/        # Prisma, utils, filters
│   │       │   ├── prisma/
│   │       │   ├── utils/     # normalize-name, parse-periods, excel-parser
│   │       │   └── filters/   # Global exception filter
│   │       └── modules/
│   │           ├── clients/
│   │           ├── documents/
│   │           ├── import/
│   │           └── dashboard/
│   └── frontend/
│       └── src/
│           ├── pages/         # Dashboard, Clients, Import, Documents, Corte
│           ├── services/      # API client (axios)
│           └── types/
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## Setup rápido

```bash
# 1. Clonar y entrar
cd cable-tracking

# 2. Levantar PostgreSQL
docker compose up -d

# 3. Configurar .env
cp apps/backend/.env.example apps/backend/.env

# 4. Instalar dependencias
pnpm install

# 5. Generar Prisma client + migrar
cd apps/backend
npx prisma generate
npx prisma migrate dev --name init
cd ../..

# 6. (Opcional) Seed de prueba
pnpm db:seed

# 7. Correr
pnpm dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000/api
- Swagger: http://localhost:3000/api/docs
- Health: http://localhost:3000/api/health

## Flujo de importación

**Orden obligatorio:**
1. **Primero** importar `clientes.xlsx`
2. **Después** importar `pedidos.xlsx` (ramitos)
3. **Después** importar `ventas_.xlsx` (facturas)

Los ramitos/facturas necesitan que los clientes ya existan porque
el match se hace por nombre normalizado.

## Reglas de negocio

### Normalización de nombres
Elimina automáticamente del nombre:
- Texto de baja: "DE BAJA", "DADO DE BAJA"
- Info servicio: "SOLO INTERNET", "CABLE +INTERNET"
- Admin: "pendiente el equipo", "JUBILADA", "NO USAR"
- Corte/retiro: "cortado 21-02-24", "RETIRADA AL DIA"
- Megas: "6megas", "4 megas"
- Fechas, promos, saldos, etc.

### Importación de clientes (NO pisa)
- Si existe por nombre_normalizado → no crea duplicado
- Si indica baja → actualiza estado a BAJA

### Importación de ramitos/facturas (SÍ pisa)
- Elimina TODOS los registros del tipo antes de importar
- Ejecuta dentro de transacción (todo o nada)
- Parsea períodos de la descripción (ej: "6Megas Diciembre25" → 2025-12)

### Cálculo de deuda
- Meses obligatorios = desde `fecha_alta` hasta mes actual
- Mes actual solo cuenta si día > 15
- Deuda = meses obligatorios − meses pagados
- **Corte = más de 2 meses de deuda**

## Validación offline

```bash
cd apps/backend
npx ts-node scripts/validate-data.ts
```

Valida normalización, parser de períodos y cross-match contra los Excel
sin necesitar base de datos.

## API Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/health | Health check |
| GET | /api/dashboard | Métricas generales |
| GET | /api/dashboard/corte | Clientes para corte |
| GET | /api/clients | Lista con filtros + deuda |
| GET | /api/clients/stats | Stats de deuda |
| GET | /api/clients/:id | Detalle con deuda |
| POST | /api/import/preview/:tipo | Preview sin ejecutar |
| POST | /api/import/clientes | Importar clientes |
| POST | /api/import/ramitos | Importar ramitos |
| POST | /api/import/facturas | Importar facturas |
| GET | /api/import/logs | Historial de imports |
| GET | /api/documents | Lista documentos |
| GET | /api/documents/:id | Detalle documento |
| GET | /api/export/corte | 📥 Excel: clientes para corte |
| GET | /api/export/clients | 📥 Excel: todos los clientes + deuda |
| GET | /api/export/resumen | 📥 Excel: resumen general (2 hojas) |

## Deploy a producción

### Frontend → Vercel
```bash
cd apps/frontend
# Build: vite build
# Root: apps/frontend
# Env: VITE_API_URL=https://tu-api.railway.app/api
```

### Backend → Railway/Render
```bash
cd apps/backend
# Build: nest build
# Start: node dist/main
# Env: DATABASE_URL, FRONTEND_URL, PORT
```

### DB → Supabase
Crear proyecto en Supabase, copiar connection string al `DATABASE_URL`.
Ejecutar `npx prisma migrate deploy` contra la DB de producción.
