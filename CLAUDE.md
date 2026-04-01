# Cable Tracking - Contexto para AI

## Que es esto

Sistema web para gestionar clientes de una empresa de cable. Controla deuda mensual y determina corte de servicio. Se alimenta de archivos Excel que exporta el sistema de gestion existente.

## Arquitectura

Monorepo pnpm con 2 apps:

```
apps/backend/   → NestJS 10 + Prisma 5 + PostgreSQL 16
apps/frontend/  → React 18 + TypeScript + Vite + Ant Design 5
```

Comunicacion: REST API. En dev, Vite proxea `/api` a `localhost:3000`. Prefix global de backend: `/api`.

## Modelo de datos (4 tablas)

```
Client (id, codCli[UNIQUE], nombreOriginal, nombreNormalizado, fechaAlta, estado[ACTIVO|BAJA], calle)
  └─ Document (id, clientId[FK], codCli, tipo[RAMITO|FACTURA], fechaDocumento, numeroDocumento, descripcionOriginal)
       └─ PaymentPeriod (id, clientId[FK], codCli, documentId[FK], periodo, year, month) [UNIQUE: clientId+periodo+documentId]
ImportLog (id, tipo, fileName, totalRows, validRows, invalidRows, newClients, updatedClients, errors[JSON], status, executedAt)
```

- PKs: UUID. Cascading deletes en Client→Document→PaymentPeriod.
- `codCli` es la clave de match entre archivos Excel. Es UNIQUE en Client y se propaga a Document y PaymentPeriod.
- `nombreNormalizado` se mantiene como dato informativo pero ya no es UNIQUE ni se usa para match.
- `PaymentPeriod` registra que un cliente tiene cubierto un mes. Se extrae parseando la descripcion del Document.

## Modulos del backend

```
src/
├── main.ts                          → Bootstrap: CORS, Swagger(/api/docs), ValidationPipe(transform:true, enableImplicitConversion:true), GlobalExceptionFilter
├── app.module.ts                    → Root module + GET /api/health
├── common/
│   ├── prisma/prisma.service.ts     → PrismaClient + executeInTransaction(fn, {timeout})
│   ├── utils/normalize-name.util.ts → normalizeName(raw) → {nombreNormalizado, indicaBaja, nombreOriginal}
│   ├── utils/parse-periods.util.ts  → parsePeriodsFromDescription(desc) → [{year, month, periodo:Date}]
│   └── utils/excel-parser.util.ts   → parseExcelBuffer(buffer) → {data[], headers[], totalRows, errors[]}
└── modules/
    ├── clients/   → GET /clients(?search,estado,debtStatus,page,limit) | GET /clients/stats | GET /clients/:id
    ├── import/    → POST /import/preview/:tipo | POST /import/clientes|ramitos|facturas | GET /import/logs
    ├── dashboard/ → GET /dashboard | GET /dashboard/corte
    ├── documents/ → GET /documents(?tipo,clientId,page,limit) | GET /documents/:id
    └── export/    → GET /export/corte|clients|resumen (descargas Excel)
```

## Paginas del frontend

```
src/
├── App.tsx              → Layout con Sider + rutas
├── pages/
│   ├── DashboardPage    → Metricas, pie chart (Recharts), ultimas importaciones
│   ├── ClientsPage      → Tabla paginada + filtros + Drawer de detalle con deuda y documentos
│   ├── ImportPage       → Tabs: upload Excel por tipo (preview → confirmar) + historial
│   ├── DocumentsPage    → Tabla paginada de ramitos/facturas con periodos
│   └── CortePage        → Clientes con >1 mes deuda + export Excel (client-side con xlsx)
├── services/api.ts      → Cliente axios centralizado (baseURL: /api, timeout: 120s)
└── types/index.ts       → Interfaces TypeScript compartidas
```

## Regla central de deuda

```
calculateDebt() en clients.service.ts

1. Solo aplica si estado=ACTIVO y fechaAlta existe
2. SI tiene pagos: deuda = meses desde ultimoPago+1 hasta mes actual
   (huecos anteriores al ultimo pago se PERDONAN)
3. SI no tiene pagos: deuda = meses desde fechaAlta hasta mes actual
4. Mes actual solo cuenta si dia > 15
5. requiereCorte = mesesAdeudados.length > 1
```

