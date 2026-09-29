# Portal de mantenimiento — Resiter Minería

Portal local con página de inicio y acceso a los paneles. Conserva el estilo visual de `Panel_PUMA.html`. Reportabilidad consulta a Python, que lee los Excel en cada consulta sin modificarlos.

## Archivos

- `Iniciar_Panel.bat`: activa `venv_mtto`, comprueba las dependencias y ejecuta el servidor Python.
- `venv_mtto/`: entorno virtual de Python que utiliza el panel.
- `Panel.html`: página inicial con acceso a los paneles, disponible también en `/`.
- `Panel_Reportabilidad.html`: estructura HTML del panel de reportabilidad, con semáforo y configuraciones.
- `panel.css`: estilos compartidos del portal y sus paneles.
- `reportabilidad.js`: lógica de consultas, semáforo, filtros, selección de CeCo y exportación CSV.
- `Panel_Seguimiento_KM_HR.html`: panel de próximas mantenciones según kilometraje y horómetro.
- `seguimiento_km_hr.js`: tabla semanal, filtros, gráficos por patente y exportación CSV de KM-HR.
- `seguimiento_km_hr.py`: cruce del maestro con reportes semanales, saldo, estado y fecha proyectada.
- `Panel_Resumen_Mantencion.html`: panel independiente del resumen por región/CeCo, con configuración de regiones y STAND BY.
- `Panel_Calendario_Mantencion.html`: panel independiente del calendario mensual, tabla de patentes y descargas por región.
- `mantenciones.js` y `mantenciones.css`: lógica y estilos compartidos por Resumen y Calendario, sin combinar sus páginas.
- `calendario_descarga.js`: genera el informe descargable con calendario y tabla de patentes de una región.
- `Panel_Mantenciones.html`: acceso de compatibilidad con enlaces a los dos paneles nuevos.
- `reportabilidad.py`: servidor local y cálculo de reportabilidad.
- `PruebaForm.xlsx`: fuente de formularios.
- `BD ACTIVOS MOBILES.xlsx`: clasificación de CeCo por región actual.
- `requirements.txt`: dependencia Python.

## Inicio en Windows con doble clic

1. Mantén el `.bat`, los dos módulos Python (`reportabilidad.py` y `seguimiento_km_hr.py`), todos los HTML, CSS y JavaScript del portal, `requirements.txt`, los dos Excel y la carpeta `venv_mtto` dentro de esta misma carpeta.
2. Haz doble clic en **Iniciar_Panel.bat**. El archivo se ubica automáticamente en la carpeta del proyecto y activa **venv_mtto**.
3. Si falta `openpyxl`, el archivo te avisa y se detiene. Abre PowerShell en esta carpeta, ejecuta `.\venv_mtto\Scripts\python.exe -m pip install -r requirements.txt` y vuelve a hacer doble clic en el `.bat`. Esta instalación necesita acceso a Internet y se realiza **dentro de venv_mtto**.
4. Espera el mensaje **Panel disponible en http://127.0.0.1:8765**.
5. Abre <http://127.0.0.1:8765> en tu navegador. En el inicio selecciona **Reportabilidad**, elige la fecha y pulsa **Consultar Excel**. El enlace **Inicio** permite volver a la portada; también puedes pasar de un panel a otro desde la navegación superior.
6. Mantén la ventana del `.bat` abierta mientras trabajas. Para detener el servidor pulsa `Ctrl+C`; si Windows pregunta si deseas terminar el trabajo por lotes, confirma con `S`.

El `.bat` utiliza explícitamente `venv_mtto\Scripts\python.exe`, por lo que no depende de otro Python activo. El navegador se abre manualmente. No inicies varias copias del servidor en el mismo puerto.

### Preparación del entorno, solo si no existe

Necesitas Python 3.10 o superior instalado. Si `venv_mtto` ya existe y funciona, omite estos pasos. Si falta, abre PowerShell en la carpeta del proyecto y ejecuta:

