# Cable Tracking — Manual del Sistema

## Que es Cable Tracking

Cable Tracking es un sistema web completo para gestionar clientes de una empresa de cable e internet. Permite controlar suscripciones, calcular deuda mensual por servicio, gestionar cortes, facturar, manejar promociones, equipos, tickets de soporte y generar reportes de cobranza.

El sistema se accede desde el navegador web y tiene 3 niveles de acceso segun el rol del usuario.

---

## Roles de usuario

El sistema tiene 3 roles con diferentes niveles de acceso:

| Rol | Descripcion |
|-----|-------------|
| **ADMIN** | Acceso total. Gestiona usuarios, importaciones, configuracion fiscal, planes, promociones y toda la operacion |
| **OPERADOR** | Operacion diaria. Gestiona clientes, pagos, notas, tickets, equipos y genera reportes |
| **VISOR** | Solo lectura. Ve el dashboard, clientes y documentos. No puede modificar datos |

---

## Paginas del sistema

### 1. Dashboard (inicio)

**Acceso:** Todos los roles

El dashboard es la pantalla principal y muestra el estado general de la empresa en tiempo real. Se actualiza automaticamente cada 1 minuto.

**Indicadores principales (fila 1):**
- **Total clientes**: cantidad total de clientes registrados
- **Activos**: clientes con servicio vigente
- **De baja**: clientes dados de baja
- **En riesgo de corte**: clientes a exactamente 1 mes del umbral de corte (alerta amarilla)

**Ingresos — MRR (fila 2):**
- **Ingreso teorico**: suma de los precios de todos los planes activos (lo que deberia entrar si todos pagaran)
- **Recaudado**: monto efectivamente cobrado en el mes actual
- **% Recaudacion**: porcentaje cobrado vs teorico. Verde si es mayor a 80%, amarillo entre 60-80%, rojo menor a 60%
- **Sin plan asignado**: suscripciones activas que no tienen plan con precio configurado (hay que asignarles uno)

**Estado de deuda (fila 3):**
- **Al dia**: clientes sin deuda
- **1 mes deuda**: clientes con 1 mes pendiente
- **2 meses deuda**: clientes con 2 meses pendientes
- **+2 meses (CORTE)**: clientes que superan el umbral y requieren corte de servicio

**Graficos (fila 4):**
- **Tendencia de cobranza (12 meses)**: grafico de linea que muestra el porcentaje de cobranza mes a mes del ultimo anio. La linea punteada verde marca el objetivo del 80%
- **Distribucion de deuda**: grafico de torta con la proporcion de clientes al dia, 1 mes, 2 meses y +2 meses

**Crecimiento (fila 5):**
- **Altas del mes**: nuevos clientes dados de alta este mes
- **Bajas del mes**: clientes dados de baja este mes
- **Neto**: diferencia altas - bajas (verde positivo, rojo negativo)
- **Penetracion internet**: porcentaje de clientes que tienen servicio de internet
- **Potencial internet**: cantidad de clientes que solo tienen cable y podrian contratar internet (oportunidad comercial)

**Morosidad por zona (fila 6):**
- Tabla con cada zona geografica mostrando: total clientes, al dia, en riesgo, en corte, y porcentaje de morosidad. Permite identificar que zonas tienen mas problemas de cobranza

**Tickets de soporte (fila 7):**
- **Tickets abiertos**: cantidad de tickets sin resolver (rojo si hay pendientes)
- **Resueltos hoy**: tickets cerrados en el dia
- **Sin resolver +48hs**: tickets que llevan mas de 2 dias abiertos (alerta amarilla — requiere atencion urgente)
- **Tiempo promedio resolucion**: promedio en horas de los ultimos 30 dias
- **Tabla**: los 5 tickets abiertos mas antiguos con cliente, tipo de problema y hace cuanto tiempo estan abiertos

**Ultimas importaciones (fila 8):**
- Tabla con las ultimas 5 importaciones de Excel realizadas, mostrando tipo, archivo, filas procesadas, estado y fecha

---

### 2. Clientes

**Acceso:** Todos los roles (modificaciones solo ADMIN y OPERADOR)

Pagina principal de gestion de clientes.

**Busqueda y filtros:**
- Buscar por nombre o codigo de cliente
- Filtrar por estado (Activo/Baja)
- Filtrar por nivel de deuda (Al dia / 1 mes / 2 meses / +2 meses)

**Tabla de clientes:**
- Codigo, nombre, estado, fecha de alta, calle, servicios activos (Cable/Internet), nivel de deuda
- Icono de advertencia amarillo si el cliente tiene tickets de soporte abiertos
- Click en el ojo para abrir el detalle completo