La deuda NO se almacena. Se calcula en cada request. Los mesesObligatorios siguen mostrando el rango completo desde fechaAlta (para referencia visual), pero los mesesAdeudados solo incluyen los posteriores al ultimo pago.

## Flujo de importacion

**Orden obligatorio**: clientes → ramitos → facturas (FK dependency).

**Clientes (NO pisa)**: lee `cod_cli` del Excel → si existe por código, skip (o actualiza a BAJA si indica baja) → si es nuevo, crea. Transaccion 120s.

**Ramitos/Facturas (SI pisa)**: DELETE ALL del tipo → carga mapa de clientes (1 query) → valida y recolecta datos → batch insert documentos (createMany en chunks de 500) → batch insert períodos (createMany con skipDuplicates). Transaccion 180s.

**Mapeo de columnas** (busca multiples nombres, case-insensitive):
- codigo: `cod_cli`, `codigo`, `cod`, `id`, `codigo_cliente`
- nombre: `nombre`, `nombre_cliente`, `cliente`, `name`
- fecha alta: `fecalta`, `fecha_alta`, `alta`
- descripcion: `descrip`, `descripcion`, `desc`, `detalle`
- nro doc: `nro_comp`, `comprob`, `comprobante`, `numero`

## Parsers clave

**normalizeName()** - Limpia ruido del nombre (baja, megas, internet, fechas, admin labels). Retorna nombre en MAYUSCULAS y flag `indicaBaja`.

**parsePeriodsFromDescription()** - Extrae "{MesNombre}{Año2o4digitos}" de texto libre. Ej: "TvCable Enero26 del 1 al 15" → [{year:2026, month:1}]. Ignora SUSCRIPCION, RECONEXION, TRASLADO, etc.

**parseExcelBuffer()** - Lee Excel con SheetJS. Config: `cellDates:true, raw:true` (fechas como Date objects, no strings locale-dependientes).

## Patrones y convenciones

### Backend
- Cada modulo: `{name}.module.ts` + `{name}.controller.ts` + `{name}.service.ts`
- Controllers solo manejan HTTP (params, files, responses). Logica en services.
- Transacciones via `this.prisma.executeInTransaction(async (tx) => {...}, {timeout})` — usar `tx` (no `this.prisma`) adentro.
- Query params con tipo explicito: `@Query('page') page: number = 1` (no omitir `: number`, si no Prisma recibe string y falla).
- Upload de archivos: `@UseInterceptors(FileInterceptor('file'))` + `@UploadedFile() file: Express.Multer.File` → `file.buffer`.
- Errores: throw `BadRequestException`, `NotFoundException`, etc. El GlobalExceptionFilter los wrappea en `{success, statusCode, message, timestamp}`.
- Logs: `private readonly logger = new Logger(ClassName.name)`.
- DTOs con `class-validator` en `dto/` dentro de cada modulo. ValidationPipe global los valida automaticamente.
- Swagger: `@ApiTags('Tag')` en controllers.

### Frontend
- Componentes funcionales con hooks. Sin class components.
- Custom hooks en `hooks/` para logica reutilizable (`useClients`, `useDebounce`).
- Estado local con `useState`. Fetch en `useEffect` con `useCallback` para dependencias de filtros.
- Ant Design: `Table` con `pagination` server-side, `Card` para secciones, `Tag` para estados, `message.success/error` para feedback, `Modal.confirm` para acciones destructivas.
- API calls siempre via `services/api.ts`. No usar axios directo en componentes.
- Tipos en `types/index.ts`. Mantener sincronizados con las interfaces del backend.

### Base de datos
- Schema en `apps/backend/prisma/schema.prisma`. Campos camelCase en TS, snake_case en DB (`@@map`).
- Migraciones: `npx prisma migrate dev --name descripcion`. Nunca editar migraciones existentes.
- Despues de cambiar schema: `npx prisma generate` para regenerar el client.

