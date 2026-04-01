# Reglas de Negocio

## Calculo de deuda

La deuda se calcula **por suscripcion** (no por cliente) en `calculateSubDebt()`.

### Algoritmo

1. Solo aplica a suscripciones ACTIVAS.
2. Meses obligatorios: desde `fechaAlta` de la suscripcion hasta el mes actual.
   - Si dia <= 15, el mes actual NO cuenta.
3. Meses cubiertos = meses pagados (PaymentPeriod) + meses con promo MESES_GRATIS.
   - Un mes cuenta como "gratis" solo si el mes COMPLETO cae dentro del periodo de la promo.
   - No se duplica: si un mes esta pagado Y tiene promo, cuenta una sola vez.
4. Deuda = meses desde ultimo cubierto + 1 hasta el mes actual.
   - Huecos anteriores al ultimo cubierto se perdonan.
5. `requiereCorte = cantidadDeuda > umbralCorte` (configurable en EmpresaConfig, default 1 → 2+ meses = corte).

### Resumen por cliente

El cliente agrega campos de resumen:
- `cantidadDeuda`: peor caso entre sus suscripciones
- `requiereCorte`: true si ALGUNA suscripcion requiere corte
- `deudaCable` / `deudaInternet`: deuda especifica por servicio
- `requiereCorteCable` / `requiereCorteInternet`: corte por servicio

### Cron nocturno

A las 5AM (Argentina), el cron recalcula deuda de todas las suscripciones activas:
- Procesa en batches de 100
- Actualiza `deudaCalculada`, `requiereCorte`, `ultimoCalculo` en cada suscripcion
- No usa transaccion global (batches independientes)

---

## Importacion de datos

### Orden obligatorio
clientes → ramitos → facturas (FK dependency).

### Clientes (NO pisa)
1. Lee `cod_cli` del Excel.
2. Si existe por codigo → skip (o actualiza a BAJA si `indicaBaja`).
3. Si es nuevo → crea con `codCli`, `nombreNormalizado`, `fechaAlta`, `calle`.

### Ramitos/Facturas (SI pisa, excepto manuales)
1. Borra todo del tipo EXCEPTO documentos con `numeroDocumento LIKE 'MANUAL-%'`.
2. Carga mapa de clientes (1 query) + mapa de suscripciones.
3. Detecta tipo de servicio (CABLE/INTERNET) por descripcion.
4. Busca/crea suscripcion automaticamente.
5. Batch insert documentos en chunks de 500.
6. Batch insert periodos con `skipDuplicates`.

### Deteccion de servicio
- INTERNET: "megas", "internet", "mbps", "fibra"
- CABLE: "tvcable", "tv cable", "cable"
- Default: CABLE

---

## Promociones

### Tipos
| Tipo | Efecto en precio | Efecto en deuda |
|---|---|---|
| PORCENTAJE | Descuento % | No |
| MONTO_FIJO | Descuento $ | No |
| PRECIO_FIJO | Precio especial | No |
| MESES_GRATIS | Precio = 0 | Si (mes cubierto) |

### Prioridad (cuando hay multiples)
1. MESES_GRATIS → precio 0, gana sobre todo
2. PRECIO_FIJO → usa ese precio
3. Mejor entre PORCENTAJE y MONTO_FIJO (mayor descuento)

### Scope
- PLAN: aplica a todas las suscripciones del plan automaticamente
- CLIENTE: se asigna manualmente a una suscripcion especifica

---

## Facturacion

### Tipo de comprobante
| Emisor | Receptor | Tipo |
|---|---|---|
| Responsable Inscripto | Responsable Inscripto | Factura A |
| Responsable Inscripto | Consumidor Final / Mono | Factura B |
| Monotributista | Cualquiera | Factura C |
| Mock (sin AFIP) | Cualquiera | Recibo X |

### IVA
- Responsable Inscripto: 21% sobre subtotal
- Monotributista: 0% (precio final incluye IVA)

### Numeracion
Correlativa por `puntoVenta + tipo`. El MockProvider consulta la tabla `Comprobante`.

---

## Autenticacion

- JWT con 8 horas de expiracion.
- Password hasheado con bcrypt (10 rounds).
- Token en header `Authorization: Bearer <token>`.
- 401 si token invalido/expirado → frontend hace logout automatico.
- Guards globales: todos los endpoints protegidos excepto `/health` y `/auth/login`.

---

## Cache

- Dashboard: metricas y lista corte cacheadas 1 minuto.
- Se invalida al importar datos (clientes, ramitos, facturas).
- Implementado en memoria en `DashboardService`.

---

## Audit log

Todas las operaciones manuales se registran:
- CLIENT_CREATED, CLIENT_DEACTIVATED, CLIENT_REACTIVATED
- SUBSCRIPTION_DEACTIVATED, SUBSCRIPTION_REACTIVATED, SUBSCRIPTION_PLAN_UPDATED
- PAYMENT_MANUAL_CREATED, PAYMENT_MANUAL_DELETED
- NOTE_CREATED, NOTE_DELETED
- PROMOTION_CREATED, PROMOTION_ASSIGNED, PROMOTION_REMOVED
- COMPROBANTE_EMITIDO, COMPROBANTE_ANULADO
- EMPRESA_CONFIG_UPDATED, CLIENT_FISCAL_UPDATED