**Acciones disponibles:**
- **Nuevo cliente** (ADMIN, OPERADOR): crear cliente con nombre, direccion y servicios
- **Exportar Excel** (ADMIN, OPERADOR): descarga planilla con todos los clientes

**Detalle del cliente (drawer lateral):**
Al hacer click en un cliente se abre un panel con toda su informacion:

- **Datos basicos**: codigo, nombre, estado, fecha de alta, direccion
- **Boton WhatsApp**: si el cliente tiene telefono y deuda, envia un mensaje predeterminado por WhatsApp con el detalle de la deuda
- **Dar de baja / Reactivar**: segun corresponda y el rol del usuario
- **Servicios**: tarjetas separadas para Cable e Internet mostrando:
  - Meses de deuda (numero grande rojo o verde)
  - Meses pagados (numero verde)
  - Badges de los ultimos 6 meses: verde = pagado, rojo = adeudado, violeta = cubierto por promocion
  - Boton cancelar servicio individual
- **Registrar pago manual**: seleccionar servicio y mes a registrar como pagado
- **Notas**: agregar notas de texto libre sobre el cliente. Solo ADMIN puede borrar notas
- **Historial**: timeline con todas las acciones realizadas sobre el cliente (quien, que, cuando)
- **Promociones**: lista de promociones activas asignadas al cliente
- **Datos fiscales**: tipo de documento, CUIT/DNI, condicion fiscal, razon social, telefono, email, zona, tipo de comprobante (RAMITO o FACTURA)
- **Equipos**: lista de equipos asignados al cliente con opcion de retirar
- **Tickets**: lista de tickets de soporte del cliente con opcion de crear nuevo ticket
- **Documentos**: timeline de ramitos y facturas importados con periodos cubiertos

---

### 3. Lista de Corte

**Acceso:** Todos los roles (exportaciones solo ADMIN y OPERADOR)

Muestra los clientes que superan el umbral de deuda y requieren corte de servicio.

**Indicadores:**
- Total para corte, solo cable, solo internet, ambos servicios

**Filtros:**
- Busqueda por nombre o codigo
- Filtro por zona (para que el tecnico filtre su recorrido de trabajo)

**Tabla:**
- Numero, cliente, direccion con zona, servicios a cortar (Cable/Internet con meses), deuda total con colores por gravedad, ultimo pago registrado
- Boton WhatsApp para enviar aviso al cliente antes de cortar

**Exportaciones:**
- **PDF**: lista ordenada por direccion para imprimir y llevar al campo
- **Excel**: planilla con todos los datos incluyendo zona y telefono

---

### 4. Tickets de Soporte

**Acceso:** ADMIN y OPERADOR

Sistema de seguimiento de problemas tecnicos reportados por clientes.

**Indicadores:**
- Tickets abiertos, resueltos, tiempo promedio de resolucion

**Acciones:**
- **Nuevo Ticket**: buscar cliente, seleccionar tipo de problema, agregar descripcion
- **Resolver**: cerrar ticket con notas de resolucion

**Tipos de problemas:**
- Sin senal
- Lentitud de internet
- Reconexion
- Instalacion
- Cambio de equipo
- Otro

---

### 5. Equipos

**Acceso:** ADMIN y OPERADOR (crear/editar solo ADMIN)

Inventario de equipos de la empresa (routers, decodificadores, ONTs, etc).

**Estados de un equipo:**
- **En deposito**: disponible para asignar
- **Asignado**: instalado en domicilio de un cliente
- **En reparacion**: en proceso de arreglo
- **De baja**: fuera de servicio

**Acciones:**
- **Nuevo equipo** (ADMIN): registrar tipo, marca, modelo, numero de serie
- **Asignar a cliente** (ADMIN, OPERADOR): solo equipos en deposito
- **Retirar de cliente** (ADMIN, OPERADOR): registra fecha de retiro y vuelve a deposito

---

### 6. Documentos

**Acceso:** Todos los roles

Vista de todos los ramitos y facturas importados del Excel. Permite filtrar por tipo y cliente, con paginacion.

---

### 7. Comprobantes

**Acceso:** ADMIN y OPERADOR

Gestion de comprobantes fiscales emitidos.

**Acciones:**
- Ver lista de comprobantes con filtros por estado y tipo
- Descargar PDF de comprobante individual
- **Emitir por pago** (ADMIN, OPERADOR): generar comprobante para un pago especifico
- **Emision masiva** (ADMIN): generar comprobantes para todos los pagos de un mes
- **Anular comprobante** (ADMIN): anular un comprobante emitido

