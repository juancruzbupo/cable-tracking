# Cable Tracking - Documentacion Tecnica

## Indice

1. [Descripcion general](#1-descripcion-general)
2. [Arquitectura del proyecto](#2-arquitectura-del-proyecto)
3. [Estructura de carpetas](#3-estructura-de-carpetas)
4. [Stack tecnologico](#4-stack-tecnologico)
5. [Modelo de datos](#5-modelo-de-datos)
6. [Modulos del backend](#6-modulos-del-backend)
7. [Paginas del frontend](#7-paginas-del-frontend)
8. [API Endpoints](#8-api-endpoints)
9. [Reglas de negocio](#9-reglas-de-negocio)
10. [Flujo de datos e importacion](#10-flujo-de-datos-e-importacion)
11. [Utilidades y parsers](#11-utilidades-y-parsers)
12. [Scripts auxiliares](#12-scripts-auxiliares)
13. [Configuracion y entorno](#13-configuracion-y-entorno)
14. [Setup del proyecto](#14-setup-del-proyecto)
15. [Deploy a produccion](#15-deploy-a-produccion)
16. [Buenas practicas y convenciones](#16-buenas-practicas-y-convenciones)
17. [Consideraciones de rendimiento](#17-consideraciones-de-rendimiento)
18. [Seguridad](#18-seguridad)
19. [Troubleshooting](#19-troubleshooting)

---

## 1. Descripcion general

Cable Tracking es un sistema empresarial para la **gestion y seguimiento de clientes de una empresa de cable**. Permite:

- Importar datos de clientes, ramitos (recibos) y facturas desde archivos Excel.
- Calcular automaticamente la deuda de cada cliente basandose en los periodos de pago registrados.
- Determinar que clientes requieren corte de servicio (mas de 2 meses de deuda).
- Visualizar metricas en un dashboard con graficos.
- Exportar reportes a Excel (listado de corte, clientes con deuda, resumen general).

El sistema esta pensado para uso interno de la empresa, donde un operador carga periodicamente los archivos Excel que genera el sistema de facturacion/gestion existente.

---

## 2. Arquitectura del proyecto

El proyecto utiliza una arquitectura **monorepo** con `pnpm workspaces`, separando frontend y backend en dos aplicaciones independientes que se comunican via REST API.

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│          React 18 + TypeScript + Vite + Ant Design          │
│                    (localhost:5174)                          │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │Dashboard │ │Clientes  │ │Importar  │ │Para Corte│       │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │
│       └─────────────┴────────────┴────────────┘             │
│                         │ axios                             │
├─────────────────────────┼───────────────────────────────────┤
│                    Vite Proxy                               │
│                   /api → :3000                              │
├─────────────────────────┼───────────────────────────────────┤
│                         ▼                                   │
│                       BACKEND                               │
│            NestJS 10 + Prisma 5 (ORM)                       │
│                    (localhost:3000)                          │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Clients  │ │  Import  │ │Dashboard │ │  Export  │       │
│  │ Module   │ │  Module  │ │ Module   │ │  Module  │       │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │
│       └─────────────┴────────────┴────────────┘             │
│                         │ Prisma ORM                        │
├─────────────────────────┼───────────────────────────────────┤
│                         ▼                                   │
│                    PostgreSQL 16                             │
│              (Docker / Supabase en prod)                     │
└─────────────────────────────────────────────────────────────┘
```

**Comunicacion frontend → backend:**
- En desarrollo, Vite actua como proxy reverso: las peticiones a `/api/*` se redirigen a `http://localhost:3000`.
- En produccion, el frontend define `VITE_API_URL` apuntando directamente al backend.

---

## 3. Estructura de carpetas

```
cable-tracking/
├── apps/
│   ├── backend/                        # Aplicacion NestJS
│   │   ├── prisma/
│   │   │   ├── schema.prisma           # Definicion del modelo de datos
│   │   │   └── migrations/             # Migraciones auto-generadas por Prisma
│   │   ├── scripts/
│   │   │   ├── seed.ts                 # Datos de prueba para desarrollo
│   │   │   └── validate-data.ts        # Validacion offline contra archivos Excel
│   │   └── src/
│   │       ├── main.ts                 # Bootstrap de NestJS (CORS, Swagger, pipes)
│   │       ├── app.module.ts           # Modulo raiz + health check
│   │       ├── common/
│   │       │   ├── prisma/
│   │       │   │   ├── prisma.module.ts    # Modulo global de Prisma
│   │       │   │   └── prisma.service.ts   # Servicio de Prisma con transacciones
│   │       │   ├── utils/
│   │       │   │   ├── normalize-name.util.ts   # Normalizacion de nombres
│   │       │   │   ├── parse-periods.util.ts    # Extraccion de periodos de pago
│   │       │   │   └── excel-parser.util.ts     # Lectura de archivos Excel
│   │       │   └── filters/
│   │       │       └── global-exception.filter.ts  # Manejo global de errores
│   │       └── modules/
│   │           ├── clients/            # CRUD + calculo de deuda
│   │           │   ├── clients.module.ts
│   │           │   ├── clients.controller.ts
│   │           │   └── clients.service.ts
│   │           ├── documents/          # Consulta de ramitos/facturas
│   │           │   ├── documents.module.ts
│   │           │   └── documents.controller.ts
│   │           ├── import/             # Importacion de archivos Excel
│   │           │   ├── import.module.ts
│   │           │   ├── import.controller.ts
│   │           │   └── import.service.ts
│   │           ├── dashboard/          # Metricas y clientes para corte
│   │           │   ├── dashboard.module.ts
│   │           │   ├── dashboard.controller.ts
│   │           │   └── dashboard.service.ts
│   │           └── export/             # Generacion de archivos Excel
│   │               ├── export.module.ts
│   │               ├── export.controller.ts
│   │               └── export.service.ts
│   └── frontend/                       # Aplicacion React
│       ├── vite.config.ts              # Configuracion de Vite + proxy
│       └── src/
│           ├── main.tsx                # Entry point de React
│           ├── App.tsx                 # Layout principal + rutas
│           ├── pages/
│           │   ├── DashboardPage.tsx   # Metricas y graficos
│           │   ├── ClientsPage.tsx     # Tabla de clientes + detalle
│           │   ├── ImportPage.tsx      # Upload de archivos Excel
│           │   ├── DocumentsPage.tsx   # Listado de documentos
│           │   └── CortePage.tsx       # Clientes para corte
│           ├── services/
│           │   └── api.ts              # Cliente HTTP (axios)
│           └── types/
│               └── index.ts            # Interfaces TypeScript compartidas
├── docker-compose.yml                  # PostgreSQL para desarrollo local
├── pnpm-workspace.yaml                 # Configuracion de workspaces
└── package.json                        # Scripts del monorepo
```

---

## 4. Stack tecnologico

### Frontend

| Tecnologia | Version | Uso |
|---|---|---|
| React | 18.2 | UI library |
| TypeScript | 5.3 | Tipado estatico |
| Vite | 5.0 | Bundler y dev server |
| Ant Design | 5.12 | Componentes UI |
| Recharts | 2.10 | Graficos (pie chart del dashboard) |
| Axios | 1.6 | Cliente HTTP |
| React Router DOM | 6.21 | Enrutamiento SPA |
| dayjs | 1.11 | Manejo de fechas |

### Backend

| Tecnologia | Version | Uso |
|---|---|---|
| NestJS | 10.3 | Framework del servidor |
| Prisma | 6.8+ | ORM y migraciones |
| PostgreSQL | 16 | Base de datos |
| xlsx (SheetJS) | 0.18 | Lectura de archivos Excel |
| ExcelJS | 4.4 | Generacion de archivos Excel (exportacion) |
| Swagger | 7.2 | Documentacion auto de la API |
| Multer | 1.4 | Upload de archivos |
| dayjs | 1.11 | Manejo de fechas |

### Infraestructura

| Componente | Desarrollo | Produccion |
|---|---|---|
| Base de datos | Docker (PostgreSQL 16) | Supabase |
| Frontend | Vite dev server | Vercel |
| Backend | NestJS watch mode | Railway / Render |

---

## 5. Modelo de datos

### Diagrama de relaciones

```
┌─────────────────────┐
│       Client        │
├─────────────────────┤
│ id (UUID, PK)       │
│ codigoOriginal      │
│ nombreOriginal      │
│ nombreNormalizado ◄──┼── UNIQUE (clave de match entre archivos)
│ fechaAlta           │
│ estado (ACTIVO|BAJA)│
│ calle               │
│ createdAt           │
│ updatedAt           │
├─────────────────────┤
│ 1:N → Document      │
│ 1:N → PaymentPeriod │
└──────────┬──────────┘
           │
     ┌─────┴─────────────────────────────┐
     │                                   │
     ▼                                   ▼
┌─────────────────────┐     ┌─────────────────────────┐
│     Document        │     │    PaymentPeriod         │
├─────────────────────┤     ├─────────────────────────┤
│ id (UUID, PK)       │     │ id (UUID, PK)           │
│ clientId (FK)       │     │ clientId (FK)           │
│ tipo (RAMITO|       │     │ documentId (FK)         │
│       FACTURA)      │     │ periodo (Date)          │
│ fechaDocumento      │     │ year (Int)              │
│ numeroDocumento     │     │ month (Int)             │
│ descripcionOriginal │     │ createdAt               │
│ createdAt           │     ├─────────────────────────┤
├─────────────────────┤     │ UNIQUE: clientId +      │
│ 1:N → PaymentPeriod │     │   periodo + documentId  │
└─────────────────────┘     └─────────────────────────┘

┌─────────────────────┐
│     ImportLog       │
├─────────────────────┤
│ id (UUID, PK)       │
│ tipo                │
│ fileName            │
│ totalRows           │
│ validRows           │
│ invalidRows         │
│ newClients          │
│ updatedClients      │
│ errors (JSON)       │
│ status              │
│ executedAt          │
└─────────────────────┘
```

### Detalle de cada tabla

**Client**: Tabla central. Cada cliente se identifica de forma unica por `nombreNormalizado` (resultado de limpiar el nombre original). El campo `estado` puede ser `ACTIVO` o `BAJA`. La `fechaAlta` es fundamental para el calculo de deuda.

**Document**: Representa un ramito (recibo de entrega) o una factura. Se vincula a un cliente por `clientId`. La `descripcionOriginal` contiene texto libre del cual se extraen los periodos de pago.

**PaymentPeriod**: Registra que un cliente tiene un pago cubierto para un mes/año especifico. Se genera automaticamente al importar documentos, parseando la descripcion. La constraint `UNIQUE(clientId, periodo, documentId)` evita duplicados.

**ImportLog**: Registro historico de cada importacion realizada, incluyendo conteos y errores. Es de solo lectura y sirve para auditoria.

---

## 6. Modulos del backend

### 6.1 PrismaModule (`common/prisma/`)

Modulo global que provee el `PrismaService` a toda la aplicacion. El servicio:
- Conecta automaticamente al iniciar (`onModuleInit`).
- Desconecta al destruir (`onModuleDestroy`).
- Provee `executeInTransaction()` para transacciones interactivas con timeout configurable.
- En desarrollo loguea warnings y errores; en produccion solo errores.

### 6.2 ClientsModule (`modules/clients/`)

**Responsabilidad**: CRUD de clientes y **calculo central de deuda**.

**Endpoints**:
- `GET /api/clients` — Lista paginada con filtros (nombre, estado, nivel de deuda).
- `GET /api/clients/stats` — Estadisticas agregadas de deuda.
- `GET /api/clients/:id` — Detalle completo con documentos y periodos.

**Logica clave** — `calculateDebt()`:
1. Solo calcula para clientes ACTIVOS con fecha de alta.
2. Genera lista de meses obligatorios desde `fechaAlta` hasta el mes actual.
3. Si el dia actual es <= 15, el mes actual NO se incluye como obligatorio.
4. Compara contra los periodos pagados (PaymentPeriod).
5. La diferencia = meses adeudados.
6. Si la deuda supera 2 meses → `requiereCorte = true`.

**Nota sobre paginacion**: Cuando se filtra por `debtStatus`, el sistema carga TODOS los clientes activos en memoria, calcula la deuda de cada uno, filtra, y pagina en memoria. Esto es necesario porque la deuda es un calculo derivado, no un campo almacenado.

### 6.3 ImportModule (`modules/import/`)

**Responsabilidad**: Carga de archivos Excel.

**Endpoints**:
- `POST /api/import/preview/:tipo` — Analiza el archivo sin ejecutar cambios.
- `POST /api/import/clientes` — Importa clientes (NO pisa existentes).
- `POST /api/import/ramitos` — Importa ramitos (SI pisa todo el tipo).
- `POST /api/import/facturas` — Importa facturas (SI pisa todo el tipo).
- `GET /api/import/logs` — Historial de importaciones.

**Restricciones**:
- Archivos maximo 10MB.
- Solo acepta `.xlsx` y `.xls`.
- Las importaciones se ejecutan dentro de transacciones (todo o nada).
- Timeouts: 120s para clientes, 180s para documentos.

**Flujo de importacion de clientes**:
1. Parsea el Excel con `parseExcelBuffer`.
2. Para cada fila, normaliza el nombre con `normalizeName`.
3. Si el nombre normalizado ya existe en la DB → no crea duplicado.
4. Si el nombre original indica baja (ej: "PEREZ JUAN DE BAJA") → actualiza estado a BAJA.
5. Si es nuevo → crea el cliente con sus datos.

**Flujo de importacion de ramitos/facturas**:
1. BORRA todos los registros del tipo (PaymentPeriod primero, luego Document).
2. Para cada fila, normaliza el nombre y busca el cliente.
3. Si el cliente no existe → error (se salta la fila).
4. Crea el Document y extrae periodos de la descripcion con `parsePeriodsFromDescription`.
5. Crea los PaymentPeriod correspondientes.

### 6.4 DashboardModule (`modules/dashboard/`)

**Responsabilidad**: Metricas agregadas.

**Endpoints**:
- `GET /api/dashboard` — Retorna resumen (totales), distribucion de deuda, conteo de documentos y ultimas importaciones.
- `GET /api/dashboard/corte` — Lista de clientes activos que requieren corte, ordenados por deuda descendente.

### 6.5 ExportModule (`modules/export/`)

**Responsabilidad**: Generacion de archivos Excel descargables con ExcelJS.

**Endpoints**:
- `GET /api/export/corte` — Excel con clientes para corte (header rojo, filas con >6 meses resaltadas).
- `GET /api/export/clients` — Excel con todos los clientes y su situacion de deuda (colores por nivel).
- `GET /api/export/resumen` — Excel con 2 hojas: resumen de indicadores + listado de corte.

Todos los Excel incluyen:
- Fila de header con estilos y colores.
- Filtros automaticos.
- Fila de resumen al final.
- Nombre de archivo con fecha (`corte_2026-02-23.xlsx`).

### 6.6 DocumentsModule (`modules/documents/`)

**Responsabilidad**: Consulta de documentos (ramitos y facturas).

**Endpoints**:
- `GET /api/documents` — Lista paginada, filtrable por tipo y clientId. Incluye el nombre del cliente y los periodos de pago.
- `GET /api/documents/:id` — Detalle de un documento con cliente y periodos.

---

## 7. Paginas del frontend

### 7.1 Dashboard (`DashboardPage.tsx`)

Vista principal con:
- **3 cards de resumen**: Total clientes, activos, de baja.
- **4 cards de deuda**: Al dia, 1 mes, 2 meses, +2 meses (corte).
- **Pie chart (Recharts)**: Distribucion visual de la deuda.
- **Indicadores clave**: Tasa de morosidad, clientes para corte, conteo de documentos.
- **Tabla de ultimas importaciones**: Tipo, archivo, filas, estado, fecha.

### 7.2 Clientes (`ClientsPage.tsx`)

Tabla completa de clientes con:
- **Buscador** por nombre (case-insensitive).
- **Filtro por estado**: Activo / Baja.
- **Filtro por nivel de deuda**: Al dia / 1 mes / 2 meses / +2 meses.
- **Paginacion** server-side (20 por pagina).
- **Boton "Exportar Excel"** que descarga todos los clientes con su deuda.
- **Drawer de detalle** al hacer click en el ojo de un cliente:
  - Informacion basica (nombre, codigo, estado, fecha alta, calle).
  - Resumen de deuda (meses deuda, pagados, obligatorios).
  - Badges de cobertura mensual (ultimos 12 meses, verde/rojo).
  - Timeline de documentos con sus periodos.

### 7.3 Importaciones (`ImportPage.tsx`)

Interfaz de 4 tabs:
- **Clientes / Ramitos / Facturas**: Cada tab tiene:
  - Alerta con la regla de importacion (pisa / no pisa).
  - Area de drag-and-drop para subir el Excel.
  - Preview automatico al subir: headers, datos de muestra, conteo de validos/invalidos, errores.
  - Boton de confirmacion con modal (destructivo para ramitos/facturas).
  - Resultado post-importacion con detalles.
- **Historial**: Tabla con todas las importaciones realizadas.

### 7.4 Documentos (`DocumentsPage.tsx`)

Tabla paginada de todos los documentos con:
- **Filtro por tipo**: Ramito / Factura.
- Columnas: Cliente, tipo, nro. documento, fecha, descripcion, periodos extraidos.

### 7.5 Para Corte (`CortePage.tsx`)

Vista especializada con:
- **3 cards**: Total para corte, promedio meses deuda, maxima deuda.
- **Alerta roja** explicativa.
- **Tabla** con clientes que deben ser cortados, ordenados por deuda.
- **2 botones de exportacion**: Excel de corte y resumen general.

---

## 8. API Endpoints

### Health

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/health` | Health check: `{ status: "ok", timestamp }` |

### Dashboard

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/dashboard` | Metricas generales (resumen, deuda, documentos, imports) |
| GET | `/api/dashboard/corte` | Lista de clientes que requieren corte |

### Clients

| Metodo | Ruta | Query params | Descripcion |
|---|---|---|---|
| GET | `/api/clients` | `search`, `estado`, `debtStatus`, `page`, `limit` | Lista paginada con filtros y deuda calculada |
| GET | `/api/clients/stats` | — | Estadisticas de deuda agregadas |
| GET | `/api/clients/:id` | — | Detalle con documentos y periodos |

Valores de `debtStatus`: `AL_DIA`, `1_MES`, `2_MESES`, `MAS_2_MESES`
Valores de `estado`: `ACTIVO`, `BAJA`

### Import

| Metodo | Ruta | Body | Descripcion |
|---|---|---|---|
| POST | `/api/import/preview/clientes` | `multipart/form-data` (file) | Preview de archivo de clientes |
| POST | `/api/import/preview/ramitos` | `multipart/form-data` (file) | Preview de archivo de ramitos |
| POST | `/api/import/preview/facturas` | `multipart/form-data` (file) | Preview de archivo de facturas |
| POST | `/api/import/clientes` | `multipart/form-data` (file) | Importar clientes (NO pisa) |
| POST | `/api/import/ramitos` | `multipart/form-data` (file) | Importar ramitos (SI pisa) |
| POST | `/api/import/facturas` | `multipart/form-data` (file) | Importar facturas (SI pisa) |
| GET | `/api/import/logs` | `limit` (default 20) | Historial de importaciones |

### Documents

| Metodo | Ruta | Query params | Descripcion |
|---|---|---|---|
| GET | `/api/documents` | `tipo`, `clientId`, `page`, `limit` | Lista paginada de documentos |
| GET | `/api/documents/:id` | — | Detalle de un documento |

### Export

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/export/corte` | Descarga Excel de clientes para corte |
| GET | `/api/export/clients` | Descarga Excel de todos los clientes con deuda |
| GET | `/api/export/resumen` | Descarga Excel resumen (2 hojas) |

### Swagger

La documentacion interactiva de la API esta disponible en `http://localhost:3000/api/docs`.

---

## 9. Reglas de negocio

### 9.1 Normalizacion de nombres

Los archivos Excel del sistema de gestion original contienen nombres con ruido (anotaciones del operador, estados de servicio, fechas, etc.). El normalizador (`normalize-name.util.ts`) limpia el nombre para poder hacer match entre los diferentes archivos.

**Que se elimina del nombre:**
- Indicadores de baja: "DE BAJA", "DADO DE BAJA", "DADA DE BAJA", "DIO DE BAJA", "EN BAJA"
- Tipos de servicio: "SOLO INTERNET", "CABLE +INTERNET", "INTERNET"
- Megas: "6megas", "4 megas", "100Megas"
- Admin labels: "NO USAR", "PENDIENTE EL EQUIPO", "JUBILADA"
- Truncamiento (todo lo que sigue se descarta): "RETIRADO...", "CORTADO...", "SALDO...", "DEUDA...", "PROMO...", "A PARTIR DE..."
- Fechas: "21-02-24", "25/4/25"
- Palabras de 1 caracter (excepto Y, O)

**Ejemplo**: `"ZAPATA ROSENDO subio velocidad 6 megas a partir de dia 25/4/25"` → `"ZAPATA ROSENDO"`

**Deteccion de baja**: El normalizador tambien detecta si el nombre indica baja, lo cual se usa para marcar el estado del cliente como BAJA durante la importacion.

### 9.2 Calculo de deuda

Esta es la regla central del sistema:

```
Meses obligatorios = desde fecha_alta hasta mes actual
                     (si dia <= 15, el mes actual NO cuenta)

Meses pagados = PaymentPeriods registrados para el cliente

Meses adeudados = meses obligatorios - meses pagados

Requiere corte = meses adeudados > 2
```

**Puntos importantes:**
- Solo se calcula para clientes con estado `ACTIVO`.
- Si un cliente no tiene `fechaAlta`, la deuda es 0.
- El umbral del dia 15 existe para dar margen: si estamos a dia 10, no se cuenta el mes actual como adeudado todavia.
- La regla de corte es estricta: **mas de 2 meses** (no 2, sino 3+).

### 9.3 Importacion de clientes (NO pisa)

- Si un cliente ya existe por `nombreNormalizado` → **no se crea duplicado**.
- Si el nombre indica baja y el cliente existente esta ACTIVO → se actualiza a BAJA.
- Si es nuevo → se crea con todos sus datos.
- Se ejecuta en una unica transaccion (si falla, no se crea nada).

### 9.4 Importacion de ramitos/facturas (SI pisa)

- **ELIMINA TODOS** los registros del tipo (RAMITO o FACTURA) antes de importar.
- Elimina primero PaymentPeriods y luego Documents (por FK).
- Requiere que los clientes ya existan en la DB (por eso se importan primero).
- El match se hace por nombre normalizado.
- Extrae periodos de la descripcion y los registra como PaymentPeriods.
- Se ejecuta en una unica transaccion.

### 9.5 Orden obligatorio de importacion

```
1. clientes.xlsx  →  Crea la tabla de clientes
2. pedidos.xlsx   →  Carga ramitos (necesita clientes)
3. ventas_.xlsx   →  Carga facturas (necesita clientes)
```

Si se importan ramitos o facturas sin haber importado clientes primero, las filas fallaran por "cliente no encontrado".

---

## 10. Flujo de datos e importacion

### Flujo completo paso a paso

```
[Excel: clientes.xlsx]
     │
     ▼
parseExcelBuffer()      → Lectura del archivo con SheetJS
     │
     ▼
normalizeName()         → Limpieza del nombre: "PEREZ JUAN DE BAJA" → "PEREZ JUAN"
     │                                         indicaBaja = true
     ▼
findUnique(nombre)      → Busca si ya existe
     │
     ├── Existe + indicaBaja  → Actualiza estado a BAJA
     ├── Existe + no baja     → Skip (no duplica)
     └── No existe            → Crea nuevo Client
     │
     ▼
ImportLog                → Registra la operacion


[Excel: pedidos.xlsx / ventas_.xlsx]
     │
     ▼
parseExcelBuffer()       → Lectura del archivo
     │
     ▼
DELETE ALL tipo           → Borra todos los documents/periods del tipo
     │
     ▼
normalizeName()          → Normaliza nombre del comprador
     │
     ▼
findUnique(nombre)       → Busca el cliente (debe existir)
     │
     ▼
Document.create()        → Crea el documento (fecha, nro, descripcion)
     │
     ▼
parsePeriodsFromDescription()  → "TvCable Enero26 del 1 al 15" → {year:2026, month:1}
     │
     ▼
PaymentPeriod.create()   → Registra el periodo de pago
     │
     ▼
ImportLog                 → Registra la operacion
```

### Mapeo de columnas Excel

El sistema busca columnas probando multiples nombres (case-insensitive):

| Dato | Nombres aceptados |
|---|---|
| Codigo | `cod_cli`, `codigo`, `cod`, `id`, `codigo_cliente` |
| Nombre | `nombre`, `nombre_cliente`, `cliente`, `name` |
| Fecha alta | `fecalta`, `fecha_alta`, `alta`, `fecha_ingreso` |
| Calle | `calle`, `direccion`, `domicilio`, `dir` |
| Fecha doc | `fecha`, `fecha_documento`, `date` |
| Nro doc | `nro_comp`, `comprob`, `comprobante`, `numero`, `nro`, `numero_documento` |
| Descripcion | `descrip`, `descripcion`, `desc`, `detalle`, `concepto`, `observacion` |

---

## 11. Utilidades y parsers

### 11.1 normalize-name.util.ts

**Entrada**: Nombre crudo del Excel (ej: `"GONZALEZ ANA CABLE +INTERNET 6megas DE BAJA"`)
**Salida**: `{ nombreNormalizado: "GONZALEZ ANA", indicaBaja: true, nombreOriginal: "GONZALEZ ANA CABLE +INTERNET 6megas DE BAJA" }`

**Proceso**:
1. Detecta si indica baja (antes de limpiar).
2. Convierte a mayusculas.
3. Aplica patrones de limpieza en orden (los mas especificos primero).
4. Elimina todo excepto letras Unicode y espacios.
5. Colapsa espacios multiples.
6. Elimina palabras de 1 caracter (excepto "Y" y "O").

### 11.2 parse-periods.util.ts

**Entrada**: Descripcion de un documento (ej: `"TvCable Enero26 del 1 al 15"`)
**Salida**: `[{ year: 2026, month: 1, periodo: Date(2026-01-01) }]`

**Patrones soportados**:
- `{MesNombre}{Año2digitos}`: "Diciembre25" → 2025-12
- `{MesNombre} {Año4digitos}`: "Enero 2026" → 2026-01
- Acepta variaciones: "SETIEMBRE" = "SEPTIEMBRE"
- Rango valido de años: 2020–2030
- Deduplica y ordena por fecha

**Descripciones ignoradas** (no contienen periodo):
- "SUSCRIPCION DE TV CABLE"
- "RECONEXION INTERNET"
- "Punto adicional"
- "Traslado"
- "Cambio de Modem"
- "INSTALACION"

### 11.3 excel-parser.util.ts

**Entrada**: Buffer del archivo Excel
**Salida**: `{ data: T[], headers: string[], totalRows: number, errors: [] }`

**Configuracion clave**:
- `cellDates: true` — Parsea fechas como objetos JS Date (no strings dependientes del locale).
- `raw: true` — Mantiene los valores crudos para evitar formateos impredecibles.

---

## 12. Scripts auxiliares

### 12.1 seed.ts

Crea datos de prueba para desarrollo. Ejecutar con:
```bash
cd apps/backend && npx ts-node scripts/seed.ts
```

Crea 4 clientes con diferentes situaciones:
- PEREZ JUAN CARLOS: al dia (pagado hasta dic 2025)
- GONZALEZ MARIA LAURA: con deuda (pagado hasta oct 2024)
- RODRIGUEZ CARLOS: dado de baja
- MARTINEZ ANA: con deuda moderada (pagado hasta sep 2025)

**Atencion**: El seed borra TODOS los datos existentes antes de crear los nuevos.

### 12.2 validate-data.ts

Valida los parsers contra datos hardcodeados y archivos Excel reales (si estan disponibles). Ejecutar con:
```bash
cd apps/backend && npx ts-node scripts/validate-data.ts
```

Valida:
1. Normalizacion de nombres (13 test cases).
2. Parser de periodos (8 test cases).
3. Cross-match: verifica que los nombres de pedidos/ventas matcheen con los clientes.

No requiere base de datos.

---

## 13. Configuracion y entorno

### Variables de entorno (backend)

| Variable | Descripcion | Ejemplo (desarrollo) |
|---|---|---|
| `DATABASE_URL` | Connection string de PostgreSQL | `postgresql://cable_user:cable_pass@localhost:5432/cable_tracking?schema=public` |
| `PORT` | Puerto del backend | `3000` |
| `NODE_ENV` | Entorno | `development` |
| `FRONTEND_URL` | URL del frontend (para CORS) | `http://localhost:5174` |

### Variables de entorno (frontend)

| Variable | Descripcion | Ejemplo |
|---|---|---|
| `VITE_API_URL` | URL base de la API (solo produccion) | `https://tu-api.railway.app/api` |

En desarrollo NO se necesita `VITE_API_URL` porque Vite proxea `/api` al backend.

### Docker Compose

El `docker-compose.yml` levanta un PostgreSQL 16 para desarrollo:
- Usuario: `cable_user`
- Password: `cable_pass`
- Base de datos: `cable_tracking`
- Puerto: `5432`
- Volumen persistente: `pgdata`

---

## 14. Setup del proyecto

### Requisitos previos
- Node.js >= 18
- pnpm >= 8
- Docker Desktop (para PostgreSQL local)

### Paso a paso

```bash
# 1. Levantar PostgreSQL
docker compose up -d

# 2. Crear archivo de entorno
cp apps/backend/.env.example apps/backend/.env

# 3. Instalar dependencias
pnpm install

# 4. Generar Prisma client
cd apps/backend && npx prisma generate

# 5. Ejecutar migraciones
npx prisma migrate dev --name init

# 6. (Opcional) Cargar datos de prueba
npx ts-node scripts/seed.ts
cd ../..

# 7. Levantar ambos servidores
pnpm dev
```

### URLs en desarrollo

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5174 |
| Backend API | http://localhost:3000/api |
| Swagger docs | http://localhost:3000/api/docs |
| Health check | http://localhost:3000/api/health |

---

## 15. Deploy a produccion

### Frontend → Vercel

```bash
# En Vercel:
# - Framework: Vite
# - Root directory: apps/frontend
# - Build command: vite build
# - Output: dist
# - Env: VITE_API_URL=https://tu-api.railway.app/api
```

### Backend → Railway / Render

```bash
# Build: nest build
# Start: node dist/main
# Env vars:
#   DATABASE_URL=postgresql://...  (de Supabase)
#   FRONTEND_URL=https://tu-app.vercel.app
#   PORT=3000
#   NODE_ENV=production
```

### Base de datos → Supabase

1. Crear proyecto en Supabase.
2. Copiar la connection string al `DATABASE_URL` del backend.
3. Ejecutar migraciones: `npx prisma migrate deploy`

---

## 16. Buenas practicas y convenciones

### Generales
- **Monorepo con workspaces**: Cada app es independiente, con su propio `package.json` y dependencias.
- **TypeScript estricto**: Todo el codigo esta tipado.
- **Modulos encapsulados**: Cada modulo de NestJS tiene su controller, service y module.
- **Responsabilidad unica**: Los controllers solo manejan HTTP, los services manejan logica.

### Codigo backend
- **Transacciones**: Toda operacion que modifica multiples tablas usa `executeInTransaction()`.
- **Timeouts generosos**: Las importaciones masivas tienen timeouts de 120-180 segundos.
- **Mapeo de columnas flexible**: El sistema busca multiples nombres de columna para tolerar variaciones en los Excel.
- **Logging estructurado**: Se usa el Logger de NestJS con contexto por clase.
- **Global exception filter**: Todas las excepciones se capturan y devuelven en formato consistente.
- **Validacion de entrada**: ValidationPipe global con whitelist y transformacion automatica.

### Codigo frontend
- **Componentes funcionales**: Todo usa hooks (useState, useEffect, useCallback).
- **Ant Design como sistema de UI**: Se respetan los patrones de Ant Design (Table, Card, Form, Modal).
- **Servicio API centralizado**: Todas las llamadas HTTP pasan por `services/api.ts`.
- **Tipos compartidos**: Las interfaces estan en `types/index.ts`.
- **Feedback al usuario**: Se usa `message.success/error` y `Modal.confirm` para acciones criticas.

### Base de datos
- **UUIDs como primary keys**: Evita colisiones en ambientes distribuidos.
- **Indices estrategicos**: En campos frecuentes de busqueda (estado, nombreNormalizado, clientId, tipo).
- **Cascading deletes**: Si se borra un cliente, se borran sus documentos y periodos.
- **Column mapping**: Los campos usan camelCase en TypeScript y snake_case en la base de datos.

### Importacion
- **Preview antes de ejecutar**: El usuario siempre puede ver que contiene el archivo antes de importar.
- **Confirmacion para acciones destructivas**: Modal de confirmacion para ramitos/facturas.
- **Logging de importaciones**: Cada importacion queda registrada en ImportLog.

---

## 17. Consideraciones de rendimiento

### Potenciales cuellos de botella

1. **Filtro por deuda**: Cuando se filtra clientes por `debtStatus` (AL_DIA, 1_MES, etc.), el backend carga TODOS los clientes activos en memoria, calcula la deuda de cada uno, y filtra. Con miles de clientes esto puede ser lento.

2. **Dashboard y estadisticas**: `getDebtStats()` y `getClientesParaCorte()` tambien cargan todos los clientes activos. El calculo de deuda es O(n) donde n es la cantidad de meses obligatorios por cliente.

3. **Exportacion**: Los endpoints de export generan el Excel en memoria cargando todos los clientes. Para bases de datos muy grandes, esto puede consumir mucha RAM.

### Mitigaciones existentes

- Paginacion server-side para el listado normal de clientes (sin filtro de deuda).
- Indices en campos frecuentes de consulta.
- Transacciones con timeout para evitar locks eternos.
- Set O(1) para busqueda de periodos pagados (`paidSet`).

### Recomendaciones para escalar

- Agregar campo `deuda_calculada` en la tabla Client y recalcular periodicamente (cron job).
- Implementar cache (Redis) para el dashboard.
- Para importaciones muy grandes, considerar procesamiento en batch con queue (Bull/BullMQ).

---

## 18. Seguridad

### Estado actual

- **No hay autenticacion ni autorizacion**. Cualquier persona con acceso a la URL puede ver, importar y exportar datos.
- CORS esta configurado para aceptar solo el `FRONTEND_URL`.
- ValidationPipe con `whitelist: true` y `forbidNonWhitelisted: true` previene inyeccion de campos extra.
- Multer limita el tamano de archivos a 10MB y filtra por extension.
- Las transacciones protegen la integridad de los datos.

### Recomendaciones

- Implementar autenticacion (JWT o session-based) antes de exponer a internet.
- Agregar rate limiting en los endpoints de importacion.
- Agregar HTTPS obligatorio en produccion.
- Considerar roles (admin / visor) para separar quien puede importar y quien solo puede consultar.

---

## 19. Troubleshooting

### La importacion de ramitos/facturas da "Cliente no encontrado"

Los clientes deben importarse PRIMERO. El sistema hace match por nombre normalizado, asi que el nombre en el archivo de ramitos/facturas debe coincidir con el del archivo de clientes una vez normalizado.

### La deuda no coincide con lo esperado

- Verificar la `fechaAlta` del cliente (es el inicio del calculo).
- El mes actual solo cuenta si el dia es mayor a 15.
- Los periodos se extraen de la descripcion del documento. Si la descripcion no sigue el formato esperado (ej: "Diciembre25"), el periodo no se registra.

### El preview muestra "0 filas validas"

El archivo Excel debe tener una columna `nombre` (o similar). Si las columnas tienen nombres diferentes, el sistema no las reconoce. Verificar los nombres de columna contra la tabla de mapeo en la seccion 10.

### Error de conexion a la base de datos

- Verificar que Docker este corriendo: `docker ps`
- Verificar que el contenedor este activo: `docker compose up -d`
- Verificar el `DATABASE_URL` en `apps/backend/.env`

### El frontend no se conecta al backend

- En desarrollo, Vite proxea `/api` al backend. Verificar que ambos servidores esten corriendo.
- En produccion, verificar `VITE_API_URL` y que CORS permita el dominio del frontend.
