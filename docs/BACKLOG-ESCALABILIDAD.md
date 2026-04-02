# Backlog de Escalabilidad — cable-tracking

Estado actual: ~1100 clientes. Estos items se implementan cuando el negocio crezca.

---

## Implementado (Sprint actual)

- [x] Connection pool: `connection_limit=20` en DATABASE_URL
- [x] Rate limiting: ThrottlerModule (100 req/min por IP)
- [x] HTTP timeout: 60s server timeout + keepAlive config
- [x] Scheduler cursor-based: carga de a 500 en vez de todo a memoria
- [x] Indexes: Subscription.estado, Promotion.activa
- [x] Cache dashboard: getRiesgo, getCrecimiento, getZonas (1 min TTL)
- [x] Pagination: equipment, notes (100), client tickets (50)

---

## Prioridad 1 — Implementar al llegar a 3K-5K clientes

### 1.1 Redis para cache distribuido
**Problema:** Cache en memoria se pierde al reiniciar y no funciona con múltiples instancias.
**Solución:** Reemplazar `Map` en DashboardService por Redis (ioredis o @nestjs/cache-manager con store redis).
**Esfuerzo:** 1-2 días. Agregar Redis a docker-compose, instalar ioredis, crear CacheService global.

### 1.2 Materializar deuda en DB para evitar cálculos on-the-fly
**Problema:** `getDebtStats()` y `getClientesParaCorte()` cargan TODOS los clientes y calculan deuda en JS.
**Solución:** El cron nocturno ya calcula `deudaCalculada` y `requiereCorte` por suscripción. Agregar campos resumen al modelo Client (`cantidadDeuda`, `requiereCorte`, `deudaCable`, `deudaInternet`) y actualizarlos en el cron. Así las queries del dashboard y corte se hacen con WHERE simples, sin cargar suscripciones.
**Esfuerzo:** 2-3 días. Migración + modificar scheduler + modificar dashboard/corte queries.

### 1.3 findAll con debtStatus: filtrar por campos materializados
**Problema:** Filtrar por deuda carga todos los clientes en memoria.
**Solución:** Con los campos materializados del 1.2, el filtro se convierte en un WHERE en la DB: `WHERE cantidadDeuda = 0` (AL_DIA), `WHERE cantidadDeuda > umbralCorte` (CORTE), etc.
**Esfuerzo:** 1 día (depende de 1.2).

---

## Prioridad 2 — Implementar al llegar a 5K-10K clientes

### 2.1 Worker threads para PDFs masivos
**Problema:** `generateBatchInvoices()` genera PDFs secuencialmente (1-2s cada uno).
**Solución:** Usar Bull/BullMQ con workers para generar PDFs en paralelo (5-10 concurrentes). El endpoint devuelve un jobId y el frontend hace polling del progreso.
**Esfuerzo:** 3-5 días. Instalar Bull + Redis, crear job queue, endpoint de status, UI de progreso.

### 2.2 Import incremental en vez de DELETE ALL
**Problema:** Reimportar ramitos/facturas borra TODOS y reinserta. Con 50K+ docs esto lockea la tabla.
**Solución:** Import diferencial: comparar documentos existentes vs nuevos por hash/id, solo insertar nuevos y marcar eliminados. Preservar MANUAL-* sin necesidad de exclusión especial.
**Esfuerzo:** 3-4 días. Requiere lógica de diff + campo hash en Document.

### 2.3 Fiscal batch con cola de trabajo
**Problema:** `emitirBatch()` hace llamadas API secuenciales (1-2s cada una × miles).
**Solución:** Encolar emisiones en Bull queue con concurrencia de 3-5 (respetando rate limit de TusFacturas). Endpoint devuelve jobId, frontend muestra progreso.
**Esfuerzo:** 2-3 días (reutiliza infraestructura de 2.1).

### 2.4 Exports con streaming
**Problema:** Exportar Excel carga todos los clientes en memoria + genera archivo en memoria.
**Solución:** Streaming con ExcelJS: leer clientes con cursor Prisma, escribir fila por fila al stream, pipe directo al response HTTP.
**Esfuerzo:** 2 días.

---

## Prioridad 3 — Implementar al llegar a 10K-50K clientes

### 3.1 Read replicas para queries pesados
**Problema:** Dashboard, exports y reportes compiten por conexiones con operaciones CRUD.
**Solución:** Configurar read replica en PostgreSQL. Las queries de lectura pesada (dashboard, exports, reportes) van a la replica; las escrituras al primary.
**Esfuerzo:** 1-2 días de config + Prisma multi-datasource.

### 3.2 Archivado de AuditLog y PaymentPeriod
**Problema:** Tablas que crecen indefinidamente (~500K rows/año con 50K clientes).
**Solución:** Cron mensual que mueve registros de AuditLog > 12 meses a tabla `audit_log_archive`. Similar para PaymentPeriod de períodos cerrados > 24 meses.
**Esfuerzo:** 1-2 días.

### 3.3 API pagination con cursor en vez de offset
**Problema:** `OFFSET 10000` es lento en PostgreSQL (escanea y descarta filas).
**Solución:** Reemplazar offset-based pagination por cursor-based (`WHERE id > lastId LIMIT 20`) en endpoints de alto tráfico (clients, documents).
**Esfuerzo:** 2 días.

### 3.4 Múltiples instancias + load balancer
**Problema:** Una sola instancia Node.js no escala horizontalmente.
**Solución:** Deploy con PM2 cluster mode o múltiples containers + nginx/Traefik. Requiere Redis (3.1) para cache compartido y Bull (2.1) para jobs.
**Esfuerzo:** 1-2 días de infra (depende de 1.1 y 2.1).

---

## Métricas para decidir cuándo implementar

| Métrica | Umbral | Acción |
|---------|--------|--------|
| Clientes activos | > 3000 | Implementar Prioridad 1 |
| Dashboard load time | > 5 segundos | Materializar deuda (1.2) |
| Cron nocturno | > 2 minutos | Ya resuelto con cursor |
| Batch PDF | > 5 minutos | Implementar workers (2.1) |
| Import Excel | > 30 segundos | Import incremental (2.2) |
| Clientes activos | > 10000 | Implementar Prioridad 2-3 |
| AuditLog rows | > 1M | Implementar archivado (3.2) |
| Requests/min | > 500 | Múltiples instancias (3.4) |
