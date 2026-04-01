# Modelo de Datos

## Diagrama de relaciones

```
Client (1)
  │
  ├──< Document (N)       → FK: clientId + codCli denormalizado
  │     │
  │     └──< PaymentPeriod (N)  → FK: documentId + clientId + codCli
  │
  └──< PaymentPeriod (N)  → FK: clientId (acceso directo sin pasar por Document)

ImportLog (independiente, sin FK)
```

## Tablas

### Client
Representa un abonado del servicio de cable/internet.

| Campo | Tipo | Constraints | Descripcion |
|---|---|---|---|
| id | UUID | PK | Identificador interno |
| codCli | String | UNIQUE, NOT NULL | Codigo del sistema de gestion. Clave de match con Excel |
| nombreOriginal | String | NOT NULL | Nombre tal como viene del Excel |
| nombreNormalizado | String | NOT NULL | Nombre limpio (mayusculas, sin ruido) |
| fechaAlta | Date | nullable | Fecha de alta del servicio |
| estado | Enum | ACTIVO / BAJA | Estado actual del cliente |
| calle | String | nullable | Direccion del cliente |
| createdAt | DateTime | auto | Fecha de creacion del registro |
| updatedAt | DateTime | auto | Ultima modificacion |

**Indices:** `estado`, `nombreNormalizado`, `codCli` (unique)

### Document
Representa una factura o remito importado del Excel.

| Campo | Tipo | Constraints | Descripcion |
|---|---|---|---|
| id | UUID | PK | |
| clientId | UUID | FK → Client.id, CASCADE | |
| codCli | String | NOT NULL | Codigo de cliente (denormalizado para queries) |
| tipo | Enum | RAMITO / FACTURA | Tipo de documento |
| fechaDocumento | Date | nullable | Fecha de emision |
| numeroDocumento | String | nullable | Numero de comprobante |
| descripcionOriginal | String | nullable | Texto libre del Excel (de aca se extraen periodos) |
| createdAt | DateTime | auto | |

**Indices:** `tipo`, `clientId`, `(clientId, tipo)`, `codCli`

### PaymentPeriod
Registra que un cliente tiene cubierto un mes especifico, extraido de la descripcion del documento.

| Campo | Tipo | Constraints | Descripcion |
|---|---|---|---|
| id | UUID | PK | |
| clientId | UUID | FK → Client.id, CASCADE | |
| codCli | String | NOT NULL | Codigo de cliente (denormalizado) |
| documentId | UUID | FK → Document.id, CASCADE | Documento de origen |
| periodo | Date | NOT NULL | Primer dia del mes cubierto |
| year | Int | NOT NULL | Ano del periodo |
| month | Int | NOT NULL | Mes del periodo (1-12) |
| createdAt | DateTime | auto | |

**Constraint UNIQUE:** `(clientId, periodo, documentId)` — permite que el mismo periodo aparezca en distintos documentos del mismo cliente.

**Indices:** `(clientId, periodo)`, `(clientId, year, month)`, `documentId`

### ImportLog
Registro de cada importacion realizada.

| Campo | Tipo | Descripcion |
|---|---|---|
| id | UUID | PK |
| tipo | String | CLIENTES / RAMITOS / FACTURAS |
| fileName | String | Nombre del archivo subido |
| totalRows | Int | Filas totales en el Excel |
| validRows | Int | Filas procesadas correctamente |
| invalidRows | Int | Filas con errores |
| newClients | Int | Clientes nuevos creados (solo para tipo CLIENTES) |
| updatedClients | Int | Clientes actualizados a BAJA |
| errors | JSON | Array de errores detallados |
| status | String | SUCCESS / PARTIAL / FAILED |
| executedAt | DateTime | Fecha de ejecucion |

## Cascading Deletes

Borrar un `Client` elimina en cascada:
1. Todos sus `Document`
2. Todos sus `PaymentPeriod` (tanto los que van via Document como los directos)

Borrar un `Document` elimina en cascada:
1. Todos sus `PaymentPeriod`

## Notas de diseno

- **codCli denormalizado en Document y PaymentPeriod**: permite queries directas sin JOIN al Client. Se mantiene consistente porque la importacion siempre copia `client.codCli`.
- **PaymentPeriod tiene FK tanto a Client como a Document**: el FK a Client es redundante (se podria llegar via Document) pero se mantiene por performance en `calculateDebt()`.
- **Campos snake_case en DB, camelCase en TypeScript**: via `@@map` y `@map` de Prisma.
