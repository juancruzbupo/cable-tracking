# Funcionalidades del Sistema

## Resumen por fase

| Fase | Feature | Estado |
|---|---|---|
| Base | Importacion Excel, calculo deuda, dashboard, export | Implementado |
| 1 | Autenticacion JWT con roles (ADMIN/OPERADOR/VISOR) | Implementado |
| 2 | Suscripciones CABLE/INTERNET independientes | Implementado |
| 3 | Operacion manual (alta, baja, pagos, notas, historial) | Implementado |
| 4 | Planes de servicio, cron nocturno, PDFs, reportes cobranza | Implementado |
| 5 | Sistema de promociones (4 tipos, 2 scopes) | Implementado |
| 6 | Facturacion fiscal con provider pattern | Implementado |
| 7 | Equipos, tickets de soporte, WhatsApp | Implementado |

---

## Gestion de clientes

- **Importar clientes desde Excel**: lee `cod_cli`, normaliza nombre, detecta bajas. No pisa existentes.
- **Alta manual de cliente**: nombre, codigo, calle, seleccion de servicios (CABLE/INTERNET) con fecha de alta.
- **Baja logica**: cambia estado a BAJA en cliente y todas sus suscripciones. Reversible por ADMIN.
- **Busqueda**: por nombre o codigo, con filtros por estado y nivel de deuda.
- **Datos fiscales**: CUIT/DNI, condicion fiscal, razon social, telefono, email.
- **Notas**: texto libre vinculado al cliente, con autor y fecha. Solo ADMIN puede borrar.
- **Historial**: timeline de todas las acciones realizadas sobre el cliente (audit log).

## Suscripciones

- Cada cliente puede tener **CABLE**, **INTERNET**, o ambos.
- Cada servicio tiene su propia deuda calculada independientemente.
- Se puede cancelar un servicio sin afectar el otro.
- Se asigna un plan de servicio (con precio) a cada suscripcion.
- El tipo de servicio se detecta automaticamente al importar por la descripcion del documento.

## Calculo de deuda

- Se calcula **por suscripcion**, no por cliente.
- Meses cubiertos = meses pagados + meses con promo MESES_GRATIS.
- Deuda = meses desde ultimo cubierto + 1 hasta el mes actual.
- Huecos anteriores al ultimo pago se perdonan.
- El mes actual solo cuenta si estamos pasado el dia 15.
- **Corte**: cantidadDeuda > 1 (2+ meses de deuda).
- El cron nocturno (5AM ARG) cachea `deudaCalculada` y `requiereCorte` en cada suscripcion.
- El cliente muestra el peor caso entre sus suscripciones + desglose cable/internet.

## Pagos

- **Importados**: vienen del Excel (ramitos/facturas). Se reimportan completos (destructivo, excepto manuales).
- **Manuales**: se registran desde el drawer del cliente, seleccionando servicio y mes. Identificados por `MANUAL-*` en numeroDocumento.
- Solo ADMIN puede eliminar pagos manuales.
- Los pagos manuales se preservan durante reimportacion de Excel.

## Planes de servicio

- CRUD de planes: nombre, tipo (CABLE/INTERNET), precio, descripcion.
- Se asignan a suscripciones.
- Precio se usa en facturas y reportes de cobranza.
- No se puede desactivar un plan con suscripciones activas.

## Promociones

| Tipo | Efecto |
|---|---|
| PORCENTAJE | Descuento % sobre precio del plan |
| MONTO_FIJO | Descuento $ fijo |
| PRECIO_FIJO | Precio especial que reemplaza al del plan |
| MESES_GRATIS | Meses dentro del periodo no generan deuda |

| Scope | Comportamiento |
|---|---|
| PLAN | Se aplica automaticamente a todas las suscripciones del plan |
| CLIENTE | Se asigna manualmente a una suscripcion especifica |

- Solo MESES_GRATIS afecta el calculo de deuda.
- Si hay multiples promos: MESES_GRATIS > PRECIO_FIJO > mejor entre PORCENTAJE y MONTO_FIJO.
- Periodo: fechaInicio y fechaFin (mes completo debe caer dentro para MESES_GRATIS).