```powershell
py -m venv venv_mtto
.\venv_mtto\Scripts\python.exe -m pip install -r requirements.txt
.\Iniciar_Panel.bat
```

Los entornos virtuales no deben trasladarse desde otro equipo: créalos en la ubicación final del proyecto. Si el entorno existente está dañado, conserva una copia renombrándolo antes de crear uno nuevo llamado `venv_mtto`.

### Ejecución manual alternativa en CMD

Desde una ventana de **Símbolo del sistema (CMD)** ubicada en esta carpeta:

```bat
call venv_mtto\Scripts\activate.bat
python -m pip install -r requirements.txt
python reportabilidad.py
```

Para ejecutar desde PowerShell sin cambiar su política de ejecución, usa `.\Iniciar_Panel.bat` o `.\venv_mtto\Scripts\python.exe reportabilidad.py`.

Abrir el HTML con doble clic muestra instrucciones, pero no permite consultar Python.

Selecciona la fecha y pulsa **Consultar Excel**. Para actualizar los datos, guarda y sincroniza el Excel y vuelve a consultar. El servidor lee la copia local disponible, no descarga datos de Microsoft Forms ni fuerza la sincronización de SharePoint/OneDrive. Si Excel impide la lectura, cierra el libro y reintenta.

Puedes indicar otros archivos o puerto:

```powershell
.\Iniciar_Panel.bat --excel "C:\Datos\PruebaForm.xlsx" --maestro "C:\Datos\BD ACTIVOS MOBILES.xlsx" --puerto 8766
```

En ese caso abre <http://127.0.0.1:8766>. Solo se escucha en este equipo (`127.0.0.1`).

### Si no inicia

- **Servidor anterior o incompatible / error toLocaleString / NaN:** el HTML se actualizó, pero sigue ejecutándose el Python anterior. Detén la ventana del servidor con `Ctrl+C`, ejecuta de nuevo `Iniciar_Panel.bat` y recarga con `Ctrl+F5`. No basta con recargar el navegador: Python necesita reiniciarse. El panel verifica la versión de los datos antes de mostrar resultados.
- **No se encontró venv_mtto:** crea el entorno con los pasos anteriores.
- **Error al instalar dependencias:** revisa la conexión a Internet y los permisos de tu equipo; vuelve a ejecutar el `.bat`.
- **Puerto en uso / WinError 10048:** detén la ventana anterior del panel o inicia con `.\Iniciar_Panel.bat --puerto 8766`.
- El servidor reserva el puerto para una sola instancia. La consola indica **Reporte v2** al iniciar. Si el aviso persiste después de reiniciar, puede quedar otro proceso anterior activo en una ventana distinta.
- **No se pudo leer el Excel:** verifica que los archivos estén disponibles localmente y sincronizados; si están bloqueados por Excel, ciérralos y reintenta.
- **La página no responde:** confirma que la ventana del `.bat` siga abierta y que estés usando la URL y puerto indicados en ella.

## Semáforo y configuración
 
Esta sección corresponde al panel **Reportabilidad**; KM-HR tiene sus propios estados e intervalos.

El semáforo utiliza el porcentaje sin redondear: **verde desde 90%**, **amarillo desde 75% hasta menos de 90%** y **rojo por debajo de 75%**. Si el total de referencia es cero, aparece en gris como **Sin base**. Se aplica a cada CeCo, los subtotales de región y el total general. El CSV incluye el nombre del semáforo.

En la pestaña **Configuraciones**, marca o desmarca las regiones y CeCo que se deben contar. Los cambios son inmediatos y afectan tanto las patentes reportadas como el total del maestro y los porcentajes. Al excluir una región se excluyen todos sus CeCo; al volver a incluirla se respetan sus selecciones individuales. **Incluir todos** restablece toda la selección y **Excluir todos** deja el reporte sin centros incluidos.

