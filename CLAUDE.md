# Cable Tracking - Contexto para AI

## Que es esto

Sistema web completo para gestionar clientes de una empresa de cable e internet. Controla suscripciones (CABLE/INTERNET por separado), deuda mensual por servicio, corte de servicio, facturacion fiscal, promociones y reportes de cobranza. Tiene autenticacion JWT con 3 roles (ADMIN, OPERADOR, VISOR).

## Arquitectura

Monorepo pnpm con 2 apps:

```
apps/backend/   → NestJS 10 + Prisma 5 + PostgreSQL 16
apps/frontend/  → React 18 + TypeScript + Vite + Ant Design 5
```

Comunicacion: REST API con JWT Bearer auth. En dev, Vite proxea `/api` a `localhost:3000`. Prefix global de backend: `/api`.

## Modelo de datos (16 tablas)

```
User (id, email, password, name, role[ADMIN|OPERADOR|VISOR], isActive)

Client (id, codCli[UNIQUE], nombreOriginal, nombreNormalizado, fechaAlta, estado, calle, datos fiscales, tipoComprobante[TipoEmision])
  ├─ Subscription (id, clientId, tipo[CABLE|INTERNET], fechaAlta, estado, planId?, deudaCalculada, requiereCorte)
  │    ├─ Document (id, clientId, codCli, subscriptionId?, tipo[RAMITO|FACTURA], fechaDocumento, descripcionOriginal)
  │    │    └─ PaymentPeriod (id, clientId, codCli, documentId, subscriptionId?, periodo, year, month)
  │    ├─ ClientPromotion (id, promotionId, subscriptionId, assignedBy)
  │    └─ Comprobante (id, clientId, subscriptionId?, tipo, numero, montos, estado, cae?)
  ├─ ClientNote (id, clientId, userId, content)
  ├─ EquipmentAssignment (id, equipmentId, clientId, fechaInstalacion, fechaRetiro?)
  ├─ Ticket (id, clientId, tipo, descripcion?, estado, notas, creadoPor, resuelto?)
  └─ AuditLog (id, userId, action, entityType, entityId, metadata)

Equipment (id, tipo, marca?, modelo?, numeroSerie[UNIQUE], estado[EN_DEPOSITO|ASIGNADO|EN_REPARACION|DE_BAJA])

ServicePlan (id, nombre, tipo[CABLE|INTERNET], precio, activo)
  └─ Promotion (id, nombre, tipo, valor, scope[PLAN|CLIENTE], fechaInicio, fechaFin, planId?)

EmpresaConfig (id, cuit, razonSocial, condicionFiscal, providerName[mock|tusFacturas], umbralCorte)
ImportLog (id, tipo, fileName, totalRows, validRows, invalidRows, errors, status)
```

Clave de match entre archivos Excel: `codCli` (UNIQUE en Client).
Cascading deletes: Client → Subscription → Document → PaymentPeriod.

## Autenticacion y roles

JWT con 8 horas de expiracion. Guards globales via `APP_GUARD` (JwtAuthGuard + RolesGuard).
Decorator `@Public()` para excluir endpoints (health, login).
Decorator `@Roles('ADMIN', 'OPERADOR')` para restringir por rol.

| Rol | Acceso |
|---|---|
| ADMIN | Todo: usuarios, imports, config fiscal, planes, promos, comprobantes |
| OPERADOR | Clientes, pagos, notas, promos asignar, comprobantes generar, reportes |
| VISOR | Solo lectura: dashboard, clientes, documentos |

Credenciales iniciales: `admin@cable.local` / `Admin1234!`

## Modulos del backend (15)

```
src/
├── main.ts              → Bootstrap: CORS, Swagger+Bearer, ValidationPipe, GlobalExceptionFilter
├── app.module.ts        → Root module con APP_GUARD global (JWT + Roles)
├── common/
│   ├── prisma/          → PrismaClient + executeInTransaction
│   ├── audit/           → AuditModule (global) — registra acciones en AuditLog
│   └── utils/           → normalizeName, parsePeriodsFromDescription, detectServiceType, calcularPrecioConPromo, esMesCubiertoXPromo
└── modules/
    ├── auth/            → Login JWT, @Public, @Roles, JwtAuthGuard, RolesGuard, CRUD usuarios
    ├── users/           → UsersService (findByEmail, create, updateRole, changePassword)
    ├── clients/         → CRUD clientes + DebtService + operaciones manuales (alta, baja, pagos, notas, historial, fiscal)
    ├── import/          → Import Excel (clientes/ramitos/facturas) con batch inserts, preserva pagos manuales
    ├── documents/       → GET /documents con filtros y paginacion
    ├── dashboard/       → Metricas, corte, tendencia 12m, MRR, riesgo, crecimiento, zonas (cache 1 min)
    ├── export/          → Descargas Excel (corte, clientes, resumen)
    ├── plans/           → CRUD planes de servicio (nombre, tipo, precio)
    ├── promotions/      → CRUD promos (PORCENTAJE/MONTO_FIJO/PRECIO_FIJO/MESES_GRATIS) + asignacion
    ├── billing/         → Factura PDF individual/masiva, reporte cobranza, lista corte PDF
    ├── fiscal/          → Config empresa, comprobantes, MockFiscalProvider + TusFacturasProvider
    ├── equipment/       → Inventario de equipos, asignacion/retiro a clientes
    ├── tickets/         → Tickets de soporte tecnico, resolucion, estadisticas
    └── scheduler/       → Cron 5AM ARG recalcula deuda de todas las suscripciones activas (con promos)
```

