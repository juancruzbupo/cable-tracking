# Guía de Proveedores Fiscales

## Cómo funciona

El sistema usa un patrón Provider para la facturación fiscal. Actualmente funciona con un `MockFiscalProvider` que genera comprobantes internos sin valor fiscal (RECIBO_X). Cuando se elija un proveedor real, solo hay que implementar un nuevo adaptador.

## Implementar un nuevo provider

1. Crear clase en `src/modules/fiscal/providers/` que implemente `IFiscalProvider`:

```typescript
export class TusFacturasProvider implements IFiscalProvider {
  readonly name = 'tusFacturas';
  async emitirComprobante(input: ComprobanteInput): Promise<ComprobanteOutput> { ... }
  async anularComprobante(cae: string): Promise<boolean> { ... }
  async getUltimoNumero(puntoVenta: number, tipo: TipoComprobante): Promise<number> { ... }
}
```

2. Registrar en `FiscalModule` como provider
3. En `FiscalService`, seleccionar el provider según `EmpresaConfig.providerName`
4. Cambiar `providerName` a `"tusFacturas"` en la config de la empresa

## Checklist para conectar TusFacturas

- [ ] Crear cuenta en tusFacturas.app
- [ ] Obtener API key de producción
- [ ] Configurar CUIT y punto de venta en su panel
- [ ] Hacer prueba en ambiente de homologación
- [ ] Implementar `TusFacturasProvider`
- [ ] Cambiar providerName a "tusFacturas" en EmpresaConfig
- [ ] Verificar primer comprobante en AFIP

## Mapeo de campos AFIP

| Campo sistema | Campo AFIP |
|---|---|
| TipoComprobante.FACTURA_A | CbteTipo = 1 |
| TipoComprobante.FACTURA_B | CbteTipo = 6 |
| TipoComprobante.FACTURA_C | CbteTipo = 11 |
| puntoVenta | PtoVta |
| numero | CbteDesde / CbteHasta |
| emisorCuit | Auth.Cuit |
| receptorDoc | DocNro |
| total | ImpTotal |
| iva | ImpIVA |

## Campos ARCA obligatorios (servicios)

| Campo sistema | Campo ARCA | Nota |
|---|---|---|
| concepto | Concepto | Siempre 2 (Servicios) |
| fechaServDesde | FchServDesde | Primer dia del periodo facturado |
| fechaServHasta | FchServHasta | Ultimo dia del periodo facturado |
| fechaVtoPago | FchVtoPago | Fecha limite de pago |
| formaPago | - | CONTADO / CUENTA_CORRIENTE |

Estos campos son obligatorios en ARCA cuando `concepto = 2` (servicios).
El MockProvider los ignora pero deben estar completos para el provider real.

## Seguridad

- `providerApiKey` NO se retorna en GET /api/fiscal/config (se muestra ofuscada)
- En producción, usar variable de entorno en vez de guardarla en la DB