La selección se guarda en este navegador y dirección del panel. Se conserva al recargar o cambiar de fecha; otro navegador, puerto o equipo tiene su propia configuración. Los nuevos CeCo aparecen incluidos por defecto, salvo que su región esté excluida. Borrar los datos del navegador elimina la selección guardada. Si el navegador bloquea el guardado, se muestra un aviso y los cambios solo duran la sesión actual.

Los filtros de búsqueda y región se aplican además de la configuración. El CSV exporta solo el detalle incluido y visible. Los avisos generales de calidad siguen correspondiendo al archivo consultado.

## Seguimiento KM-HR: próximas mantenciones

En el inicio, abre **Seguimiento KM-HR**. La semana 1 comienza por defecto el **01-09-2026**; las siguientes referencias son 08-09, 15-09, 22-09, etc. Puedes cambiar la fecha de semana 1 y la fecha hasta la que se generan referencias semanales (máximo 104 semanas).

Cada semana busca en PruebaForm desde **tres días antes hasta un día después**, ambos incluidos, usando **Hora de finalización**. Por ejemplo S1 considera del 29-08 al 02-09 y S4 del 19-09 al 23-09. La última ventana incluye el día posterior aunque sea posterior al campo «Semanas hasta». No es un filtro estricto de conocimiento histórico a esa fecha.

El maestro define la lista de equipos: una fila por patente distinta. No se agregan patentes ajenas al maestro. Las repeticiones idénticas se consolidan; si hay datos diferentes para una misma patente se muestra REVISAR y se conservan visibles los datos de su primera fila. El cruce utiliza patentes normalizadas por mayúsculas, espacios, puntos y guiones.

Para cada patente y semana se elige el reporte con **Hora de finalización más reciente**; en empate, la última fila de PruebaForm. La celda muestra el valor de `Kilometraje actual (km)` o `Horómetro actual (hrs)` de acuerdo con `Unidad de Control del equipo`, junto con la unidad y fecha de lectura. Si falta la unidad declarada se usa `UN UM` del maestro y se indica; si falta la fecha de lectura se utiliza el día de envío y se indica. Al pasar el cursor se ve también la fila de origen. Una semana sin reporte queda **—**, no cero, y no se rellena con la semana anterior.

Se toman directamente del maestro:

| Columna | Uso |
| --- | --- |
| KM U HR UM | Lectura en la que se realizó la última mantención |
| UN UM | Unidad de esa lectura, KM o HR |
| FECHA UM | Fecha de última mantención |
| INTERVALO | Frecuencia de mantención en KM o HR |
| UN IN | Unidad del intervalo; debe coincidir con UN UM |

Los intervalos antiguos guardados en el navegador ya no se utilizan. Las actualizaciones de mantención de PruebaForm tampoco reemplazan estos campos del maestro. Este maestro refleja su estado actual; no contiene un historial de las mantenciones anteriores.

**Próxima mantención = KM U HR UM + INTERVALO. SALDO = próxima mantención − última lectura semanal disponible.** Se identifica la semana y la fecha de la lectura usada. Si una semana posterior contiene un reporte inválido, se muestra REVISAR en lugar de retroceder silenciosamente a un reporte válido anterior.

| Estado | Condición | Color |
| --- | --- | --- |
| Mantención Vigente | SALDO ≥ INTERVALO × 0,1 | Verde |
| Próxima a vencer | −INTERVALO × 0,1 ≤ SALDO < INTERVALO × 0,1 | Amarillo |
| Mantención Vencida | SALDO < −INTERVALO × 0,1 | Rojo |
| REVISAR | Datos faltantes, unidad incompatible, lectura anterior a UM, retroceso de medidor u otra inconsistencia indicada | Gris |

