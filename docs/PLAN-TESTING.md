# Plan de Testing — cable-tracking

## Estado actual

- **49 tests** en 5 suites (todos pasando)
- **8.3% cobertura** total
- Solo funciones puras testeadas (utils + debt calculation + fiscal logic)

## Objetivo

Llevar la cobertura de lógica de negocio crítica al 70%+, priorizando los módulos que manejan datos sensibles (deuda, pagos, importación, facturación).

---

## Fase 1 — Prioridad ALTA (lógica crítica)

### 1.1 scheduler.service.spec.ts
**Qué testear (sin DB, mockear Prisma):**

- `recalcularDeudas()` carga umbralCorte de config
- Cursor-based pagination: procesa en batches de 500
- Calcula deuda con promos MESES_GRATIS (no array vacío)
- Actualiza deudaCalculada + requiereCorte + ultimoCalculo
- `deactivateStaleSubscriptions()` da de baja subs con 12+ meses sin pago
- No da de baja subs de clientes BAJA
- Registra SUBSCRIPTION_AUTO_DEACTIVATED en audit log

**Esfuerzo:** 2-3 horas
**Mock:** PrismaService (findMany, updateMany, $transaction), ClientsService (calculateSubDebt), AuditService

### 1.2 clients.service.spec.ts
**Qué testear:**

- `findAll()` sin filtro de deuda: paginación DB correcta
- `findAll()` con debtStatus: filtro en memoria funciona (AL_DIA, 1_MES, 2_MESES, MAS_2_MESES)
- `findAll()` con zona: pasa zona al where de Prisma
- `getDebtStats()` cuenta correctamente alDia/unMes/dosMeses/masDosMeses
- `getDebtStats()` retorna scoring (bueno/regular/riesgo/critico)
- `findOneWithDebt()` retorna campos fiscales (telefono, email, zona, tipoComprobante)
- `findOneWithDebt()` retorna null si cliente no existe
- `calculateDebt()` proxy llama a DebtService correctamente
- Scoring: `calcularScoring()` ya está testeado en debt.service.spec.ts — verificar integración

**Esfuerzo:** 2-3 horas
**Mock:** PrismaService (findMany, count, findUnique), DebtService

### 1.3 import.service.spec.ts
**Qué testear (lo más crítico):**

- `importClients()`: match por codCli, no pisa existentes
- `importClients()`: detecta estado BAJA en nombre
- `importDocuments()` tipo RAMITO: DELETE ALL excepto MANUAL-*
- `importDocuments()` tipo FACTURA: DELETE ALL excepto MANUAL-*
- Preservación de pagos manuales: docs con `MANUAL-*` no se borran
- Detección de ServiceType: "megas"/"internet" → INTERNET, "tvcable" → CABLE
- Batch insert en chunks de 500
- Invalida cache del dashboard después de importar
- Genera ImportLog con status SUCCESS/PARTIAL/FAILED
- Errores: P2002 (duplicado) se maneja sin crash

**Esfuerzo:** 3-4 horas
**Mock:** PrismaService (deleteMany, createMany, $transaction), DashboardService (invalidateCache)

---

## Fase 2 — Prioridad MEDIA (flujos de negocio)

### 2.1 fiscal.service.spec.ts (ampliar el existente)
**Qué agregar:**

- `emitirComprobanteParaPago()` con cliente RAMITO → retorna null
- `emitirComprobanteParaPago()` con cliente FACTURA → emite comprobante
- Aplica promociones al precio (calcularPrecioConPromo integrado)
- Detalle del comprobante incluye línea de descuento si hay promo
- IVA se calcula sobre precio descontado
- `getProvider()` retorna MockFiscalProvider cuando providerName='mock'
- `getProvider()` retorna TusFacturasProvider cuando providerName='tusFacturas'
- `getProvider()` lanza error si faltan credenciales TF
- `emitirBatch()` no emite duplicados (comprobante ya existe para ese pago)
- `updateComprobanteConfig()` valida que FACTURA requiere numeroDocFiscal

**Esfuerzo:** 2-3 horas
**Mock:** PrismaService, MockFiscalProvider

### 2.2 clients-operations.service.spec.ts
**Qué testear:**

