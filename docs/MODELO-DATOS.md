# Modelo de Datos (13 tablas)

## Diagrama de relaciones

```
User ──< ClientNote (userId)
User ──< AuditLog (userId)

Client
  ├──< Subscription (clientId) [UNIQUE: clientId+tipo]
  │     ├──< Document (subscriptionId)
  │     ├──< PaymentPeriod (subscriptionId)
  │     ├──< ClientPromotion (subscriptionId)
  │     └──< Comprobante (subscriptionId)
  ├──< Document (clientId) [CASCADE]
  ├──< PaymentPeriod (clientId) [CASCADE]
  ├──< ClientNote (clientId) [CASCADE]
  └──< Comprobante (clientId)

ServicePlan
  ├──< Subscription (planId)
  └──< Promotion (planId)

Promotion ──< ClientPromotion (promotionId) [CASCADE]
Document ──< PaymentPeriod (documentId) [CASCADE]

EmpresaConfig (singleton)
ImportLog (independiente)
```

## Tablas

### User
Usuarios del sistema con autenticacion JWT.

| Campo | Tipo | Descripcion |
|---|---|---|
| id | UUID | PK |
| email | String | UNIQUE, login |
| password | String | bcrypt hash |
| name | String | Nombre para mostrar |
| role | Role | ADMIN / OPERADOR / VISOR |
| isActive | Boolean | Soft delete |

### Client
Abonado del servicio de cable/internet.

| Campo | Tipo | Descripcion |
|---|---|---|
| id | UUID | PK |
| codCli | String | UNIQUE, clave de match con Excel |
| nombreOriginal | String | Nombre tal como viene del Excel |
| nombreNormalizado | String | Nombre limpio (mayusculas, sin ruido) |
| fechaAlta | Date? | Fecha de alta del servicio |
| estado | ClientStatus | ACTIVO / BAJA |
| calle | String? | Direccion |
| tipoDocumento | TipoDocumento? | CUIT / CUIL / DNI / CONSUMIDOR_FINAL |
| numeroDocFiscal | String? | Numero de documento sin guiones |
| condicionFiscal | CondicionFiscal | Default: CONSUMIDOR_FINAL |
| razonSocial | String? | Para empresas |
| telefono | String? | Contacto |
| email | String? | Contacto |
| codigoPostal | String? | Codigo postal (ARCA) |
| localidad | String? | Localidad |
| provincia | String? | Default: "Entre Ríos" |
| zona | String? | Zona de cobranza (para recorridos) |

### Subscription
Servicio activo de un cliente. Un cliente puede tener maximo uno de cada tipo.

| Campo | Tipo | Descripcion |
|---|---|---|
| id | UUID | PK |
| clientId | UUID | FK → Client |
| tipo | ServiceType | CABLE / INTERNET |
| fechaAlta | Date | Inicio del servicio |
| estado | ClientStatus | ACTIVO / BAJA |
| planId | UUID? | FK → ServicePlan |
| deudaCalculada | Int? | Cache: meses de deuda (actualizado por cron) |
| requiereCorte | Boolean | Cache: true si deuda > 1 |
| ultimoCalculo | DateTime? | Timestamp del ultimo recalculo |

**UNIQUE**: `(clientId, tipo)` — un cliente no puede tener 2 suscripciones del mismo tipo.

### ServicePlan
Plan de servicio con precio.

| Campo | Tipo | Descripcion |
|---|---|---|
| id | UUID | PK |
| nombre | String | Ej: "Internet 100MB" |
| tipo | ServiceType | CABLE / INTERNET |
| precio | Decimal(10,2) | Precio mensual |
| activo | Boolean | Soft delete |

### Document
Factura o remito importado del Excel o generado manualmente.

| Campo | Tipo | Descripcion |
|---|---|---|
| id | UUID | PK |
| clientId | UUID | FK → Client (CASCADE) |
| codCli | String | Codigo de cliente (denormalizado) |
| subscriptionId | UUID? | FK → Subscription |
| tipo | DocumentType | RAMITO / FACTURA |
| fechaDocumento | Date? | Fecha de emision |
| numeroDocumento | String? | Numero comprobante. `MANUAL-*` = pago manual |
| descripcionOriginal | String? | Texto del Excel (se parsean periodos) |
| formaPago | String? | Canal de pago: EFECTIVO / TRANSFERENCIA / DEBITO / OTRO (solo manuales) |

### PaymentPeriod
Registra que un cliente tiene cubierto un mes especifico.

| Campo | Tipo | Descripcion |
|---|---|---|
| id | UUID | PK |
| clientId | UUID | FK → Client (CASCADE) |
| codCli | String | Denormalizado |
| documentId | UUID | FK → Document (CASCADE) |
| subscriptionId | UUID? | FK → Subscription |
| periodo | Date | Primer dia del mes cubierto |
| year | Int | Ano |
| month | Int | Mes (1-12) |

**UNIQUE**: `(clientId, periodo, documentId)`

### Promotion
Promocion que puede aplicar a un plan o a un cliente especifico.

| Campo | Tipo | Descripcion |
|---|---|---|
| id | UUID | PK |
| nombre | String | Nombre de la promo |
| tipo | PromoType | PORCENTAJE / MONTO_FIJO / PRECIO_FIJO / MESES_GRATIS |
| valor | Decimal(10,2) | Porcentaje (1-100), monto fijo, o 0 para MESES_GRATIS |
| scope | PromoScope | PLAN (automatica) / CLIENTE (manual) |
| fechaInicio | Date | Inicio del periodo |
| fechaFin | Date | Fin del periodo |
| activa | Boolean | Flag on/off |
| planId | UUID? | FK → ServicePlan (solo si scope=PLAN) |