Se respetan los límites de la fórmula entregada: exactamente +10% es verde y exactamente −10% es amarillo. Si solo falta el reporte, puede mostrarse el objetivo UM + intervalo, pero no se inventa el saldo ni un estado favorable. Las fechas nativas de Excel se interpretan tal como están almacenadas; los textos de fecha se interpretan como día/mes/año. No se corrigen automáticamente fechas UM futuras.

### Gráficos y fecha proyectada

Selecciona una patente en el gráfico o pulsa su nombre en la tabla. Se muestran la lectura por semana, la línea del objetivo de próxima mantención y el consumo diario entre lecturas. Los huecos se mantienen visibles; el consumo entre dos observaciones abarca sus días reales aunque falten semanas intermedias. Valores con otra unidad no se mezclan en el gráfico.

**Uso diario = (última lectura − primera lectura) / días reales entre sus fechas. Fecha proyectada = fecha de última lectura + redondeo hacia arriba de (SALDO / uso diario).** La estimación usa las lecturas semanales del período seleccionado. No es una fecha comprometida ni prueba de una mantención realizada. Si el objetivo ya fue alcanzado, puede resultar una fecha pasada, marcada como estimada. Cambiar el período puede cambiar el ritmo estimado y la proyección.

Se necesitan dos lecturas válidas, avance de fechas y consumo positivo. Si hay descenso del medidor, unidad incompatible, datos de mantención incompletos o consumo cero, no se proyecta y se muestra el motivo. El saldo usa la última lectura disponible, no una lectura extrapolada al día de hoy.

La búsqueda, región y estado filtran tabla, indicadores, selector de gráficos y CSV. La configuración de inclusión del panel Reportabilidad es independiente y no filtra KM-HR. El CSV conserva los valores semanales y los campos de cálculo.

## Organización de páginas y recursos

### Reporte de mantención y Calendarización

El inicio tiene cuatro paneles con archivos y direcciones independientes: **Reportabilidad**, **Seguimiento KM-HR**, **Resumen de mantención** y **Calendario de mantención**. Resumen y Calendario tienen cada uno su sección desplegable **Configuraciones**. Comparten los cálculos y período semanal de Seguimiento KM-HR: define semana 1 y la última fecha de referencia, y pulsa **Consultar Excel**. Cada patente del maestro se cuenta una sola vez. Las regiones incluidas y la definición de STAND BY se mantienen compartidas entre Resumen y Calendario mediante el almacenamiento del navegador; se recuperan al cargar la página.

El resumen agrupa **región → CeCo**, con columnas de mantención vencida, próxima a vencer, vigente, STAND BY, REVISAR y total. Las primeras tres categorías usan la fórmula de saldo del panel KM-HR. Los subtotales y el total general se recalculan según las regiones incluidas.

**STAND BY:** se obtiene de `Status actual del equipo` del último reporte elegido en las ventanas semanales. En **Configuraciones** puedes elegir qué estados deben equivaler a STAND BY; la lista muestra los estados encontrados y sus cantidades. Inicialmente solo se reconocen los textos explícitos `STAND BY`, `STANDBY` y `STAND-BY`. El Excel recibido no contiene esos valores literales, por lo que inicialmente puede haber cero STAND BY. No se asume que «Fuera de servicio», «En Mantención» o «En proceso de traspaso» signifiquen STAND BY: selecciona los que correspondan a tu criterio. Los vacíos no se convierten en STAND BY.

STAND BY tiene prioridad en el resumen sobre la clasificación de saldo, de modo que un equipo no se cuente dos veces. El cálculo de mantenimiento original se conserva en KM-HR. El detalle de patentes del resumen muestra estado operativo, fecha de reporte y motivo de revisión para comprobar el origen.

El indicador **% no vencidas** equivale a `(vigentes + próximas + STAND BY) / (total − REVISAR) × 100`. Coincide con la proporción de la imagen cuando no hay casos REVISAR. No mide exclusivamente el estado verde; se etiqueta como «no vencidas» para evitar esa confusión. Si no hay equipos clasificables, se muestra —. Los casos REVISAR sí permanecen en el total general.