## Paginas del frontend (14)

```
src/
├── App.tsx              → AuthProvider + ProtectedRoute + Layout con menu role-based
├── context/AuthContext   → Token localStorage, auto-logout en 401, hasRole()
├── shared/              → ErrorBoundary, utils (WhatsApp)
├── hooks/               → useClients, useClientDetail, useDebounce
├── features/
│   ├── auth/LoginPage        → Login con email/password
│   ├── dashboard/DashboardPage → Metricas, MRR, tendencia, riesgo, crecimiento, zonas
│   ├── clients/ClientsPage   → Tabla + filtros + Drawer detalle (deuda, pagos, notas, historial, promos, fiscal, equipos, tickets)
│   ├── import/ImportPage     → Upload Excel por tipo (preview → confirmar) + historial
│   ├── documents/DocumentsPage → Tabla paginada de ramitos/facturas
│   ├── corte/CortePage       → Clientes para corte con desglose cable/internet + export Excel/PDF + WhatsApp
│   ├── reports/ReportesPage  → Reporte cobranza mensual + facturas masivas
│   ├── plans/PlansPage       → CRUD planes (solo ADMIN)
│   ├── promotions/PromotionsPage → CRUD promos con tabs (vigentes/vencidas) + asignacion
│   ├── users/UsersPage       → Gestion usuarios (solo ADMIN)
│   ├── fiscal/ComprobantesPage → Tabla comprobantes + emision masiva + PDF
│   ├── fiscal/FiscalConfigPage → Config empresa + proveedor fiscal (solo ADMIN)
│   ├── equipment/EquipmentPage → Inventario de equipos + asignacion
│   └── tickets/TicketsPage   → Tickets de soporte + estadisticas
├── services/api.ts      → Axios con Bearer interceptor + getErrorMessage helper
└── types/index.ts       → Re-export de @cable-tracking/shared-types
```

## Regla central de deuda

Se calcula POR SUSCRIPCION (no por cliente) en `calculateSubDebt()`:

1. Solo aplica si suscripcion ACTIVA
2. Meses cubiertos = pagados + meses con promo MESES_GRATIS (sin duplicar)
3. Deuda desde ultimo mes cubierto + 1 hasta mes actual
4. Mes actual solo cuenta si dia > 15
5. requiereCorte = cantidadDeuda > 1 (2+ meses)
6. El cron nocturno cachea `deudaCalculada` y `requiereCorte` en la suscripcion

El cliente tiene campos resumen: `cantidadDeuda` (peor caso), `requiereCorteCable`, `requiereCorteInternet`, `deudaCable`, `deudaInternet`.

## Flujo de importacion

**Orden**: clientes → ramitos → facturas.
**Clientes**: match por `codCli`, no pisa existentes.
**Ramitos/Facturas**: DELETE ALL del tipo (excepto `MANUAL-*`), batch insert con `createMany`, detecta tipo servicio (CABLE/INTERNET) y vincula a Subscription.

## Facturacion fiscal

Provider pattern: `IFiscalProvider` interface → `MockFiscalProvider` (actual) genera RECIBO_X internos.
Cuando se conecte AFIP, solo se implementa nuevo adaptador sin tocar el core.
Config en tabla `EmpresaConfig` (CUIT, razon social, punto venta, providerName).
Comprobantes con campos AFIP-ready (CAE, tipo A/B/C, IVA, detalle JSON).

## Comandos utiles

```bash
pnpm dev                              # Levantar backend + frontend
docker compose up -d                  # PostgreSQL local
cd apps/backend
npx prisma migrate deploy             # Aplicar migraciones
npx prisma generate                   # Regenerar client
npx ts-node scripts/seed-admin.ts     # Crear usuario admin
npx ts-node scripts/seed-plans.ts     # Crear planes base
npx ts-node scripts/migrate-subscriptions.ts  # Migrar datos a suscripciones (una vez)
```

## Puertos

| Servicio | Puerto |
|---|---|
| Frontend (Vite) | 5174 |
| Backend (NestJS) | 3000 |
| PostgreSQL | 5432 |
| Swagger docs | 3000/api/docs |

## Variables de entorno

```
DATABASE_URL=postgresql://cable_user:cable_pass@localhost:5432/cable_tracking
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5174
JWT_SECRET=cable-tracking-secret-dev-change-in-production
```

## Documentacion

Ver `docs/` para documentacion detallada:
- `MODELO-DATOS.md` — Diagrama y detalle de las 16 tablas
- `REGLAS-NEGOCIO.md` — Deuda, importacion, promos, facturacion
- `API.md` — Referencia completa de endpoints
- `DEPLOY.md` — Setup local y produccion
- `ROLES-PERMISOS.md` — Matriz de permisos por rol
- `FUNCIONALIDADES.md` — Features completas del sistema
- `ARQUITECTURA.md` — Modulos, dependencias y patrones
- `FISCAL_PROVIDER.md` — Guia para implementar proveedor fiscal real
- `BACKLOG-ESCALABILIDAD.md` — Roadmap de escalabilidad (3K/5K/10K/50K clientes)
- `MANUAL-USUARIO.md` — Manual completo para el usuario final
