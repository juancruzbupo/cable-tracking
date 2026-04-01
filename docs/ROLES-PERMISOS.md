# Roles y Permisos

## Roles del sistema

| Rol | Descripcion |
|---|---|
| **ADMIN** | Acceso total. Gestiona usuarios, importaciones, configuracion fiscal, planes y promociones |
| **OPERADOR** | Operacion diaria. Gestiona clientes, pagos, notas, genera comprobantes y reportes |
| **VISOR** | Solo lectura. Ve dashboard, clientes y documentos. No puede modificar datos |

## Matriz de permisos

### Autenticacion

| Accion | ADMIN | OPERADOR | VISOR |
|---|---|---|---|
| Login | Si | Si | Si |
| Ver perfil (GET /auth/me) | Si | Si | Si |
| Cambiar propia password | Si | Si | Si |

### Gestion de usuarios

| Accion | ADMIN | OPERADOR | VISOR |
|---|---|---|---|
| Listar usuarios | Si | No | No |
| Crear usuario | Si | No | No |
| Cambiar rol de usuario | Si | No | No |
| Activar/desactivar usuario | Si | No | No |

### Clientes

| Accion | ADMIN | OPERADOR | VISOR |
|---|---|---|---|
| Ver lista de clientes | Si | Si | Si |
| Ver detalle de cliente | Si | Si | Si |
| Crear cliente (alta) | Si | Si | No |
| Dar de baja cliente | Si | Si | No |
| Reactivar cliente | Si | No | No |
| Editar datos fiscales | Si | Si | No |

### Suscripciones

| Accion | ADMIN | OPERADOR | VISOR |
|---|---|---|---|
| Cancelar servicio individual | Si | Si | No |
| Reactivar servicio | Si | No | No |
| Cambiar plan de suscripcion | Si | Si | No |
| Editar fecha de alta | Si | No | No |

### Pagos

| Accion | ADMIN | OPERADOR | VISOR |
|---|---|---|---|
| Registrar pago manual | Si | Si | No |
| Eliminar pago manual | Si | No | No |

### Notas

| Accion | ADMIN | OPERADOR | VISOR |
|---|---|---|---|
| Ver notas | Si | Si | Si |
| Agregar nota | Si | Si | No |
| Eliminar nota | Si | No | No |

### Historial (audit log)

| Accion | ADMIN | OPERADOR | VISOR |
|---|---|---|---|
| Ver historial de cliente | Si | Si | No |

### Documentos

| Accion | ADMIN | OPERADOR | VISOR |
|---|---|---|---|
| Ver documentos | Si | Si | Si |

### Importaciones

| Accion | ADMIN | OPERADOR | VISOR |
|---|---|---|---|
| Importar clientes | Si | No | No |
| Importar ramitos/facturas | Si | No | No |
| Ver logs de importacion | Si | Si | No |

### Planes de servicio

| Accion | ADMIN | OPERADOR | VISOR |
|---|---|---|---|
| Ver planes activos | Si | Si | Si |
| Crear/editar/eliminar planes | Si | No | No |

### Promociones

| Accion | ADMIN | OPERADOR | VISOR |
|---|---|---|---|
| Ver promociones | Si | Si | No |
| Crear/editar promociones | Si | No | No |
| Asignar promo a cliente | Si | Si | No |
| Desasignar promo | Si | No | No |

### Comprobantes

| Accion | ADMIN | OPERADOR | VISOR |
|---|---|---|---|
| Ver comprobantes | Si | Si | No |
| Emitir comprobante individual | Si | Si | No |
| Emision masiva | Si | No | No |
| Anular comprobante | Si | No | No |
| Descargar PDF | Si | Si | No |

### Configuracion fiscal

| Accion | ADMIN | OPERADOR | VISOR |
|---|---|---|---|
| Ver configuracion | Si | No | No |
| Editar configuracion | Si | No | No |

### Dashboard y reportes

| Accion | ADMIN | OPERADOR | VISOR |
|---|---|---|---|
| Ver dashboard | Si | Si | Si |
| Ver reportes de cobranza | Si | Si | No |
| Exportar Excel (clientes, corte) | Si | Si | No |
| Exportar PDF lista corte | Si | Si | No |
| Generar facturas masivas | Si | No | No |

## Implementacion tecnica

- Guards globales en `app.module.ts` via `APP_GUARD`
- `JwtAuthGuard`: valida token JWT en cada request
- `RolesGuard`: verifica que el rol del usuario este en `@Roles()`
- `@Public()`: excluye endpoints del guard (health, login)
- Menu del frontend se filtra con `hasRole()` del AuthContext
- Botones de accion se ocultan/muestran segun rol
