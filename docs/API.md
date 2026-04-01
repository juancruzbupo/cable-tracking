# API Reference

Base URL: `/api`
Swagger UI: `http://localhost:3000/api/docs`

## Health

### GET /health
Verifica que el backend esta corriendo.

**Response:** `{ "status": "ok", "timestamp": "2026-04-01T12:00:00.000Z" }`

---

## Clients

### GET /clients
Lista clientes con filtros y paginacion.

**Query params (validados por DTO):**
| Param | Tipo | Default | Descripcion |
|---|---|---|---|
| search | string (max 100) | - | Busca por nombre o codigo |
| estado | ACTIVO / BAJA | - | Filtrar por estado |
| debtStatus | AL_DIA / 1_MES / 2_MESES / MAS_2_MESES | - | Filtrar por nivel de deuda |
| page | int (min 1) | 1 | Pagina |
| limit | int (1-100) | 20 | Resultados por pagina |

**Response:**
```json
{
  "data": [{
    "id": "uuid",
    "codCli": "201",
    "nombreOriginal": "GARCIA ANA 6 megas",
    "nombreNormalizado": "GARCIA ANA",
    "fechaAlta": "2024-06-01T00:00:00.000Z",
    "estado": "ACTIVO",
    "calle": "AV. SAN MARTIN 123",
    "paymentPeriods": [{ "year": 2026, "month": 1 }],
    "debtInfo": {
      "clientId": "uuid",
      "codCli": "201",
      "cantidadDeuda": 3,
      "requiereCorte": true,
      "mesesAdeudados": ["2026-01", "2026-02", "2026-03"],
      "mesesPagados": ["2025-12"],
      "mesesObligatorios": ["2024-06", "..."]
    }
  }],
  "pagination": { "total": 1099, "page": 1, "limit": 20, "totalPages": 55 }
}
```

**Nota:** Cuando se filtra por `debtStatus`, se cargan todos los clientes en memoria para calcular deuda y filtrar. Esto funciona bien hasta ~10k clientes.

### GET /clients/stats
Estadisticas de deuda de todos los clientes activos.

**Response:**
```json
{
  "total": 628,
  "alDia": 10,
  "unMes": 50,
  "dosMeses": 200,
  "masDosMeses": 368,
  "requierenCorte": 568,
  "tasaMorosidad": 98.4,
  "clientesParaCorte": ["GARCIA ANA", "LOPEZ JUAN", "..."]
}
```

### GET /clients/:id
Detalle de un cliente con deuda y documentos paginados.

**Query params:**
| Param | Tipo | Default | Descripcion |
|---|---|---|---|
| docPage | int (min 1) | 1 | Pagina de documentos |
| docLimit | int (1-50) | 20 | Documentos por pagina |

**Response:** ClientDetailResult con `debtInfo` + `documents[]` + `docPagination`

---

## Documents

### GET /documents
Lista documentos con filtros.

**Query params (validados por DTO):**
| Param | Tipo | Default | Descripcion |
|---|---|---|---|
| tipo | RAMITO / FACTURA | - | Filtrar por tipo |
| clientId | UUID | - | Filtrar por cliente |
| page | int (min 1) | 1 | Pagina |
| limit | int (1-100) | 20 | Resultados por pagina |

### GET /documents/:id
Detalle de un documento. Retorna 404 si no existe.

---

## Import

### POST /import/preview/:tipo
Preview de un archivo Excel antes de importar. `tipo`: `clientes`, `ramitos`, `facturas`.

**Body:** `multipart/form-data` con campo `file` (xlsx/xls, max 10MB)

**Response:**
```json
{
  "headers": ["cod_cli", "nombre", "fecha", "descrip"],
  "totalRows": 500,
  "sampleRows": [{ "cod_cli": 201, "nombre": "GARCIA ANA" }],
  "validRows": 498,
  "invalidRows": 2,
  "errors": [{ "row": 10, "message": "Codigo de cliente vacio" }]
}
```

### POST /import/clientes
Importa clientes. No pisa existentes.

### POST /import/ramitos
Importa remitos. BORRA TODOS los remitos existentes primero.

### POST /import/facturas
Importa facturas. BORRA TODAS las facturas existentes primero.

**Response (los 3):**
```json
{
  "success": true,
  "tipo": "RAMITOS",
  "totalRows": 500,
  "validRows": 490,
  "invalidRows": 10,
  "newClients": 0,
  "updatedClients": 0,
  "documentsCreated": 490,
  "periodsCreated": 850,
  "errors": [{ "row": 5, "message": "Cliente no encontrado con codigo: \"999\"", "value": "999" }]
}
```

### GET /import/logs
Historial de importaciones (limit max 100, default 20).

---

## Dashboard

### GET /dashboard
Metricas generales. **Cacheado 1 minuto.**

### GET /dashboard/corte
Lista de clientes que requieren corte. **Cacheado 1 minuto.**

---

## Export

### GET /export/corte
Descarga Excel con clientes para corte.

### GET /export/clients
Descarga Excel con todos los clientes y su estado de deuda.

### GET /export/resumen
Descarga Excel con resumen general + hoja de corte.

---

## Errores

Todas las respuestas de error siguen el formato:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "limit must not be less than 1",
  "details": { "message": ["limit must not be less than 1"], "error": "Bad Request", "statusCode": 400 },
  "timestamp": "2026-04-01T12:00:00.000Z"
}
```

| Codigo | Significado |
|---|---|
| 400 | Validacion fallida (parametros invalidos, archivo faltante) |
| 404 | Recurso no encontrado (cliente, documento) |
| 500 | Error interno del servidor |