**Tipos de comprobante (se determinan automaticamente):**
- Factura A: cuando el emisor y receptor son Responsables Inscriptos
- Factura B: cuando el emisor es RI y el receptor es Consumidor Final o Monotributista
- Factura C: cuando el emisor es Monotributista
- Recibo X: modo interno (sin conexion AFIP)

---

### 8. Reportes

**Acceso:** ADMIN y OPERADOR

**Reporte de cobranza mensual:**
- Total clientes, clientes con pago, clientes sin pago, porcentaje cobrado
- Desglose por servicio (Cable/Internet): suscripciones activas, pagadas, pendientes, monto esperado vs recaudado
- Comparacion con el mes anterior (variacion del porcentaje)
- Top 20 clientes sin pago del mes

**Facturas masivas** (ADMIN):
- Genera un ZIP con un PDF de factura por cada cliente activo para el mes seleccionado

---

### 9. Planes

**Acceso:** Ver todos, modificar solo ADMIN

Gestion de planes de servicio.

**Datos de un plan:**
- Nombre (ej: "Internet 100MB", "Cable Basico")
- Tipo: Cable o Internet
- Precio mensual
- Descripcion
- Estado: Activo/Inactivo

Los planes se asignan a las suscripciones de los clientes y determinan el precio mensual que se usa para calcular ingresos y generar facturas.

---

### 10. Promociones

**Acceso:** ADMIN y OPERADOR ver, ADMIN crear/editar

Sistema de descuentos y beneficios.

**Tipos de promocion:**

| Tipo | Efecto |
|------|--------|
| **Porcentaje** | Descuento % sobre el precio del plan (ej: 20% off) |
| **Monto fijo** | Descuento de un monto fijo en pesos (ej: $500 off) |
| **Precio fijo** | Precio especial que reemplaza al del plan (ej: $3000 en vez de $5000) |
| **Meses gratis** | Los meses dentro del periodo de la promo no generan deuda |

**Alcance:**
- **Por plan**: se aplica automaticamente a todos los clientes con ese plan
- **Por cliente**: se asigna manualmente a una suscripcion especifica

**Importante:** Solo las promociones de tipo "Meses gratis" afectan el calculo de deuda. Las demas solo afectan el precio que aparece en facturas.

---

### 11. Importaciones

**Acceso:** Solo ADMIN

Permite cargar datos desde archivos Excel.

**Orden obligatorio de importacion:**
1. **Clientes** primero: carga el listado de clientes con sus codigos
2. **Ramitos** segundo: carga los ramitos (recibos) que generan periodos de pago
3. **Facturas** tercero: carga las facturas que generan periodos de pago

**Comportamiento:**
- Los clientes existentes no se pisan (solo se crean nuevos o se marcan como baja)
- Los ramitos y facturas se reimportan completos: se borran los anteriores EXCEPTO los pagos manuales registrados desde el sistema
- Antes de importar se muestra una vista previa para confirmar

---

### 12. Config Fiscal

**Acceso:** Solo ADMIN

Configuracion de la empresa para facturacion:
- CUIT, razon social, condicion fiscal, domicilio fiscal
- Punto de venta
- Proveedor de facturacion (modo interno o TusFacturas/ARCA)
- Credenciales del proveedor
- Umbral de corte (cantidad de meses de deuda para marcar para corte, default: 2+ meses)
- Zona por defecto para nuevos clientes

---

### 13. Usuarios

**Acceso:** Solo ADMIN

Gestion de usuarios del sistema:
- Crear usuario con nombre, email, password y rol
- Cambiar rol de un usuario
- Activar/desactivar usuario
- No se puede modificar el propio rol ni desactivar la propia cuenta

---

## Permisos detallados por rol

### Clientes

| Accion | ADMIN | OPERADOR | VISOR |
|--------|-------|----------|-------|
| Ver lista y detalle de clientes | Si | Si | Si |
| Crear cliente (alta) | Si | Si | No |
| Dar de baja cliente | Si | Si | No |
| Reactivar cliente | Si | No | No |
| Editar datos fiscales | Si | Si | No |
| Cambiar tipo comprobante | Si | Si | No |

### Suscripciones

| Accion | ADMIN | OPERADOR | VISOR |
|--------|-------|----------|-------|
| Cancelar servicio individual | Si | Si | No |
| Reactivar servicio | Si | No | No |
| Cambiar plan de suscripcion | Si | Si | No |
| Editar fecha de alta | Si | No | No |

### Pagos

| Accion | ADMIN | OPERADOR | VISOR |
|--------|-------|----------|-------|
| Registrar pago manual | Si | Si | No |
| Eliminar pago manual | Si | No | No |

### Notas