## Facturacion fiscal

- **Config empresa**: CUIT, razon social, condicion fiscal, punto de venta.
- **Provider pattern**: MockFiscalProvider genera RECIBO_X internos. Preparado para conectar AFIP.
- **Comprobantes**: tipo (A/B/C/X), numeracion correlativa, montos (subtotal/iva/total), detalle JSON.
- **Emision**: individual por pago o masiva por mes.
- **PDF**: descarga de comprobante con formato fiscal.
- **Anulacion**: solo ADMIN, registra en audit log.
- Tipo se determina automaticamente: RI+RI=A, RI+CF=B, Mono=C, Mock=X.

## Dashboard

- Total clientes, activos, bajas.
- Distribucion de deuda (pie chart): al dia, 1 mes, 2 meses, +2 meses.
- Indicadores: tasa morosidad, clientes para corte.
- **MRR (Monthly Recurring Revenue)**: ingreso teorico vs recaudado, desglose cable/internet, suscripciones sin plan.
- **Tendencia de cobranza**: grafico de linea con % cobrado de los ultimos 12 meses.
- **Clientes en riesgo**: a exactamente `umbralCorte` meses de deuda (a un paso del corte).
- **Crecimiento**: altas, bajas y neto del mes, comparacion con mes anterior.
- **Penetracion internet**: % de clientes con internet, oportunidad (clientes solo cable).
- **Morosidad por zona**: tabla con distribucion de deuda por zona geografica.
- **Tickets de soporte**: abiertos, resueltos hoy, sin resolver +48hs (alerta), tiempo promedio resolucion, tabla de 5 tickets mas antiguos.
- Ultimas importaciones con status.
- **Cache 1 minuto**, invalidado al importar.

## Reportes

- **Reporte de cobranza mensual**: clientes con pago, recaudacion por servicio, comparacion con mes anterior, top 20 sin pago.
- **Export Excel**: clientes con deuda, lista de corte con desglose cable/internet.
- **Export PDF**: lista de corte ordenada por direccion (para tecnicos).
- **Facturas masivas**: ZIP con un PDF por cliente activo.

## Importacion de datos

- **Clientes**: desde Excel con `cod_cli`. No pisa existentes, solo crea nuevos o actualiza a BAJA.
- **Ramitos/Facturas**: borra todo del tipo (excepto manuales), reimporta con batch insert.
- Detecta tipo de servicio (CABLE/INTERNET) por descripcion.
- Vincula a suscripcion existente o crea nueva automaticamente.
- Preview antes de confirmar importacion.

## Equipos (inventario)

- **Alta de equipo**: tipo, marca, modelo, numero de serie (unico).
- **Estados**: EN_DEPOSITO, ASIGNADO, EN_REPARACION, DE_BAJA.
- **Asignar a cliente**: solo equipos EN_DEPOSITO. Registra fecha de instalacion.
- **Retirar de cliente**: marca fecha de retiro, devuelve a EN_DEPOSITO.
- **Estadisticas**: total por estado.
- **Historial**: cada equipo muestra todas sus asignaciones (actuales y pasadas).

## Tickets de soporte

- **Crear ticket** desde el detalle del cliente: tipo + descripcion opcional.
- **Tipos**: Sin señal, Lentitud internet, Reconexión, Instalación, Cambio equipo, Otro.
- **Resolver ticket** con notas de resolución.
- **Estadisticas**: abiertos, resueltos, distribucion por tipo, tiempo promedio de resolucion (ultimos 30 dias).
- **Listado global** con filtros por estado, paginacion.

## Recordatorio WhatsApp

- Desde la lista de corte, boton "Enviar WhatsApp" por cliente.
- Genera mensaje predeterminado con detalle de deuda (cable/internet, meses, monto estimado).
- Abre wa.me con el numero del cliente y el texto pre-armado.

## Gestion de usuarios

- Solo ADMIN crea usuarios con nombre, email, password, rol.
- Cambio de rol y activacion/desactivacion.
- No se puede modificar el propio rol ni desactivar la propia cuenta.
- Cambio de password propio con validacion de password actual.