## Workflow para cambios

### Agregar un campo a una tabla existente
1. Modificar `prisma/schema.prisma`
2. `cd apps/backend && npx prisma migrate dev --name add_campo_x`
3. Actualizar el service que usa la tabla
4. Actualizar el controller si el campo se expone via API
5. Actualizar `types/index.ts` en frontend
6. Actualizar el componente que muestra el dato

### Agregar un nuevo endpoint
1. Agregar metodo en el service correspondiente
2. Agregar ruta en el controller (`@Get/@Post` + `@ApiTags/@ApiQuery`)
3. Agregar funcion en `services/api.ts` del frontend
4. Agregar tipo en `types/index.ts` si es necesario
5. Consumir desde el componente

### Agregar un nuevo modulo
1. Crear `modules/{name}/{name}.module.ts`, `.controller.ts`, `.service.ts`
2. Registrar en `app.module.ts` → `imports: [...]`
3. Si necesita Prisma: importar `PrismaModule` en el module o inyectar `PrismaService` (ya es global)
4. Si necesita otro service: importar su module y exportar el service

### Agregar una nueva pagina
1. Crear `pages/{Name}Page.tsx`
2. Agregar ruta en `App.tsx` → `<Route path="/ruta" element={<NuevaPagina />} />`
3. Agregar item en `menuItems` en `App.tsx`
4. Agregar funciones de API en `services/api.ts` si se necesitan endpoints nuevos

### Modificar logica de importacion
- El parser de nombres esta en `normalize-name.util.ts`. Agregar patrones en `NOISE_PATTERNS` (mas especificos primero).
- El parser de periodos esta en `parse-periods.util.ts`. Los patrones regex estan al final del archivo.
- Validar cambios con: `cd apps/backend && npx ts-node scripts/validate-data.ts`
- El mapeo de columnas Excel esta en `import.service.ts` → constante `COL`.

### Modificar regla de deuda
- Toda la logica esta en `clients.service.ts` → `calculateDebt()`.
- La deuda se cuenta desde el ultimo pago (ultimo PaymentPeriod por year/month). Sin pagos, desde fechaAlta.
- Huecos anteriores al ultimo pago se perdonan.
- El umbral de corte es `cantidadDeuda > 1` (2 o mas meses = corte).
- El umbral del dia del mes es `now.date() <= 15`.

## Comandos utiles

```bash
pnpm dev                    # Levantar backend + frontend
pnpm dev:backend            # Solo backend (watch mode)
pnpm dev:frontend           # Solo frontend (Vite)
docker compose up -d        # PostgreSQL local
cd apps/backend
npx prisma studio           # UI visual de la DB
npx prisma migrate dev      # Crear migracion
npx prisma generate         # Regenerar client
npx ts-node scripts/seed.ts          # Datos de prueba
npx ts-node scripts/validate-data.ts # Validar parsers
```

## Puertos

| Servicio | Puerto |
|---|---|
| Frontend (Vite) | 5174 |
| Backend (NestJS) | 3000 |
| PostgreSQL | 5432 |
| Swagger docs | 3000/api/docs |

## Cosas a tener en cuenta

- **No hay auth**. El sistema no tiene autenticacion.
- **No hay tests**. No existen archivos de test.
- **La deuda se calcula en runtime**, no se persiste. Filtrar por `debtStatus` carga todos los clientes activos en memoria.
- **Importar ramitos/facturas es destructivo**: borra todo lo del tipo y reimporta. Siempre importar el archivo completo.
- **El match entre archivos depende del `codCli`** (codigo de cliente). Este campo es UNIQUE y se lee de la columna `cod_cli` del Excel.
- **Cache de dashboard**: las metricas y lista de corte se cachean 1 minuto en memoria. Se invalida automaticamente al importar.
- Los Excel se leen con `raw:true` y `cellDates:true` para evitar problemas de locale con fechas.
- `FRONTEND_URL` en el .env del backend controla CORS. Si cambia el puerto del frontend, actualizar ahi tambien.
