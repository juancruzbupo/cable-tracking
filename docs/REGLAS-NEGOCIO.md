# Reglas de Negocio

## Calculo de deuda

La deuda se calcula en runtime (no se persiste) via `calculateDebt()` en `clients.service.ts`.

### Algoritmo

1. **Solo aplica a clientes ACTIVO con fechaAlta**. Clientes BAJA o sin fechaAlta tienen deuda = 0.

2. **Rango de meses obligatorios**: desde `fechaAlta` hasta el mes actual.
   - Si estamos a dia 15 o antes, el mes actual NO cuenta.
   - Si estamos a dia 16 o despues, el mes actual SI cuenta.

3. **Calculo de deuda con pagos**:
   - Se busca el ultimo mes pagado (el mas reciente en PaymentPeriod).
   - La deuda son los meses desde `ultimoPago + 1` hasta el mes actual.
   - Los huecos anteriores al ultimo pago se **perdonan**.
   - Ejemplo: si pago enero y marzo, la deuda empieza en abril (febrero se perdona).

4. **Calculo de deuda sin pagos**:
   - La deuda son todos los meses desde `fechaAlta` hasta el mes actual.

5. **Umbral de corte**: `cantidadDeuda > 1` (2 o mas meses adeudados = requiere corte).

### Ejemplo

```
Cliente: GARCIA ANA, alta: 2024-06-01, hoy: 2026-04-01 (dia 1, <= 15)

Meses obligatorios: 2024-06 a 2026-03 (22 meses)
Pagos: [2025-12]
Ultimo pago: 2025-12
Deuda desde: 2026-01

Meses adeudados: [2026-01, 2026-02, 2026-03] = 3 meses
requiereCorte: true (3 > 1)
```

### Campos que retorna calculateDebt()

| Campo | Tipo | Descripcion |
|---|---|---|
| clientId | string | UUID del cliente |
| codCli | string | Codigo del cliente |
| nombreNormalizado | string | Nombre limpio |
| estado | string | ACTIVO o BAJA |
| fechaAlta | Date | Fecha de alta |
| calle | string | Direccion |
| mesesObligatorios | string[] | Todos los meses desde alta (para referencia visual) |
| mesesPagados | string[] | Meses con pagos registrados |
| mesesAdeudados | string[] | Meses que debe (desde ultimo pago + 1) |
| cantidadDeuda | number | Cantidad de meses adeudados |
| requiereCorte | boolean | true si cantidadDeuda > 1 |

---

## Importacion de datos

### Orden obligatorio

**clientes → ramitos → facturas**

Ramitos y facturas tienen FK a clientes. Si se importan antes, los codigos no matchean.

### Clientes (NO pisa datos existentes)

1. Lee `cod_cli` y `nombre` del Excel.
2. Si `cod_cli` ya existe en la DB → skip (salvo que indique baja, entonces actualiza estado).
3. Si es nuevo → crea el cliente con `codCli`, `nombreNormalizado`, `fechaAlta`, `calle`, `estado`.
4. `normalizeName()` limpia el nombre y detecta flag `indicaBaja` (busca "DE BAJA", "RETIRADO", etc.).
5. Timeout: 120 segundos.

### Ramitos / Facturas (SI pisa — destructivo)

1. **Borra todo** del tipo (RAMITO o FACTURA) incluyendo sus PaymentPeriods.
2. Carga un mapa de todos los clientes por `codCli` (1 sola query).
3. Para cada fila del Excel:
   - Lee `cod_cli` → busca en el mapa.
   - Si no encuentra → error, salta la fila.
   - Recolecta datos del documento.
4. Batch insert de documentos en chunks de 500 (`createMany`).
5. Recupera los documentos creados para obtener sus IDs.
6. Parsea periodos de cada `descripcionOriginal`.
7. Batch insert de periodos con `skipDuplicates`.
8. Timeout: 180 segundos.

### Columnas del Excel

El sistema busca multiples nombres por columna (case-insensitive):

| Dato | Nombres posibles |
|---|---|
| Codigo cliente | `cod_cli`, `codigo`, `cod`, `id`, `codigo_cliente` |
| Nombre | `nombre`, `nombre_cliente`, `cliente`, `name` |
| Fecha alta | `fecalta`, `fecha_alta`, `alta`, `fecha_ingreso` |
| Calle | `calle`, `direccion`, `domicilio`, `dir` |
| Fecha documento | `fecha`, `fecha_documento`, `date` |
| Nro. comprobante | `nro_comp`, `comprob`, `comprobante`, `numero` |
| Descripcion | `descrip`, `descripcion`, `desc`, `detalle` |

### Status de importacion

| Status | Significado |
|---|---|
| SUCCESS | Todas las filas se procesaron correctamente |
| PARTIAL | Algunas filas fallaron (los errores se guardan en `ImportLog.errors`) |
| FAILED | Ninguna fila se proceso correctamente |

---

## Normalizacion de nombres

`normalizeName()` en `normalize-name.util.ts`:

1. Convierte a MAYUSCULAS.
2. Detecta y remueve indicadores de baja ("DE BAJA", "RETIRADO", "CORTADO", etc.).
3. Remueve ruido: megas, velocidades, fechas, notas de admin.
4. Colapsa espacios multiples.
5. Filtra palabras de 1 sola letra.

**Entrada:** `"GARCIA ANA BEATRIZ 6 megas DE BAJA RETIRO 10-2-26"`
**Salida:** `{ nombreNormalizado: "GARCIA ANA BEATRIZ", indicaBaja: true, nombreOriginal: "GARCIA ANA BEATRIZ 6 megas DE BAJA RETIRO 10-2-26" }`

---

## Parseo de periodos

`parsePeriodsFromDescription()` en `parse-periods.util.ts`:

Extrae periodos mensuales de texto libre. Busca patrones `{NombreMes}{Ano}`.

**Ejemplos:**
- `"TvCable Enero26 del 1 al 15"` → `[{year: 2026, month: 1}]`
- `"6Megas Diciembre25"` → `[{year: 2025, month: 12}]`
- `"Promo 3Megas Noviembre25"` → `[{year: 2025, month: 11}]`

**Ignorados** (no generan periodos):
- SUSCRIPCION
- RECONEXION
- PUNTO ADICIONAL
- TRASLADO
- CAMBIO DE MODEM
- INSTALACION

---

## Cache

El dashboard tiene cache en memoria con TTL de 1 minuto:
- `getDashboardMetrics()` — metricas generales
- `getClientesParaCorte()` — lista de clientes para corte

El cache se invalida automaticamente despues de cada importacion (clientes, ramitos o facturas).