En **Configuraciones**, desmarca las regiones que no quieres incluir. La selección se aplica al resumen, calendario y sus CSV; se guarda en el navegador, de forma independiente de la configuración de Reportabilidad. «Incluir todas» y «Excluir todas» permiten cambiar la selección completa.

En **Calendario de mantención**:

1. Elige el mes de mantención y, opcionalmente, una región entre las incluidas.
2. Solo aparecen patentes cuya **fecha proyectada** esté dentro de ese mes. Elegir otro mes no modifica el período de lecturas usado para estimar las fechas.
3. Los días con mantenciones aparecen destacados con la cantidad de patentes. Pulsa un día para ver su detalle, o **Ver todo el mes** para volver a la agenda completa.
4. La agenda se agrupa por región y muestra patente, CeCo, unidad KM/HR, fecha proyectada, lectura objetivo y estado.
5. **Descargar tabla CSV** exporta el mes y región elegidos, incluso si el detalle está filtrado por un día. Incluye fechas ISO (`aaaa-mm-dd`) para ordenar y filtrar en Excel.
6. Para descargar **el calendario junto con la tabla de patentes de una región**, elige una región específica y pulsa **Descargar calendario + tabla de la región (HTML)**. El archivo incluye el calendario mensual con días destacados y una tabla completa con fecha proyectada, patente, región, CeCo, unidad, próxima mantención y estado. Incluye todo el mes, aunque se esté viendo un solo día. Si no hay eventos, conserva el calendario y señala que no hay mantenciones proyectadas.
7. Abre ese archivo HTML sin conexión o compártelo. Es autónomo y no necesita el servidor ni archivos CSS/JS adicionales. Puedes usar **Imprimir** en el navegador para imprimirlo o guardarlo como PDF: el calendario y la tabla tienen formato de impresión. La descarga directa es HTML; el CSV conserva la tabla como datos sin colores.

Los equipos sin fecha calculable se omiten del calendario y se informa su cantidad. No se rellenan fechas para equipos sin datos. Las proyecciones no son órdenes de trabajo confirmadas. Si un equipo STAND BY conserva una proyección de uso válida, se incluye con esa etiqueta; revisa su fecha si su utilización cambió. El resumen también se puede descargar en CSV, con una columna «Tipo» que distingue detalle CeCo, subtotales de región y total general.

`Panel.html` es la portada, servida también en `/`. `Panel_Reportabilidad.html` conserva el nombre existente; la ruta `/Panel_repostabilidad.html` también abre ese panel. Cada HTML carga `panel.css`; Reportabilidad y KM-HR cargan sus propios archivos JavaScript. No hace falta JavaScript en la portada. El servidor publica únicamente las páginas y recursos declarados en `ARCHIVOS_WEB`, no los Excel ni el código Python.

Para habilitar esta nueva estructura, detén el servidor con **Ctrl+C**, vuelve a ejecutar **Iniciar_Panel.bat** y abre <http://127.0.0.1:8765>. Recarga con **Ctrl+F5**. El reinicio es necesario porque ahora Python sirve nuevas páginas, CSS, JavaScript y la API KM-HR.

## Regla de conteo

Para una fecha **D**, se buscan los reportes cuya **Hora de finalización** esté entre **D − 3 días** y **D + 1 día**, ambos incluidos. Son cinco días calendario completos. Por ejemplo, el 22-09-2026 consulta desde el 19-09-2026 a las 00:00 hasta el final del 23-09-2026. Se interpreta la fecha registrada en Excel, sin conversión de zona horaria. El reporte muestra la fecha elegida y un resultado consolidado, **sin columnas diarias**.

