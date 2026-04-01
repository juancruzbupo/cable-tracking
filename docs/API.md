# API Reference

Base URL: `/api` | Swagger: `http://localhost:3000/api/docs`
Auth: JWT Bearer token en header `Authorization: Bearer <token>`

## Health (publico)
| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | /health | Status del servidor |

## Auth (publico: login; autenticado: me, change-password)
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| POST | /auth/login | publico | Login → `{ accessToken, user }` |
| GET | /auth/me | todos | Usuario actual |
| POST | /auth/change-password | todos | Cambiar password `{ currentPassword, newPassword }` |
| GET | /auth/users | ADMIN | Listar usuarios |
| POST | /auth/users | ADMIN | Crear usuario `{ name, email, password, role }` |
| PATCH | /auth/users/:id | ADMIN | Actualizar `{ name?, role?, isActive? }` |

## Clients
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| GET | /clients | todos | Lista con filtros `?search,estado,debtStatus,zona,page,limit` |
| GET | /clients/stats | todos | Estadisticas de deuda |
| GET | /clients/:id | todos | Detalle con deuda + documentos paginados `?docPage,docLimit` |
| POST | /clients | ADMIN,OPER | Alta de cliente `{ nombreOriginal, subscriptions[] }` |
| PATCH | /clients/:id/deactivate | ADMIN,OPER | Baja logica |
| PATCH | /clients/:id/reactivate | ADMIN | Reactivar |
| PATCH | /clients/:id/fiscal | ADMIN,OPER | Datos fiscales `{ tipoDocumento, numeroDocumento, condicionFiscal }` |

## Suscripciones (sub-recursos de /clients/:id)
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| PATCH | /clients/:id/subscriptions/:subId/plan | ADMIN,OPER | Asignar plan `{ planId }` |
| PATCH | /clients/:id/subscriptions/:subId/deactivate | ADMIN,OPER | Cancelar servicio |
| PATCH | /clients/:id/subscriptions/:subId/reactivate | ADMIN | Reactivar servicio |
| PATCH | /clients/:id/subscriptions/:subId | ADMIN | Editar fechaAlta `{ fechaAlta }` |

## Pagos manuales
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| POST | /clients/:id/subscriptions/:subId/payments | ADMIN,OPER | Registrar pago `{ year, month }` |
| DELETE | /clients/:id/subscriptions/:subId/payments/:periodId | ADMIN | Eliminar pago manual |

## Notas e historial
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| GET | /clients/:id/notes | todos | Listar notas |
| POST | /clients/:id/notes | ADMIN,OPER | Agregar nota `{ content }` |
| DELETE | /clients/:id/notes/:noteId | ADMIN | Eliminar nota |
| GET | /clients/:id/history | ADMIN,OPER | Historial audit log |

## Promociones del cliente
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| GET | /clients/:id/promotions | todos | Promos activas del cliente |
| POST | /clients/:id/subscriptions/:subId/promotions | ADMIN,OPER | Asignar promo `{ promotionId }` |
| DELETE | /clients/:id/subscriptions/:subId/promotions/:promoId | ADMIN | Desasignar promo |

## Equipos del cliente
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| GET | /clients/:id/equipment | todos | Equipos asignados al cliente |
| POST | /clients/:id/equipment | ADMIN,OPER | Asignar equipo `{ equipmentId, notas? }` |
| PATCH | /clients/:id/equipment/:assignmentId/retirar | ADMIN,OPER | Retirar equipo `{ notas? }` |

## Tickets del cliente
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| GET | /clients/:id/tickets | todos | Tickets del cliente |
| POST | /clients/:id/tickets | ADMIN,OPER | Crear ticket `{ tipo, descripcion? }` |

## Config comprobante del cliente
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| PATCH | /clients/:id/comprobante-config | ADMIN,OPER | Tipo comprobante `{ tipoComprobante }` |

## Documents
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| GET | /documents | todos | Lista `?tipo,clientId,page,limit` |
| GET | /documents/:id | todos | Detalle |

## Import
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| POST | /import/preview/clientes | ADMIN | Preview clientes Excel |
| POST | /import/preview/ramitos | ADMIN | Preview ramitos Excel |
| POST | /import/preview/facturas | ADMIN | Preview facturas Excel |
| POST | /import/clientes | ADMIN | Importar clientes |
| POST | /import/ramitos | ADMIN | Importar ramitos |
| POST | /import/facturas | ADMIN | Importar facturas |
| GET | /import/logs | ADMIN,OPER | Historial de importaciones |

