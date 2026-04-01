# Arquitectura del Sistema

## Stack tecnologico

| Capa | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Ant Design 5 |
| Backend | NestJS 10 + TypeScript |
| ORM | Prisma 5 |
| Base de datos | PostgreSQL 16 |
| Autenticacion | JWT (passport-jwt) |
| PDF | PDFKit |
| Excel | SheetJS (xlsx) + ExcelJS |
| Monorepo | pnpm workspaces |

## Estructura del proyecto

```
cable-tracking/
├── apps/
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── schema.prisma          → 13 modelos, 8 enums
│   │   │   └── migrations/            → 9 migraciones
│   │   ├── scripts/                   → seed-admin, seed-plans, migrate-subscriptions
│   │   └── src/
│   │       ├── main.ts                → Bootstrap (CORS, Swagger, ValidationPipe, GlobalExceptionFilter)
│   │       ├── app.module.ts          → Root module + APP_GUARD global
│   │       ├── common/
│   │       │   ├── prisma/            → PrismaModule (global) + executeInTransaction
│   │       │   ├── audit/             → AuditModule (global) + AuditService
│   │       │   ├── filters/           → GlobalExceptionFilter
│   │       │   └── utils/             → normalize-name, parse-periods, promotion-calculator
│   │       └── modules/
│   │           ├── auth/              → JWT login, guards, decorators, DTOs, user CRUD
│   │           ├── users/             → UsersService (inyectado por AuthModule)
│   │           ├── clients/           → ClientsService + ClientsOperationsService + Controller
│   │           ├── documents/         → DocumentsController con Prisma directo
│   │           ├── import/            → ImportService (Excel parsing + batch insert)
│   │           ├── dashboard/         → DashboardService (metricas, corte, tendencia, MRR, riesgo, crecimiento, zonas — cache 1 min)
│   │           ├── export/            → ExportService (ExcelJS)
│   │           ├── plans/             → PlansService CRUD
│   │           ├── promotions/        → PromotionsService CRUD + asignacion
│   │           ├── billing/           → BillingService + PdfGeneratorService
│   │           ├── fiscal/            → FiscalService + MockFiscalProvider
│   │           └── scheduler/         → Cron job recalculo deuda
│   └── frontend/
│       └── src/
│           ├── context/AuthContext.tsx → Token, login, logout, hasRole
│           ├── components/            → ErrorBoundary, CreateClientModal
│           ├── hooks/                 → useClients, useClientDetail, useDebounce
│           ├── pages/                 → 12 paginas
│           ├── services/api.ts        → Axios centralizado con Bearer interceptor
│           └── types/index.ts         → Interfaces compartidas
├── docs/                              → Documentacion del sistema
├── docker-compose.yml                 → PostgreSQL local
└── package.json                       → Workspace root
```

## Modulos del backend — dependencias

```
AppModule
├── PrismaModule (global)
├── AuditModule (global)
├── AuthModule → UsersModule
├── ClientsModule → PromotionsModule, FiscalModule
├── DocumentsModule
├── ImportModule → DashboardModule
├── DashboardModule → ClientsModule
├── ExportModule → ClientsModule
├── PlansModule
├── PromotionsModule
├── BillingModule → ClientsModule
├── FiscalModule
└── SchedulerModule → ClientsModule
```

## Patrones implementados

### Provider Pattern (Fiscal)
`IFiscalProvider` interface con `MockFiscalProvider` actual. Permite cambiar a AFIP real sin tocar el core.

### Guards globales (APP_GUARD)
`JwtAuthGuard` + `RolesGuard` registrados globalmente. `@Public()` excluye endpoints.

### Cache en memoria
Dashboard cachea metricas y lista de corte por 1 minuto. Se invalida al importar.

### Batch inserts
Importacion usa `createMany` en chunks de 500 + `skipDuplicates` para periodos.

### Audit trail
Todas las operaciones manuales se registran en `AuditLog` via `AuditService` (global).

### Debounce
Busqueda de clientes en frontend usa debounce de 400ms.

### Error Boundary
React ErrorBoundary envuelve todas las rutas para atrapar crashes.

## Convenciones de codigo

### Backend
- Modulos: `{name}.module.ts` + `{name}.controller.ts` + `{name}.service.ts`
- Controllers: solo HTTP. Logica en services.
- DTOs con `class-validator` en `dto/` dentro de cada modulo.
- Errores: `BadRequestException`, `NotFoundException`, etc.
- Transacciones: `this.prisma.executeInTransaction(fn, {timeout})`
- Prisma: camelCase en TS, snake_case en DB via `@@map`

### Frontend
- Componentes funcionales con hooks.
- Custom hooks para logica reutilizable.
- API centralizada en `services/api.ts`.
- Tipos en `types/index.ts` sincronizados con backend.
- Ant Design para toda la UI.