Se cuentan **patentes distintas por CeCo**, usando `PATENTE` de PruebaForm. Una patente repetida en varios formularios o días del período cuenta una sola vez dentro del mismo CeCo. No se filtra por tipo de formulario. Los valores vacíos, `REVISAR`, `-`, `N/A`, `NA`, `SIN PATENTE` y `NO APLICA` se excluyen y se informan. No se intenta reconstruir esos valores a partir de otras columnas. Se normalizan mayúsculas, tildes, espacios, puntos y guiones para reconocer repeticiones.

La comparación utiliza estas columnas:

| Columna | Cálculo |
| --- | --- |
| Reportadas | Patentes distintas del CeCo encontradas en el período |
| % respecto del total | Reportadas ÷ total de patentes del CeCo × 100 |
| Total patentes | Patentes distintas de `BD ACTIVOS MOBILES.xlsx`, agrupadas por `NOMBRE CeCo ACTUAL` |

El total del maestro no se filtra por fecha. Usa su asignación actual de CeCo, incluye registros con región vacía y elimina patentes repetidas dentro del mismo CeCo. Si el total es cero, el porcentaje aparece como **—**, no como 0%. Los CeCo del maestro aparecen aunque tengan cero reportes.

Las patentes reportadas fuera del maestro del CeCo se mantienen en Reportadas y se señalan bajo el nombre del CeCo. Por ello el porcentaje puede superar 100%: compara cantidades, no mide la coincidencia exacta entre ambas listas. No se limita ni se altera el resultado para aparentar cumplimiento.

Los subtotales de región y el total general suman los conteos por CeCo; los porcentajes se calculan dividiendo esas sumas, no promediando porcentajes. Si una patente aparece en distintos CeCo, cuenta una vez en cada uno. Las tarjetas y el CSV responden a los filtros visibles; contraer una región no elimina sus registros del total.

Se utiliza la primera hoja cuya primera fila contenga las columnas requeridas. Se admiten fechas nativas de Excel, números de serie, fechas ISO y textos `dd/mm/aaaa` o `dd-mm-aaaa`, con hora opcional. Las fechas vacías o inválidas se excluyen y se informa cuántas hay en el archivo completo.

## Clasificación por región

1. Se cruza `CeCo (Centro de costo)` de PruebaForm con `NOMBRE CeCo ACTUAL` del maestro y se toma `REGION ACTUAL`. Los nombres se normalizan por mayúsculas, espacios y tildes.
2. Se usa una región única por CeCo para mantener juntas las patentes del maestro y las reportadas. Los valores válidos de región comienzan con `REGION `.
3. Si no existe una región válida, aparece **SIN REGIÓN**. Si el maestro asigna varias regiones al mismo CeCo, también se muestra **SIN REGIÓN** y una advertencia. No se adivinan asignaciones.
4. Los CeCo vacíos aparecen como **SIN CECO**, dentro de **SIN REGIÓN**. No se infieren desde la patente.

La columna REGION del archivo recibido contiene vacíos y valores como `Hrs` y `Kms`, por eso la clasificación utiliza el maestro. Refleja su estado actual; no reconstruye regiones históricas. Si el maestro falta o no contiene las columnas requeridas, la consulta falla con un aviso: no se inventa el total para la comparación.

**SIN REGIÓN** y **SIN CECO** se incluyen en los conteos de patentes; SIN CECO no se considera un centro identificado en la tarjeta de centros de costo.

## Alcance respecto de la imagen

Se reproduce la jerarquía **región → CeCo**, con **Reportadas | % respecto del total | Total patentes**. Los días anteriores y posterior solo se utilizan internamente para buscar reportes; no se desglosan en la tabla ni en el CSV.

Los avisos de calidad corresponden al período completo (salvo las fechas inválidas del archivo y las patentes inválidas del maestro), aunque se apliquen filtros visuales.

Después de actualizar los archivos del panel, detén el servidor anterior con `Ctrl+C`, vuelve a ejecutar **Iniciar_Panel.bat** y recarga la página para utilizar la nueva lógica.
