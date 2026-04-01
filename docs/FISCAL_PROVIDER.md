# Guia de Proveedores Fiscales

## Como funciona

El sistema usa un patron Provider para la facturacion fiscal:
- **MockFiscalProvider** (default): genera RECIBO_X internos sin valor fiscal
- **TusFacturasProvider**: emite facturas electronicas reales via ARCA (ex-AFIP)

El campo `Client.tipoComprobante` determina si un cliente recibe factura fiscal:
- `RAMITO` (default): solo registra el pago, sin comprobante fiscal
- `FACTURA`: al registrar pago se emite factura electronica automaticamente

## Checklist para conectar TusFacturas

### Paso 1 — Preparar datos de la empresa
- [ ] CUIT de la empresa
- [ ] Razon social (exacta como figura en ARCA)
- [ ] Condicion fiscal (Responsable Inscripto o Monotributista)
- [ ] Punto de venta habilitado en ARCA

### Paso 2 — Crear cuenta en TusFacturas
- [ ] Registrarse en tusfacturas.app (1 mes gratis)
- [ ] Ir a Menu → Mi espacio de trabajo → Puntos de venta
- [ ] Configurar el punto de venta con el CUIT de la empresa
- [ ] Obtener las 3 credenciales: usertoken, apikey, apitoken

### Paso 3 — Configurar en la app
- [ ] Ir a Configuracion Fiscal en la app
- [ ] Cambiar proveedor a "TusFacturas"
- [ ] Cargar usertoken, apikey y apitoken
- [ ] Click en "Probar conexion" → debe mostrar exito

### Paso 4 — Activar por cliente
- [ ] Abrir el drawer de cada cliente que quiera factura oficial
- [ ] Verificar que tenga CUIT/DNI cargado en datos fiscales
- [ ] Usar PATCH /clients/:id/comprobante-config para cambiar a FACTURA

## Implementar un nuevo provider

1. Crear clase que implemente `IFiscalProvider` en `src/modules/fiscal/providers/`
2. Implementar: `emitirComprobante()`, `anularComprobante()`, `getUltimoNumero()`
3. En `FiscalService.getProvider()`, agregar case para el nuevo provider
4. Cambiar `providerName` en EmpresaConfig

## Mapeo de campos ARCA

| Campo sistema | Campo ARCA | Nota |
|---|---|---|
| TipoComprobante.FACTURA_A | CbteTipo = 1 | RI → RI |
| TipoComprobante.FACTURA_B | CbteTipo = 6 | RI → CF/Mono |
| TipoComprobante.FACTURA_C | CbteTipo = 11 | Mono → cualquiera |
| concepto | Concepto | Siempre 2 (Servicios) |
| fechaServDesde | FchServDesde | Primer dia del periodo |
| fechaServHasta | FchServHasta | Ultimo dia del periodo |
| fechaVtoPago | FchVtoPago | Fecha limite de pago |

## Campos ARCA obligatorios (servicios)

Cuando `concepto = 2` (servicios), ARCA exige:
- fechaServDesde y fechaServHasta (periodo facturado)
- fechaVtoPago (fecha limite de pago)
Estos campos se completan automaticamente desde el PaymentPeriod.

## Anulaciones

TusFacturas no tiene endpoint de anulacion de CAE. Para anular fiscalmente se debe emitir Nota de Credito manualmente en tusfacturas.app.
El sistema marca el comprobante como ANULADO internamente.

## Seguridad

- Credenciales TF NO se retornan en GET /fiscal/config (solo flags booleanos)
- En produccion usar variables de entorno en vez de la DB
