# Cable Tracking - Guia de Usuario

## Indice

1. [Que es Cable Tracking](#1-que-es-cable-tracking)
2. [Como acceder al sistema](#2-como-acceder-al-sistema)
3. [Navegacion general](#3-navegacion-general)
4. [Dashboard - Pantalla principal](#4-dashboard---pantalla-principal)
5. [Importar datos](#5-importar-datos)
6. [Consultar clientes](#6-consultar-clientes)
7. [Ver documentos](#7-ver-documentos)
8. [Clientes para corte](#8-clientes-para-corte)
9. [Exportar reportes a Excel](#9-exportar-reportes-a-excel)
10. [Puntos clave a tener en cuenta](#10-puntos-clave-a-tener-en-cuenta)
11. [Preguntas frecuentes](#11-preguntas-frecuentes)
12. [Glosario](#12-glosario)

---

## 1. Que es Cable Tracking

Cable Tracking es un sistema web para controlar la situacion de los clientes de una empresa de cable. Sirve para:

- **Saber quien debe y cuanto**: El sistema calcula automaticamente cuantos meses adeuda cada cliente.
- **Determinar a quien hay que cortarle**: Los clientes con mas de 2 meses de deuda se marcan automaticamente para corte.
- **Llevar registro de los pagos**: Se importan los ramitos y facturas del sistema de gestion y el sistema extrae los meses cubiertos.
- **Generar reportes**: Se pueden descargar listados en Excel para llevar a campo o presentar al dueño.

El sistema NO reemplaza al sistema de facturacion. Se alimenta de los archivos Excel que ya genera el sistema existente.

---

## 2. Como acceder al sistema

Abrir el navegador y acceder a la URL del sistema. En desarrollo es:

- **http://localhost:5174**

El sistema no requiere usuario ni contrasena.

---

## 3. Navegacion general

El sistema tiene un menu lateral (barra oscura a la izquierda) con 5 secciones:

| Seccion | Para que sirve |
|---|---|
| **Dashboard** | Ver los numeros generales de un vistazo |
| **Clientes** | Buscar clientes, ver su deuda y su historial |
| **Importaciones** | Cargar los archivos Excel |
| **Documentos** | Ver todos los ramitos y facturas importados |
| **Para Corte** | Lista de clientes que deben ser cortados |

El menu se puede colapsar haciendo click en la flecha de abajo para tener mas espacio.

---

## 4. Dashboard - Pantalla principal

Al abrir el sistema se ve el Dashboard con toda la informacion resumida:

### Resumen de clientes
- **Total clientes**: Todos los clientes registrados.
- **Activos**: Clientes que estan recibiendo servicio.
- **De baja**: Clientes que ya no estan activos.

### Distribucion de deuda
- **Al dia**: No deben nada.
- **1 mes de deuda**: Deben un solo mes.
- **2 meses de deuda**: Deben dos meses.
- **+2 meses (CORTE)**: Deben mas de 2 meses y deben ser cortados.

### Grafico circular
Muestra visualmente la proporcion de clientes al dia vs. con deuda. Los colores son:
- Verde = al dia
- Amarillo = 1 mes
- Naranja = 2 meses
- Rojo = +2 meses

### Indicadores clave
- **Tasa de morosidad**: Porcentaje de clientes activos que tienen alguna deuda.
- **Para corte**: Cantidad de clientes que requieren corte.
- **Ramitos y facturas**: Cantidad de documentos registrados.

### Ultimas importaciones
Tabla con las importaciones mas recientes, para saber cuando fue la ultima vez que se actualizo la informacion.

---

## 5. Importar datos

Esta es la seccion mas importante. Aqui se cargan los archivos Excel que alimentan al sistema.

### REGLA FUNDAMENTAL: Orden de importacion

```
PRIMERO:    clientes.xlsx
SEGUNDO:    pedidos.xlsx (ramitos)
TERCERO:    ventas_.xlsx (facturas)
```

**Siempre respetar este orden.** Los ramitos y facturas necesitan que los clientes ya esten cargados para poder vincularlos.

### Paso a paso para importar

1. Ir a la seccion **Importaciones**.
2. Seleccionar la tab correspondiente (Clientes, Ramitos o Facturas).
3. Arrastrar el archivo Excel al area de carga, o hacer click para seleccionarlo.
4. El sistema mostrara un **preview**: cuantas filas tiene, cuantas son validas, cuantas tienen errores, y una muestra de los datos.
5. Revisar que todo se vea bien.
6. Hacer click en **Confirmar** para ejecutar la importacion.
7. Para ramitos y facturas aparecera un dialogo de confirmacion porque la accion es destructiva.
8. Esperar a que se complete (puede tardar unos minutos para archivos grandes).
9. El sistema mostrara un resumen con lo que se importo.

### Diferencias entre tipos de importacion

| Tipo | Que hace | Es destructivo? |
|---|---|---|
| **Clientes** | Agrega clientes nuevos. Si ya existe, no lo duplica. Si indica "DE BAJA", actualiza el estado. | NO - No borra nada existente |
| **Ramitos** | Borra TODOS los ramitos anteriores y carga los nuevos del archivo. | SI - Reemplaza todo |
| **Facturas** | Borra TODAS las facturas anteriores y carga las nuevas del archivo. | SI - Reemplaza todo |

### Formato de los archivos Excel

**clientes.xlsx** debe tener estas columnas:
- `nombre` (obligatorio) — Nombre del cliente
- `cod_cli` o `codigo` — Codigo del cliente
- `fecalta` o `fecha_alta` — Fecha de alta del servicio
- `calle` o `direccion` — Direccion del cliente

**pedidos.xlsx (ramitos)** debe tener:
- `nombre` (obligatorio) — Nombre del cliente
- `fecha` — Fecha del documento
- `nro_comp` o `comprob` — Numero de comprobante
- `descrip` o `descripcion` — Descripcion (de aqui se extraen los meses cubiertos)

**ventas_.xlsx (facturas)** debe tener:
- `nombre` (obligatorio) — Nombre del cliente
- `fecha` — Fecha del documento
- `comprob` o `nro_comp` — Numero de comprobante
- `descrip` o `descripcion` — Descripcion (de aqui se extraen los meses cubiertos)

### Como el sistema entiende los periodos de pago

El sistema lee la columna de descripcion y busca el nombre del mes seguido del año. Ejemplos:

| Descripcion en el Excel | Periodo que detecta |
|---|---|
| "TvCable Enero26 del 1 al 15" | Enero 2026 |
| "6Megas Diciembre25" | Diciembre 2025 |
| "Promo 3Megas Febrero25" | Febrero 2025 |
| "5megas noviembre24" | Noviembre 2024 |

Si la descripcion dice "SUSCRIPCION DE TV CABLE", "RECONEXION", "Punto adicional", "traslado" o "INSTALACION", el sistema entiende que NO es un pago de mes y no lo cuenta.

### Como el sistema normaliza los nombres

Los nombres en los Excel a veces tienen anotaciones extras. El sistema las limpia automaticamente:

| Nombre en el Excel | Nombre que guarda el sistema |
|---|---|
| "PEREZ JUAN DE BAJA" | "PEREZ JUAN" (y lo marca como BAJA) |
| "GONZALEZ ANA SOLO INTERNET" | "GONZALEZ ANA" |
| "ORTIZ PEDRO 6megas" | "ORTIZ PEDRO" |
| "LOPEZ MARIA cortado 21-02-24" | "LOPEZ MARIA" |
| "RODRIGUEZ CARLOS JUBILADA" | "RODRIGUEZ CARLOS" |

Esto es importante porque el match entre el archivo de clientes y el de ramitos/facturas se hace por este nombre limpio. Si el nombre no coincide despues de la limpieza, el sistema no podra vincularlos.

### Historial de importaciones

En la tab **Historial** se puede ver un registro de todas las importaciones realizadas, con la fecha, archivo, cantidad de filas y si hubo errores.

---

## 6. Consultar clientes

En la seccion **Clientes** se puede ver y buscar en la lista completa de clientes.

### Filtros disponibles

- **Buscar por nombre**: Escribir parte del nombre y presionar Enter.
- **Filtrar por estado**: Seleccionar "Activo" o "Baja".
- **Filtrar por nivel de deuda**: "Al dia", "1 mes", "2 meses", "+2 meses".

Los filtros se pueden combinar. Por ejemplo: buscar "PEREZ" con estado "Activo" y deuda "+2 meses".

### Informacion en la tabla

Cada fila muestra:
- **Nombre** del cliente (normalizado).
- **Estado**: Activo (azul) o Baja (gris).
- **Fecha de alta**: Cuando empezo el servicio.
- **Calle**: Direccion.
- **Deuda**: Tag de color indicando el nivel (verde = al dia, amarillo = 1 mes, naranja = 2 meses, rojo = +2 meses con alerta de CORTE).
- **Meses adeudados**: Los primeros meses que debe. Si son muchos, muestra los primeros 3 y cuantos mas hay.

### Ver detalle de un cliente

Hacer click en el icono de ojo de un cliente para abrir el panel de detalle:

- **Informacion basica**: Nombre original, codigo, estado, fecha de alta, calle.
- **Situacion de deuda**: Numeros grandes con meses de deuda, pagados y obligatorios.
- **Alerta de corte**: Si requiere corte, se muestra un tag rojo.
- **Cobertura mensual**: Badges de los ultimos 12 meses (verde = pago, rojo = no pago). Esto permite ver de un vistazo que meses faltan.
- **Documentos**: Timeline con los ramitos y facturas del cliente, mostrando tipo, numero, fecha, descripcion y periodos que cubren.

---

## 7. Ver documentos

La seccion **Documentos** muestra todos los ramitos y facturas importados.

- Se puede filtrar por tipo: Ramitos o Facturas.
- Cada documento muestra el cliente asociado, tipo, numero, fecha, descripcion y los periodos de pago que se extrajeron.
- Si un documento dice "Sin periodos" (tag rojo), significa que la descripcion no contenida un formato de mes reconocible.

---

## 8. Clientes para corte

La seccion **Para Corte** muestra SOLO los clientes que tienen mas de 2 meses de deuda.

### Informacion que muestra

- **Cards de resumen**: Total de clientes para corte, promedio de meses de deuda, y la maxima deuda.
- **Tabla**: Lista de clientes ordenados por cantidad de deuda (el que mas debe primero), con nombre, calle, fecha de alta, meses de deuda y los meses especificos que adeudan.

### Exportar el listado

Hay dos botones de descarga:
- **Exportar Corte**: Descarga un Excel SOLO con los clientes que necesitan corte. Util para llevar a campo.
- **Resumen General**: Descarga un Excel con 2 hojas: una con indicadores generales (total clientes, morosidad, etc.) y otra con el listado de corte.

---

## 9. Exportar reportes a Excel

El sistema permite descargar 3 tipos de reportes Excel:

### Desde la pagina de Clientes
- **Exportar Excel**: Descarga un Excel con TODOS los clientes, su estado, deuda y situacion. Las filas tienen colores:
  - Gris = de baja
  - Sin color = al dia
  - Amarillo claro = 1 mes de deuda
  - Naranja claro = 2 meses de deuda
  - Rojo claro = +2 meses (para corte)

### Desde la pagina Para Corte
- **Exportar Corte**: Excel con solo los clientes para corte. Header rojo. Los clientes con mas de 6 meses de deuda se resaltan en rojo claro.
- **Resumen General**: Excel con 2 hojas:
  - Hoja 1 "Resumen": Total clientes, activos, de baja, al dia, con deuda, para corte, tasa de morosidad, fecha del reporte.
  - Hoja 2 "Para Corte": Misma tabla que el export de corte.

Todos los archivos Excel se descargan con la fecha del dia en el nombre (ej: `corte_2026-02-23.xlsx`).

---

## 10. Puntos clave a tener en cuenta

### Antes de importar

1. **Siempre importar clientes PRIMERO**. Si se importan ramitos o facturas sin clientes, las filas van a fallar porque el sistema no encuentra a quien vincularlas.

2. **Verificar el preview antes de confirmar**. El preview muestra errores y datos de muestra. Leer los errores ayuda a detectar problemas en el archivo.

3. **Los ramitos y facturas se REEMPLAZAN completamente**. Al importar ramitos, se borran TODOS los ramitos anteriores. Lo mismo con facturas. Esto significa que siempre hay que importar el archivo COMPLETO, no solo las nuevas.

4. **La importacion de clientes NO borra nada**. Solo agrega nuevos y actualiza estados de baja. Es seguro importar multiples veces.

### Sobre los nombres

5. **El matching depende de los nombres**. Si un cliente se llama "PEREZ JUAN" en el archivo de clientes pero "PEREZ JUAN CARLOS" en el de facturas, el sistema NO los va a vincular (despues de normalizar son nombres diferentes).

6. **Revisar los errores de "Cliente no encontrado"**. Despues de importar ramitos/facturas, si hay muchos errores de este tipo, probablemente hay una discrepancia de nombres entre los archivos.

### Sobre la deuda

7. **La fecha de alta es fundamental**. La deuda se calcula desde la fecha de alta. Si un cliente no tiene fecha de alta, su deuda sera 0.

8. **El dia 15 es el corte del mes**. Si estamos antes del dia 16, el mes actual no se cuenta como adeudado. Despues del 15, si.

9. **Corte = mas de 2 meses de deuda**. Un cliente con exactamente 2 meses de deuda NO aparece en la lista de corte. Recien con 3+ meses.

10. **La deuda se calcula en tiempo real**. No se guarda en la base de datos. Cada vez que se consulta, se recalcula. Esto significa que si hoy es 16 de febrero y manana es 17, la deuda puede cambiar.

### Sobre las importaciones

11. **Usar archivos .xlsx o .xls**. No se aceptan CSV ni otros formatos.

12. **Maximo 10MB por archivo**. Si el archivo supera este tamano, la importacion sera rechazada.

13. **Los nombres de columna importan pero son flexibles**. El sistema busca variaciones del nombre de columna (ej: "nombre", "nombre_cliente", "cliente"). Pero si la columna se llama de una forma muy diferente, no la va a encontrar.

14. **Toda importacion queda registrada**. En la tab de Historial se puede ver cada importacion, cuantas filas proceso y si hubo errores.

### Sobre las exportaciones

15. **Los Excel se generan con la data del momento**. Si se importan datos nuevos, hay que volver a exportar para tener la version actualizada.

16. **Los archivos incluyen filtros automaticos**. En Excel, las columnas del header tienen filtros que se pueden usar para ordenar y filtrar.

---

## 11. Preguntas frecuentes

### "Importe los clientes pero el dashboard muestra todo en 0"

Los clientes estan cargados, pero todavia no hay documentos. Importar los ramitos y facturas para que el sistema tenga periodos de pago y pueda calcular la deuda.

### "Muchos clientes aparecen como 'al dia' pero se que deben"

Verificar que se hayan importado los ramitos Y las facturas. Si solo se importaron facturas, los pagos cubiertos por ramitos no se van a contabilizar.

### "Al importar ramitos/facturas me dice 'Cliente no encontrado' en muchas filas"

El nombre en el archivo de ramitos/facturas no coincide con el de clientes despues de normalizarlo. Verificar que se haya importado el archivo de clientes actualizado.

### "Un cliente deberia tener deuda pero aparece al dia"

Posibles causas:
- No tiene `fechaAlta` registrada (sin fecha de alta, la deuda es 0).
- La fecha de alta es reciente y todavia no paso suficiente tiempo.
- Estamos antes del dia 16 del mes, asi que el mes actual no cuenta.

### "Quiero actualizar solo los clientes nuevos, sin perder los datos de deuda"

La importacion de clientes NO borra nada. Se puede importar el archivo actualizado y solo se agregaran los clientes nuevos. La deuda no se pierde porque depende de los documentos, no de los clientes.

### "Quiero actualizar los ramitos pero me da miedo perder los datos"

Al importar ramitos, se borran TODOS los anteriores. Pero como se importa el archivo completo, los datos se reemplazan con la version mas reciente. Solo asegurarse de importar el archivo completo (no uno parcial).

### "El archivo no tiene la columna 'nombre'"

El sistema acepta varias variaciones: "nombre", "nombre_cliente", "cliente", "name". Si la columna tiene otro nombre, renombrarla en el Excel antes de importar.

### "Quiero cargar datos de prueba para ver como funciona"

Desde la terminal, ejecutar:
```bash
pnpm db:seed
```
Esto carga 4 clientes de ejemplo con diferentes situaciones de deuda.

---

## 12. Glosario

| Termino | Significado |
|---|---|
| **Ramito** | Recibo de entrega/cobro. Comprobante de que se paso a cobrar al cliente. |
| **Factura** | Comprobante de facturacion. |
| **Periodo de pago** | Mes/año que un documento cubre (ej: Enero 2026). Se extrae de la descripcion. |
| **Nombre normalizado** | El nombre del cliente limpio, sin anotaciones ni datos extras. Es la clave para vincular entre archivos. |
| **Fecha de alta** | Fecha en que el cliente empezo a recibir servicio. Desde ahi se calcula la deuda. |
| **Meses obligatorios** | Todos los meses desde la fecha de alta hasta hoy (o hasta el mes anterior si estamos antes del dia 16). |
| **Meses pagados** | Los meses que tienen al menos un periodo de pago registrado. |
| **Meses adeudados** | Meses obligatorios que no tienen pago registrado. |
| **Requiere corte** | El cliente tiene mas de 2 meses de deuda. |
| **Tasa de morosidad** | Porcentaje de clientes activos que tienen al menos 1 mes de deuda. |
| **Preview** | Vista previa del contenido de un archivo Excel antes de importarlo. |
| **Pisar** | Borrar todos los registros existentes de un tipo y reemplazarlos por los del nuevo archivo. |