- `createClient()` genera codCli autoincremental
- `createClient()` normaliza nombre
- `deactivateClient()` pasa a BAJA cliente + todas sus suscripciones
- `reactivateClient()` pasa a ACTIVO (solo ADMIN)
- `createManualPayment()` crea Document + PaymentPeriod
- `createManualPayment()` rechaza pagos futuros
- `createManualPayment()` rechaza duplicados (ConflictException)
- `createManualPayment()` auto-emite comprobante si tipoComprobante=FACTURA
- `deleteManualPayment()` solo permite eliminar docs MANUAL-*
- `logWhatsApp()` registra WHATSAPP_SENT en audit
- `getLastWhatsApp()` retorna último envío o null

**Esfuerzo:** 3-4 horas
**Mock:** PrismaService, AuditService, FiscalService

---

## Fase 3 — Prioridad BAJA (queries y CRUDs)

### 3.1 dashboard.service.spec.ts
**Qué testear:**

- `getDashboardMetrics()` retorna estructura correcta
- `getClientesParaCorte()` filtra solo clientes con requiereCorte
- `getTendencia()` retorna 12 meses de datos
- Cache: segunda llamada retorna datos cacheados (no vuelve a consultar)
- `invalidateCache()` limpia el cache
- `getTicketsDashboard()` retorna abiertos, resueltos hoy, sin resolver +48hs
- `getUmbralCorte()` retorna config o default 1

**Esfuerzo:** 2 horas
**Mock:** PrismaService, ClientsService

### 3.2 equipment.service.spec.ts
**Qué testear:**

- `create()` registra equipo con estado EN_DEPOSITO
- `assignToClient()` solo acepta equipos EN_DEPOSITO
- `assignToClient()` cambia estado a ASIGNADO
- `retire()` valida que la asignación pertenece al cliente
- `retire()` cambia estado a EN_DEPOSITO
- `update()` no permite EN_DEPOSITO si tiene asignaciones activas

**Esfuerzo:** 1-2 horas
**Mock:** PrismaService, AuditService

### 3.3 tickets.service.spec.ts
**Qué testear:**

- `create()` crea ticket ABIERTO
- `resolve()` cambia estado a RESUELTO + fecha resuelto
- `resolve()` rechaza si ya está resuelto (BadRequestException)
- `getStats()` calcula tiempo promedio resolución correctamente

**Esfuerzo:** 1 hora
**Mock:** PrismaService, AuditService

### 3.4 plans.service.spec.ts + promotions.service.spec.ts
**Qué testear:**

- CRUD básico: create, update, delete
- Plan no se puede desactivar con suscripciones activas
- Promo findActive filtra por fecha vigente
- assignToSubscription crea ClientPromotion

**Esfuerzo:** 1-2 horas
**Mock:** PrismaService, AuditService

---

## Resumen de esfuerzo

| Fase | Tests estimados | Horas | Cobertura esperada |
|------|----------------|-------|-------------------|
| Actual | 49 | — | 8% |
| Fase 1 (ALTA) | +35-45 | 7-10 hs | ~35% |
| Fase 2 (MEDIA) | +25-35 | 5-7 hs | ~55% |
| Fase 3 (BAJA) | +20-25 | 5-6 hs | ~70% |
| **Total** | **~130-155** | **17-23 hs** | **~70%** |

## Patrón de mocking recomendado

Todos los tests deben mockear Prisma para no depender de DB:

```typescript
// Ejemplo de mock pattern
const mockPrisma = {
  client: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  subscription: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  empresaConfig: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn((fns) => Promise.all(fns)),
};

const mockAudit = {
  log: jest.fn(),
  getByMultipleEntities: jest.fn(),
};

// Instanciar servicio con mocks
const service = new SchedulerService(
  mockPrisma as any,
  mockClientsService as any,
  mockAudit as any,
);
```

## Orden de implementación sugerido

1. **scheduler.service** — protege el cron nocturno (más crítico)
2. **import.service** — protege la importación de datos (más complejo)
3. **clients.service** — protege búsquedas y scoring
4. **fiscal.service** — protege facturación
5. **clients-operations** — protege operaciones manuales
6. **dashboard/equipment/tickets/plans/promotions** — cuando haya tiempo

## Criterio de éxito

- `npx jest --coverage` muestra 70%+ en módulos de Fase 1 y 2
- Ningún test depende de base de datos real (todos mockeados)
- Tests corren en <10 segundos total
- CI/CD puede correr tests en cada push