## Dashboard
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| GET | /dashboard | todos | Metricas generales + MRR + riesgo + crecimiento (cache 1min) |
| GET | /dashboard/corte | todos | Lista para corte (cache 1min) |
| GET | /dashboard/tendencia | todos | Tendencia cobranza ultimos 12 meses |
| GET | /dashboard/mrr | todos | MRR teorico vs recaudado, desglose cable/internet |
| GET | /dashboard/riesgo | todos | Clientes a exactamente umbralCorte meses de deuda |
| GET | /dashboard/crecimiento | todos | Altas/bajas del mes, penetracion internet |
| GET | /dashboard/zonas | todos | Distribucion morosidad por zona geografica |
| GET | /dashboard/tickets | todos | Metricas tickets: abiertos, resueltos hoy, +48hs sin resolver, prom. resolucion, top 5 antiguos |

## Export
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| GET | /export/corte | ADMIN,OPER | Excel lista corte |
| GET | /export/clients | ADMIN,OPER | Excel todos los clientes |
| GET | /export/resumen | ADMIN,OPER | Excel resumen general |

## Plans
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| GET | /plans | todos | Planes activos `?tipo` |
| GET | /plans/all | ADMIN | Todos los planes |
| POST | /plans | ADMIN | Crear plan |
| PATCH | /plans/:id | ADMIN | Editar plan |
| DELETE | /plans/:id | ADMIN | Eliminar plan |

## Promotions
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| GET | /promotions | ADMIN,OPER | Lista `?scope,tipo,activa,planId` |
| GET | /promotions/active | todos | Promos vigentes hoy |
| GET | /promotions/:id | ADMIN,OPER | Detalle |
| POST | /promotions | ADMIN | Crear promo |
| PATCH | /promotions/:id | ADMIN | Editar promo |
| DELETE | /promotions/:id | ADMIN | Eliminar promo |

## Billing
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| GET | /billing/invoice/:clientId | ADMIN,OPER | PDF factura `?month,year` |
| POST | /billing/invoices/batch | ADMIN | ZIP facturas masivas `{ month, year }` |
| GET | /billing/report | ADMIN,OPER | Reporte cobranza `?month,year` |
| GET | /billing/corte/print | ADMIN,OPER | PDF lista corte |

## Equipment
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| GET | /equipment | ADMIN,OPER | Lista equipos `?tipo,estado,search` |
| GET | /equipment/stats | ADMIN,OPER | Estadisticas por estado |
| GET | /equipment/:id | ADMIN,OPER | Detalle con historial de asignaciones |
| POST | /equipment | ADMIN | Crear equipo `{ tipo, marca?, modelo?, numeroSerie?, notas? }` |
| PATCH | /equipment/:id | ADMIN | Editar equipo `{ marca?, modelo?, notas?, estado? }` |

## Tickets
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| GET | /tickets | ADMIN,OPER | Lista tickets `?estado,tipo,clientId,page,limit` |
| GET | /tickets/stats | ADMIN,OPER | Estadisticas (abiertos, resueltos, tiempo promedio resolucion) |
| PATCH | /tickets/:id/resolver | ADMIN,OPER | Resolver ticket `{ notas? }` |

## Fiscal
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| GET | /fiscal/config | ADMIN | Config empresa |
| GET | /fiscal/config/test | ADMIN | Test conexion con proveedor fiscal |
| PATCH | /fiscal/config | ADMIN | Actualizar config |
| GET | /fiscal/comprobantes | ADMIN,OPER | Lista `?clientId,estado,tipo,page,limit` |
| GET | /fiscal/comprobantes/:id | ADMIN,OPER | Detalle |
| GET | /fiscal/comprobantes/:id/pdf | ADMIN,OPER | Descargar PDF |
| POST | /fiscal/comprobantes/pago/:ppId | ADMIN,OPER | Emitir por pago |
| POST | /fiscal/comprobantes/batch | ADMIN | Emision masiva `{ month, year }` |
| PATCH | /fiscal/comprobantes/:id/anular | ADMIN | Anular comprobante |

## Scheduler
| Metodo | Ruta | Roles | Descripcion |
|---|---|---|---|
| GET | /scheduler/status | ADMIN | Status ultimo calculo |

## Errores
```json
{ "success": false, "statusCode": 400, "message": "...", "timestamp": "..." }
```
| Codigo | Significado |
|---|---|
| 400 | Validacion fallida |
| 401 | No autenticado / token expirado |
| 403 | Sin permisos (rol insuficiente) |
| 404 | Recurso no encontrado |
| 409 | Conflicto (duplicado) |
| 500 | Error interno |