| Accion | ADMIN | OPERADOR | VISOR |
|--------|-------|----------|-------|
| Ver notas | Si | Si | Si |
| Agregar nota | Si | Si | No |
| Eliminar nota | Si | No | No |

### Equipos

| Accion | ADMIN | OPERADOR | VISOR |
|--------|-------|----------|-------|
| Ver inventario de equipos | Si | Si | No |
| Crear equipo | Si | No | No |
| Editar equipo | Si | No | No |
| Ver equipos del cliente | Si | Si | Si |
| Asignar equipo a cliente | Si | Si | No |
| Retirar equipo | Si | Si | No |

### Tickets de soporte

| Accion | ADMIN | OPERADOR | VISOR |
|--------|-------|----------|-------|
| Ver tickets | Si | Si | No |
| Crear ticket | Si | Si | No |
| Resolver ticket | Si | Si | No |
| Ver tickets del cliente | Si | Si | Si |

### Comprobantes y facturacion

| Accion | ADMIN | OPERADOR | VISOR |
|--------|-------|----------|-------|
| Ver comprobantes | Si | Si | No |
| Emitir comprobante individual | Si | Si | No |
| Emision masiva | Si | No | No |
| Anular comprobante | Si | No | No |
| Descargar PDF | Si | Si | No |

### Planes y promociones

| Accion | ADMIN | OPERADOR | VISOR |
|--------|-------|----------|-------|
| Ver planes activos | Si | Si | Si |
| Crear/editar/eliminar planes | Si | No | No |
| Ver promociones | Si | Si | No |
| Crear/editar promociones | Si | No | No |
| Asignar promo a cliente | Si | Si | No |
| Desasignar promo | Si | No | No |

### Dashboard y reportes

| Accion | ADMIN | OPERADOR | VISOR |
|--------|-------|----------|-------|
| Ver dashboard completo | Si | Si | Si |
| Ver reportes de cobranza | Si | Si | No |
| Exportar Excel | Si | Si | No |
| Exportar PDF lista corte | Si | Si | No |
| Generar facturas masivas | Si | No | No |

### Administracion

| Accion | ADMIN | OPERADOR | VISOR |
|--------|-------|----------|-------|
| Importar Excel | Si | No | No |
| Configuracion fiscal | Si | No | No |
| Gestion de usuarios | Si | No | No |
| Cambiar propia password | Si | Si | Si |

---

## Reglas de negocio importantes

### Calculo de deuda

La deuda se calcula **por servicio** (Cable e Internet por separado), no por cliente:

1. Se cuentan los meses desde que el cliente dio de alta el servicio hasta el mes actual
2. El mes actual solo cuenta si ya pasamos el dia 15
3. Se restan los meses pagados (importados del Excel o registrados manualmente)
4. Se restan los meses cubiertos por promociones de tipo "Meses gratis"
5. Si el cliente pago un mes reciente pero tiene meses anteriores sin pagar, esos meses viejos se perdonan (solo cuenta la deuda desde el ultimo pago en adelante)
6. Si la deuda supera el umbral configurado (por defecto 2 meses), el cliente se marca para corte

### Preservacion de pagos manuales

Cuando se reimportan ramitos o facturas desde Excel, el sistema borra los documentos anteriores del mismo tipo PERO preserva todos los pagos registrados manualmente desde el sistema. Estos pagos se identifican porque su numero de documento empieza con "MANUAL-".

### Tipo de comprobante por cliente

Cada cliente tiene configurado si recibe **RAMITO** (recibo interno, sin factura fiscal) o **FACTURA** (comprobante fiscal real). Por defecto todos los clientes estan en RAMITO. Para cambiar a FACTURA, el cliente debe tener cargado su CUIT o DNI en los datos fiscales.

### Recalculo nocturno

Todas las noches a las 5:00 AM (hora Argentina) el sistema recalcula automaticamente la deuda de todas las suscripciones activas. Esto actualiza los indicadores del dashboard y la lista de corte.

---

## Navegacion del menu

El menu lateral muestra las paginas disponibles segun el rol del usuario, ordenadas por frecuencia de uso:

**Operacion diaria:**
1. Dashboard
2. Clientes
3. Para Corte
4. Tickets
5. Equipos

**Consultas:**
6. Documentos
7. Comprobantes
8. Reportes

**Configuracion:**
9. Planes
10. Promociones

**Administracion (solo ADMIN):**
11. Importaciones
12. Config Fiscal
13. Usuarios

---

## Acceso al sistema

- **URL**: se accede desde el navegador web
- **Login**: email y password
- **Sesion**: dura 8 horas, despues hay que volver a iniciar sesion
- **Credenciales iniciales**: las provee el administrador del sistema