### ClientPromotion
Join table: asigna una promo scope=CLIENTE a una suscripcion.

| Campo | Tipo | Descripcion |
|---|---|---|
| id | UUID | PK |
| promotionId | UUID | FK → Promotion (CASCADE) |
| subscriptionId | UUID | FK → Subscription (CASCADE) |
| assignedBy | String | userId que la asigno |

**UNIQUE**: `(promotionId, subscriptionId)`

### Comprobante
Comprobante fiscal (factura/recibo) con campos AFIP-ready.

| Campo | Tipo | Descripcion |
|---|---|---|
| id | UUID | PK |
| clientId | UUID | FK → Client |
| subscriptionId | UUID? | FK → Subscription |
| paymentPeriodId | String? | ID del pago que origino el comprobante |
| tipo | TipoComprobante | FACTURA_A / FACTURA_B / FACTURA_C / RECIBO_X |
| numero | Int | Numeracion correlativa |
| puntoVenta | Int | Default 1 |
| fecha | Date | Fecha de emision |
| emisor* | String | Snapshot de datos del emisor al momento de emision |
| receptor* | String | Snapshot de datos del receptor |
| subtotal | Decimal | Monto sin IVA |
| descuento | Decimal | Descuento aplicado |
| iva | Decimal | IVA calculado |
| total | Decimal | Monto final |
| detalle | JSON | Array de lineas del comprobante |
| estado | EstadoComprobante | PENDIENTE / EMITIDO / ANULADO / ERROR |
| cae | String? | Codigo AFIP (null en mock) |
| caeFechaVto | DateTime? | Vencimiento del CAE |
| providerResponse | JSON? | Respuesta raw del proveedor |
| concepto | Int | Default: 2 (Servicios). 1=Productos, 2=Servicios, 3=Ambos |
| fechaServDesde | Date? | Primer dia del periodo facturado (obligatorio ARCA concepto=2) |
| fechaServHasta | Date? | Ultimo dia del periodo facturado |
| fechaVtoPago | Date? | Fecha limite de pago |
| formaPago | String? | Default: "CONTADO". CONTADO / CUENTA_CORRIENTE |

### EmpresaConfig
Configuracion de la empresa emisora (singleton).

| Campo | Tipo | Descripcion |
|---|---|---|
| id | UUID | PK |
| cuit | String | CUIT de la empresa |
| razonSocial | String | Razon social |
| condicionFiscal | String | "Responsable Inscripto" / "Monotributista" |
| domicilioFiscal | String? | Domicilio fiscal |
| puntoVenta | Int | Punto de venta AFIP |
| providerName | String | "mock" / "tusFacturas" / etc |
| providerApiKey | String? | API key (no se retorna en GET) |
| iibb | String? | Ingresos brutos |
| actividadCodigo | String? | Default: "613000" (Telecomunicaciones) |
| localidad | String? | Localidad de la empresa |
| logoUrl | String? | URL del logo |
| umbralCorte | Int | Default: 1. Meses deuda > umbral = corte |
| zonaDefault | String? | Zona por defecto para alta de clientes |

### ClientNote
Notas de texto libre sobre un cliente.

| Campo | Tipo | Descripcion |
|---|---|---|
| id | UUID | PK |
| clientId | UUID | FK → Client (CASCADE) |
| userId | UUID | FK → User |
| content | String | Texto de la nota (max 1000) |

### AuditLog
Registro de acciones del sistema.

| Campo | Tipo | Descripcion |
|---|---|---|
| id | UUID | PK |
| userId | UUID | FK → User |
| action | String | Accion realizada (ej: CLIENT_CREATED, PAYMENT_MANUAL_CREATED) |
| entityType | String | Tipo de entidad (CLIENT, SUBSCRIPTION, PAYMENT, NOTE, etc) |
| entityId | String | ID de la entidad afectada |
| metadata | JSON? | Datos adicionales (before/after) |

### ImportLog
Registro de cada importacion de Excel.

| Campo | Tipo | Descripcion |
|---|---|---|
| id | UUID | PK |
| tipo | String | CLIENTES / RAMITOS / FACTURAS |
| fileName | String | Nombre del archivo |
| totalRows | Int | Filas totales |
| validRows | Int | Filas procesadas |
| invalidRows | Int | Filas con error |
| errors | JSON? | Array de errores detallados |
| status | String | SUCCESS / PARTIAL / FAILED |

## Enums

| Enum | Valores |
|---|---|
| ClientStatus | ACTIVO, BAJA |
| DocumentType | RAMITO, FACTURA |
| ServiceType | CABLE, INTERNET |
| Role | ADMIN, OPERADOR, VISOR |
| PromoType | PORCENTAJE, MONTO_FIJO, MESES_GRATIS, PRECIO_FIJO |
| PromoScope | PLAN, CLIENTE |
| TipoDocumento | CUIT, CUIL, DNI, CONSUMIDOR_FINAL |
| CondicionFiscal | RESPONSABLE_INSCRIPTO, MONOTRIBUTISTA, CONSUMIDOR_FINAL, EXENTO |
| TipoComprobante | FACTURA_A, FACTURA_B, FACTURA_C, RECIBO_X |
| EstadoComprobante | PENDIENTE, EMITIDO, ANULADO, ERROR |
