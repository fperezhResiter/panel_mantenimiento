# Portal de mantenimiento — Resiter Minería

Portal local con página de inicio y acceso a los paneles. Los reportes consultan una BD SQLite; Python recarga sus datos desde los Excel sin modificarlos.

## Dos formas de uso y publicación

- **Consulta:** abre `Panel.html` con doble clic. No requiere Python ni servidor. Permite consultar los cinco paneles, cambiar períodos y filtros, explorar gráficos y descargar CSV y PDF. Usa la fecha y los datos de la última publicación. No guarda cambios en la BD; Configuraciones solo está disponible en el modo interactivo.
- **Uso interactivo:** ejecuta `Iniciar_Panel.bat` y abre la URL indicada. Permite guardar las configuraciones en la BD propia.
- **Actualización:** la persona encargada ejecuta `Actualizar_BD.bat` en esta carpeta. Importa Excel a `Datos/mantenimiento.sqlite3` y genera `web/datos/publicacion.js`. Conserva las configuraciones y las demás tablas de registros guardados. La fecha de actualización aparece en todas las vistas.

Comparte y sincroniza la carpeta completa mediante SharePoint/OneDrive, incluidos `Datos` y `web/datos`. Esta BD es independiente de Codelco y de los demás proyectos. Coordina las escrituras y actualizaciones para que no coincidan; SQLite y OneDrive no ofrecen escritura distribuida simultánea.

El Panel Universal debe tener un único acceso relativo a esta carpeta, dirigido a `panel_mantenimiento/Panel.html` (ajustar el prefijo a su ubicación). Mantenimiento conserva sus vistas internas y sus propios BAT. La portada Universal está en `../../Panel Universal.html`; su catálogo tiene un único acceso a Mantenimiento, marcado como consulta sin servidor. El catálogo base conserva esta selección al regenerarlo.

La publicación precalcula los mismos resultados Python para las semanas de Reportabilidad hasta la fecha publicada y los intervalos de columnas de Seguimiento de hasta 104 semanas. Permite elegir cualquier fecha que seleccione esas columnas. Los meses sin lecturas informan que no hay datos; los meses sin programación muestran cero. Los cambios de Excel requieren actualizar la BD. Guardar Configuraciones actualiza las preferencias de la publicación sin recalcular los datos; recarga las consultas sin servidor para leerlas. Requiere una versión reciente de Edge, Chrome o Firefox con `DecompressionStream`; todas las bibliotecas de descarga son locales. El tamaño y el tiempo de publicación crecen con la cantidad de columnas de lectura.

## Agrupación por zona

Los cinco paneles incluyen el botón **Modo zona** junto a **Volver al inicio**. Activa la agrupación por zona, unidad y línea. El botón cambia a **Modo región** para volver a la vista por región; el filtro muestra **Zona** o **Región** según el modo activo. El modo región sigue disponible; la elección se recuerda en el navegador. El filtro de línea se combina con la zona y la unidad. Tablas, tarjetas, gráficos y descargas usan la agrupación seleccionada; los porcentajes se recalculan desde las cantidades correspondientes.

El catálogo `config/unidades_zonas.json` asocia unidad, centro de costo, zona y líneas a partir de la hoja `Prog Resiter` de `Datos GDM ADC y CC Minería 230926.xlsx`. Conserva 4A, 4B, 8A y 8B y las filas de origen, sin datos de contacto. Las gerencias y jefaturas sin contratos se excluyen del catálogo. El CeCo actual permite distinguir unidades con el mismo nombre en distintas zonas; LN se obtiene del maestro de activos por patente y unidad actual. Si una patente histórica ya no coincide con esa unidad, la zona se resuelve con el CeCo único conocido de la unidad reportada; no se copia la línea de otra patente. Los casos ambiguos o sin datos se conservan como **SIN ZONA / SIN LÍNEA**, sin repartir ni duplicar equipos. Las exclusiones de regiones y unidades de Configuraciones se aplican antes de agrupar por zona. Las zonas desmarcadas solo se ocultan en el modo zona.

**Actualizar BD** y **Actualizar_BD.bat** leen automáticamente el catálogo de `06. Mantenimiento/Datos GDM ADC y CC Minería 230926.xlsx`, junto con el libro de equipos. Guarda y sincroniza ambos Excel antes de actualizar. La carga regenera `config/unidades_zonas.json` y la publicación sin servidor; las consultas utilizan la asociación de esa misma carga guardada en SQLite.

Se conservan los alias confirmados y sus nombres de línea, como **CMP VALLE COPIAPO ASEO → VALLE COPIAPO → ASEO**. La zona y el centro de costo se renuevan desde el Excel. Si algún archivo falta, cambia durante la lectura o falla la publicación, se conservan la BD, el catálogo JSON y la publicación anteriores.

Para usar otra ruta, configura `LIBRO_ZONAS` en `config/.env` o pasa `--zonas "C:\Datos\Catálogo GDM.xlsx"` tanto al servidor como al actualizador. La opción de línea de comandos tiene prioridad sobre la variable. Reinicia el servidor después de cambiar su ruta. También existe una importación manual del JSON:

```powershell
python -B scripts/importar_zonas.py "C:\Datos\Datos GDM ADC y CC Minería.xlsx"
```

La importación manual solo genera el JSON. Para actualizar los paneles y la consulta sin servidor, usa **Actualizar BD**, que vuelve a leer el Excel GDM configurado. Comparte el JSON y la carpeta completa del proyecto.

```text
panel_mantenimiento/
  Iniciar_Panel.bat
  Iniciar_Primera_Vez.bat
  manual_usuario.md
  Panel.html
  README.md
  app/                     Servidor, API y cálculos de los reportes
  config/
    .env.example           Plantilla de la ruta local del Excel
    requirements.txt       Dependencias Python
  scripts/
    reportabilidad.py      Punto de entrada del servidor
  MAC/
    Iniciar_Panel_MAC.command
    Iniciar_Primera_vez_MAC.command
  tests/                   Pruebas Python y JavaScript
  web/
    pages/                 Páginas de los paneles
    css/                   Estilos compartidos
    js/                    Lógica de los paneles
```

Los archivos `.gitignore` se encuentran dentro de las carpetas que contienen configuración local o archivos generados. Conserva las carpetas completas al copiar el proyecto.

## Inicio en Windows con doble clic

1. Instala Python 3.10 o superior con el lanzador `py` o Python en PATH.
2. La primera vez, ejecuta **Iniciar_Primera_Vez.bat**. Necesita Internet, actualiza pip, instala `config/requirements.txt` y verifica las dependencias y la carga del servidor.
3. Cuando indique **Preparación completada**, ejecuta **Actualizar_BD.bat** para crear la base y luego **Iniciar_Panel.bat**. Este es el archivo para el uso diario.
4. Espera el mensaje **Panel disponible en http://127.0.0.1:8765**.
5. Abre <http://127.0.0.1:8765> para el uso interactivo. **Panel.html** con doble clic abre siempre la consulta sin servidor.
6. Mantén la ventana del `.bat` abierta mientras trabajas. Para detener el servidor pulsa `Ctrl+C`; si Windows pregunta si deseas terminar el trabajo por lotes, confirma con `S`.

Los lanzadores utilizan Python 3.10 o superior instalado en el equipo y funcionan aunque se ejecuten desde otra carpeta. No inicies varias copias del servidor en el mismo puerto.

## Inicio en Mac

1. Instala Python 3.10 o superior, disponible como `python3`.
2. La primera vez, abre `MAC/Iniciar_Primera_vez_MAC.command` para preparar las dependencias.
3. Para el uso diario, abre `MAC/Iniciar_Panel_MAC.command`.
4. Espera **Panel disponible** y abre la URL indicada para el modo interactivo. Mantén la terminal abierta y usa `Control+C` para detener el servidor.

Los `.command` cambian a la carpeta principal antes de instalar o iniciar. Si el sistema exige permiso de ejecución, desde la carpeta del proyecto ejecuta `chmod +x MAC/*.command`.

## Ejecución manual alternativa

Desde PowerShell, en la carpeta del proyecto:

```powershell
python -m pip install -r config/requirements.txt
python -B scripts/reportabilidad.py
```

En Mac, usa `python3` en lugar de `python`. También puedes indicar otros archivos o puerto con el lanzador:

```powershell
.\Iniciar_Panel.bat --excel "C:\Datos\Control.xlsx" --maestro "C:\Datos\Control.xlsx" --puerto 8766
```

En ese caso abre <http://127.0.0.1:8766>. Abrir `Panel.html` con doble clic utiliza la última publicación sin servidor. Solo se escucha en este equipo (`127.0.0.1`).

Selecciona la fecha y pulsa **Consultar BD**. Para actualizar los datos, guarda y sincroniza el Excel y pulsa **Actualizar BD** o ejecuta **Actualizar_BD.bat**. El servidor lee la copia local disponible, no descarga datos de Microsoft Forms ni fuerza la sincronización de SharePoint/OneDrive. Si Excel impide la lectura, cierra el libro y reintenta.

### Ruta local del Excel

Copia `config/.env.example` como `config/.env` y completa `LIBRO_EQUIPOS` con la ruta absoluta del Excel entre comillas simples:

```dotenv
LIBRO_EQUIPOS='C:\Datos\Control de Equipos Móviles – Minería.xlsx'
```

`config/.env` está excluido de Git. Una variable de entorno del sistema `LIBRO_EQUIPOS` tiene prioridad sobre ese archivo, y los argumentos `--excel` y `--maestro` tienen prioridad sobre ambos. Reinicia el servidor después de cambiar la configuración. El servidor no publica la configuración ni el código Python.

Si la variable está vacía, se conserva la ruta predeterminada calculada desde `app/servidor.py`: `Path(__file__).resolve().parents[4] / "06. Mantenimiento" / "Forms" / "Control de Equipos Móviles – Minería.xlsx"`. Esta alternativa depende de conservar la ubicación del proyecto dentro de la carpeta de documentos.

### Problemas frecuentes

- **Python no encontrado:** instala Python 3.10 o superior y agrégalo al PATH.
- **Faltan dependencias:** ejecuta `Iniciar_Primera_Vez.bat` o `MAC/Iniciar_Primera_vez_MAC.command`.
- **Error al instalar dependencias:** revisa la conexión a Internet y los permisos del equipo.
- **Puerto en uso:** detén la instancia anterior o inicia con `--puerto 8766` y abre la URL indicada.
- **No se pudo leer el Excel:** comprueba la ruta en `config/.env`, la disponibilidad local del archivo y la sincronización.
- **La página no responde:** comprueba que la ventana del servidor siga abierta y estés usando su puerto.
- **Los cambios del código no aparecen:** detén el servidor con `Ctrl+C`, vuelve a iniciarlo y recarga con `Ctrl+F5`.

## Semáforo y configuración
 
Esta sección corresponde al panel **Reportabilidad**; KM-HR tiene sus propios estados e intervalos.

El semáforo utiliza el porcentaje sin redondear: **verde desde 90%**, **amarillo desde 75% hasta menos de 90%** y **rojo por debajo de 75%**. Si el total de referencia es cero, aparece en gris como **Sin base**. Se aplica a cada CeCo, los subtotales de región y el total general. El CSV incluye el nombre del semáforo.

En **Configuraciones**, cada región tiene una casilla y sus unidades debajo. Desmarcar una región oculta todas sus unidades en los cinco paneles; desmarcar una unidad la oculta en todo el portal. Los filtros afectan gráficos, tablas, totales, porcentajes, historial y descargas. Al volver a incluir una región se conservan las exclusiones individuales de unidades. **Incluir todas** y **Excluir todas** cambian las casillas de los grupos, conservando la selección de unidades. El botón **Modo zona** cambia la agrupación a zona y unidad; las zonas excluidas solo afectan las vistas por zona.

La selección se guarda en la BD propia de Mantenimiento y se conserva al actualizar las fuentes. Las configuraciones solo se modifican en el uso interactivo. Cada guardado actualiza también la configuración de la publicación sin servidor. Recarga o vuelve a abrir los paneles de consulta para leer los cambios. Los nuevos CeCo aparecen incluidos por defecto, salvo que su región esté excluida.

Los filtros de búsqueda y región se aplican además de la configuración. El CSV exporta solo el detalle incluido y visible. Los avisos generales de calidad siguen correspondiendo al archivo consultado.

## Seguimiento KM-HR: próximas mantenciones

El portal usa el libro configurado mediante `LIBRO_EQUIPOS` en `config/.env` o la ruta relativa predeterminada:

- `Sheet1`: formularios para Reportabilidad.
- `BD ACTIVOS MOVILES`: clasificación y base de activos para Reportabilidad.
- `Seguimiento KM-HR`: equipos, lecturas, última mantención, intervalo y STATUS EQUIPO para Seguimiento, Resumen y Calendario.

Las columnas con fecha, de texto o fechas nativas de Excel, se ordenan y filtran entre las fechas elegidas. No se aplican ventanas ADC a estas columnas. Ceros y celdas vacías representan semanas sin reporte. Los datos inválidos y retrocesos se marcan No operativo. El CeCo actual se obtiene de la columna sin título inmediatamente después de REGION ACTUAL; si falta, se busca una ubicación única en el maestro. No se sustituye por el CeCo AF.

La hoja aporta KM U HR UM, UN UM, FECHA UM, INTERVALO y UN IN. El portal calcula próxima mantención = UM + intervalo, saldo = próxima mantención − última lectura, y el semáforo con los límites de ±10% del intervalo. No usa los resultados de PROX.MANT, SALDO, STATUS MANTENCION, SEMAFORO, DURACION ni FECHA PROYECTADA del Excel.

Uso diario = (última lectura − primera lectura) / días entre las fechas de esas columnas. Fecha proyectada = fecha de última lectura + saldo / uso diario, redondeando días hacia arriba. Con menos de dos lecturas válidas, consumo no positivo, retrocesos, unidades incompatibles o datos de mantención incompletos, no se proyecta. El estado del equipo y la última mantención reflejan el estado actual de la hoja; no se inventa una fecha de actualización del estado.

Las fórmulas del Excel se importan por su último valor guardado. Guarda y sincroniza el libro antes de actualizar la BD; el portal no recalcula ni modifica el archivo. Reinicia Iniciar_Panel.bat y recarga con Ctrl+F5 tras cambiar el código.

## Organización de páginas y recursos

### Reporte de mantención y Calendarización

El inicio tiene cinco paneles con archivos y direcciones independientes: **Reportabilidad**, **Seguimiento KM-HR**, **Resumen de mantención**, **Calendario de mantención** y **Programa Mantención**. Las configuraciones se administran en el panel independiente **Configuraciones**. Comparten los cálculos de Seguimiento KM-HR. El Resumen abre en el mes actual y permite elegir el **mes de lecturas**, la **región** y el **CeCo**. Cambiar el mes consulta las columnas de fechas de ese mes y recalcula los estados; agosto de 2026 comienza el día 4. Región y CeCo filtran tarjetas, subtotales, total, detalle y CSV; la lista de CeCo depende de la región elegida. Si el mes no tiene columnas de lectura, se informa y no se permite exportar resultados anteriores. El Calendario conserva su selección de semana 1 y última fecha de referencia. Cada patente del maestro se cuenta una sola vez. Las regiones incluidas se mantienen compartidas entre Resumen y Calendario mediante la BD propia; la consulta sin servidor usa la configuración publicada.

El resumen agrupa **región → CeCo**, con columnas de mantención vencida, próxima a vencer, vigente, No operativo y total. Las primeras tres categorías usan la fórmula de saldo del panel KM-HR. Los subtotales y el total general se recalculan según las regiones incluidas.

**No operativo:** nuevo nombre de los casos antes marcados REVISAR. La clasificación es fija y no depende de STATUS EQUIPO ni de configuraciones guardadas.

El detalle de patentes conserva el estado operativo, la fecha de reporte y el motivo del caso.

El indicador **% no vencidas** equivale a `(vigentes + próximas) / (total − No operativo) × 100`. Los casos No operativo permanecen en el total general y se excluyen del porcentaje, conservando el tratamiento de los antiguos casos REVISAR. Si no hay equipos clasificables, se muestra —.

En **Configuraciones**, desmarca las regiones que no quieres incluir. La selección se aplica al resumen, calendario y sus CSV; se guarda en la BD, junto con Reportabilidad, Seguimiento KM-HR y Programa Mantención. «Incluir todas» y «Excluir todas» permiten cambiar la selección completa.

En **Calendario de mantención**:

1. Elige el mes de mantención y, opcionalmente, una región entre las incluidas.
2. Solo aparecen patentes cuya **fecha proyectada** esté dentro de ese mes. El calendario prioriza **FECHA PROYECTADA REAL** de **Seguimiento KM-HR** cuando contiene una fecha válida, incluso sin proyección calculable por uso. Si la columna no existe o la celda está vacía o es inválida, se usa la fecha calculada. Esta prioridad se aplica al calendario, la agenda y ambas descargas. Elegir otro mes no modifica el período de lecturas usado para estimar las fechas.
3. Los días con mantenciones aparecen destacados con la cantidad de patentes. Pulsa un día para ver su detalle, o **Ver todo el mes** para volver a la agenda completa.
4. La agenda se agrupa por región y muestra patente, CeCo, unidad KM/HR, fecha proyectada, lectura objetivo y estado. La columna **Incluir en publicación y descargas** aparece solo en el modo interactivo. Permite marcar o desmarcar cada patente; la selección se guarda en la BD y se conserva al recargar y actualizar Excel. Las patentes desmarcadas siguen visibles en el modo interactivo para poder volver a seleccionarlas. Tras ejecutar Actualizar_BD.bat, quedan fuera del calendario, la agenda y las descargas en la consulta sin servidor, donde no aparecen casillas.
5. **Descargar tabla CSV** exporta las patentes marcadas del mes y región elegidos, incluso si el detalle está filtrado por un día. Incluye fechas ISO (`aaaa-mm-dd`) para ordenar y filtrar en Excel.
6. Para descargar **el calendario junto con la tabla de patentes de una región**, elige una región específica y pulsa **Descargar calendario + tabla de la región (PDF)**. El archivo incluye el calendario mensual con días destacados y una tabla completa con fecha proyectada, patente, región, CeCo, unidad, próxima mantención y estado. Incluye solo las patentes marcadas de todo el mes, aunque se esté viendo un solo día. Si no hay eventos seleccionados, conserva el calendario y señala que no hay mantenciones proyectadas.
7. Abre el PDF sin conexión o compártelo. El calendario mensual completo ocupa la primera página y la tabla continúa en las siguientes. La descarga directa es PDF; el CSV conserva la tabla como datos sin colores.
8. Todos los paneles incluyen **Descargar PDF**, que genera un informe con el título del panel y el logo de Resiter, filtros escritos (fechas, regiones y CeCo), indicadores y tablas como texto seleccionable, y gráficos como figuras. Se omiten el encabezado de navegación y los controles del panel. Conserva las secciones ocultas y los detalles cerrados. Las tablas con desplazamiento se incluyen completas. Las bibliotecas PDF se sirven localmente desde `web/vendor`, sin conexión a Internet.

Los equipos sin fecha real válida ni fecha calculable se omiten del calendario y se informa su cantidad. No se rellenan fechas para equipos sin datos. Las proyecciones no son órdenes de trabajo confirmadas. Si un equipo No operativo conserva una proyección de uso válida, se incluye con esa etiqueta; revisa su fecha si su utilización cambió. El resumen también se puede descargar en CSV, con una columna «Tipo» que distingue detalle CeCo, subtotales de región y total general.

`Panel.html` es la portada, servida también en `/`. `Panel_Reportabilidad.html` conserva el nombre existente; la ruta `/Panel_repostabilidad.html` también abre ese panel. Cada HTML carga `panel.css`; Reportabilidad y KM-HR cargan sus propios archivos JavaScript. La portada incluye el control compartido de actualización de BD. El servidor publica únicamente las páginas y recursos declarados en `ARCHIVOS_WEB`, no los Excel ni el código Python.

Para habilitar esta nueva estructura, detén el servidor con **Ctrl+C**, vuelve a ejecutar **Iniciar_Panel.bat** y abre <http://127.0.0.1:8765>. Recarga con **Ctrl+F5**. El reinicio es necesario porque ahora Python sirve nuevas páginas, CSS, JavaScript y la API KM-HR.

## Regla de conteo

Reportabilidad usa los **martes**, desde la **semana 1 del 04-08-2026**. Para cada martes **D**, cuenta formularios cuya **Hora de finalización** esté entre **D − 1 día** y **D + 3 días**, ambos incluidos: lunes a viernes completos. La semana 1 incluye del 03 al 07 de agosto; la semana 2, del 10 al 14. El selector permite martes y abre el martes de la semana actual (lunes a domingo, incluso si hoy es lunes). La API ajusta cualquier fecha al martes de esa misma semana y rechaza semanas anteriores a la del 04-08-2026. El reporte muestra semana, martes y ventana de lectura, sin columnas diarias. La tabla y el CSV incorporan el porcentaje de las tres semanas anteriores y el promedio aritmético de la semana seleccionada y esas semanas. Al inicio de agosto se usan solo las semanas existentes desde el 04-08-2026, sin inventar períodos anteriores. Las semanas sin reportes cuentan como cero cuando hay base; sin base se muestra —. Reportabilidad presenta dos gráficos lado a lado, con el mismo formato de Seguimiento KM-HR: evolución de hasta ocho semanas (la seleccionada y siete anteriores, desde el 04-08-2026), con marcas del eje Y cada 25 %, y barras de cumplimiento total por región en la semana seleccionada. Ambos gráficos muestran regiones inicialmente y, al seleccionar una región, sus CeCo. Pasar el mouse por barras, líneas, puntos o leyenda destaca la misma serie en ambos gráficos y atenúa las demás. Un clic fija o quita esa selección; Escape también la limpia. Pulsar una región de la tabla aplica su filtro; pulsar un CeCo muestra toda su región y lo destaca en ambos gráficos. El porcentaje regional se calcula a partir de la suma de reportadas y del total de sus CeCo. Las barras distinguen ceros de casos sin base y admiten porcentajes superiores al 100 %. Ambos gráficos respetan filtros y exclusiones, se ajustan al ancho disponible sin desplazamiento horizontal y se apilan en pantallas pequeñas. La tabla y el CSV conservan las tres semanas anteriores y el promedio de cuatro semanas. Respeta la búsqueda y las exclusiones, al igual que los subtotales y promedios. Cada porcentaje regional se calcula sumando reportadas y base de sus CeCo; no se promedian los porcentajes de CeCo. Todas las semanas se comparan con el maestro actual, y la semana en curso puede estar incompleta hasta el viernes. Se interpreta la fecha registrada en Excel, sin conversión de zona horaria. Esta ventana corresponde a los formularios ADC de Reportabilidad; Seguimiento KM-HR conserva las fechas de las columnas de su hoja.

Se cuentan **patentes distintas por CeCo**, usando `PATENTE` de Sheet1. Una patente repetida en varios formularios o días del período cuenta una sola vez dentro del mismo CeCo. Solo se cuentan formularios semanales ADC. Los valores vacíos, `REVISAR`, `-`, `N/A`, `NA`, `SIN PATENTE` y `NO APLICA` se excluyen y se informan. No se intenta reconstruir esos valores a partir de otras columnas. Se normalizan mayúsculas, tildes, espacios, puntos y guiones para reconocer repeticiones.

La comparación utiliza estas columnas:

| Columna | Cálculo |
| --- | --- |
| Reportadas | Patentes distintas del CeCo encontradas en el período |
| % respecto del total | Reportadas ÷ total de patentes del CeCo × 100 |
| Total patentes | Patentes distintas de la hoja `BD ACTIVOS MOVILES`, agrupadas por `NOMBRE CeCo ACTUAL` |

El total del maestro no se filtra por fecha. Usa su asignación actual de CeCo, incluye registros con región vacía y elimina patentes repetidas dentro del mismo CeCo. Si el total es cero, el porcentaje aparece como **—**, no como 0%. Los CeCo del maestro aparecen aunque tengan cero reportes.

Las patentes reportadas fuera del maestro del CeCo se mantienen en Reportadas y se señalan bajo el nombre del CeCo. Por ello el porcentaje puede superar 100%: compara cantidades, no mide la coincidencia exacta entre ambas listas. No se limita ni se altera el resultado para aparentar cumplimiento.

Los subtotales de región y el total general suman los conteos por CeCo; los porcentajes se calculan dividiendo esas sumas, no promediando porcentajes. Si una patente aparece en distintos CeCo, cuenta una vez en cada uno. Las tarjetas y el CSV responden a los filtros visibles; contraer una región no elimina sus registros del total.

Se utiliza la primera hoja cuya primera fila contenga las columnas requeridas. Se admiten fechas nativas de Excel, números de serie, fechas ISO y textos `dd/mm/aaaa` o `dd-mm-aaaa`, con hora opcional. Las fechas vacías o inválidas se excluyen y se informa cuántas hay en el archivo completo.

## Clasificación por región

1. Se cruza `CeCo (Centro de costo)` de Sheet1 con `NOMBRE CeCo ACTUAL` del maestro y se toma `REGION ACTUAL`. Los nombres se normalizan por mayúsculas, espacios y tildes.
2. Se usa una región única por CeCo para mantener juntas las patentes del maestro y las reportadas. Los valores válidos de región comienzan con `REGION `.
3. Si no existe una región válida, aparece **SIN REGIÓN**. Si el maestro asigna varias regiones al mismo CeCo, también se muestra **SIN REGIÓN** y una advertencia. No se adivinan asignaciones.
4. Los CeCo vacíos aparecen como **SIN CECO**, dentro de **SIN REGIÓN**. No se infieren desde la patente.

La columna REGION del archivo recibido contiene vacíos y valores como `Hrs` y `Kms`, por eso la clasificación utiliza el maestro. Refleja su estado actual; no reconstruye regiones históricas. Si el maestro falta o no contiene las columnas requeridas, la consulta falla con un aviso: no se inventa el total para la comparación.

**SIN REGIÓN** y **SIN CECO** se incluyen en los conteos de patentes; SIN CECO no se considera un centro identificado en la tarjeta de centros de costo.

## Alcance respecto de la imagen

Se reproduce la jerarquía **región → CeCo**, con **Reportadas | % respecto del total | Total patentes**. Los días anteriores y posterior solo se utilizan internamente para buscar reportes; no se desglosan en la tabla ni en el CSV.

Los avisos de calidad corresponden al período completo (salvo las fechas inválidas del archivo y las patentes inválidas del maestro), aunque se apliquen filtros visuales.

Después de actualizar los archivos del panel, detén el servidor anterior con `Ctrl+C`, vuelve a ejecutar **Iniciar_Panel.bat** y recarga la página para utilizar la nueva lógica.

## Programa Mantención

Acceso desde la portada y la navegación de paneles. Lee la hoja `PROGRAMA` del libro configurado con `--excel`, usando las columnas REGION ACTUAL, NOMBRE CeCo ACTUAL, PATENTE, FECHA PROYECTADA y ESTADO. Filtra por mes y año de fecha proyectada, sin usar la fecha de ejecución.

Muestra programadas, realizadas, regularizadas, no realizadas, N/A y sin clasificar por región y CeCo. Cuenta patentes únicas dentro de cada región/CeCo/mes; los duplicados contradictorios quedan sin clasificar. Cumplimiento = (realizadas + regularizadas) / (programadas − N/A). Verde ≥90%, amarillo ≥70% y rojo <70%; sin aplicables se muestra —. Los totales recalculan el porcentaje a partir de los conteos, sin promediar porcentajes.

API: `/api/programa-mantencion?mes=2026-09`. Pruebas: `python -B -m unittest discover -s tests`, desde la carpeta del panel.

El panel incluye gráficos de cumplimiento mensual, programadas frente a realizadas por mes y cascada de realizadas, regularizadas y no realizadas del mes seleccionado, con alturas según la cantidad de patentes, cantidad dentro de cada barra, porcentaje arriba y una barra final de total (100%), sin N/A. El historial usa todos los meses con patentes válidas en PROGRAMA y agrupa por fecha proyectada; no representa el mes de ejecución. Los casos sin estado válido permanecen en el total y denominador, con aviso, pero no tienen columna ni tarjeta y se excluyen de la cascada. Los porcentajes de la cascada usan solo realizadas, regularizadas y no realizadas. Pasar el mouse por una línea, punto o leyenda del historial destaca la misma región o CeCo en ambos gráficos (cumplimiento, programadas y realizadas) y atenúa las demás entidades; al retirar el mouse se restaura la vista completa.


## Configuración unificada del portal

El sexto acceso, **Configuraciones**, reúne las preferencias de todos los reportes. La selección de regiones afecta los filtros, gráficos, tablas, totales y descargas de Reportabilidad, Seguimiento KM-HR, Resumen, Calendario y Programa, incluido el historial. Las exclusiones antiguas de regiones se unen al migrar; las unidades excluidas anteriormente de Reportabilidad se conservan y ahora se aplican a todos los paneles. Las unidades se presentan dentro de su región; **Modo zona** las agrupa por zona y permite ocultar zonas completas.

Se pueden ocultar individualmente 14 gráficos y tablas distribuidos entre los cinco paneles. Ocultar una vista no elimina sus datos de las descargas. «Mostrar todos» recupera las vistas. Los cambios se guardan en la BD propia en el modo interactivo. La consulta sin servidor usa la configuración de la última publicación. Los nuevos nombres de región se incluyen por defecto. «Actualizar grupos desde BD» reúne las regiones, zonas y unidades de las tres fuentes y avisa si alguna consulta falla.

Reinicia el servidor y recarga con Ctrl+F5 para habilitar las nuevas rutas. Los controles de consulta, fechas y búsquedas permanecen dentro de cada reporte. Todos comparten navegación, filtros, tarjetas, tablas y diseño adaptable.


## Base de datos y actualización

`Datos/mantenimiento.sqlite3` conserva las cuatro hojas necesarias: `Sheet1`, `BD ACTIVOS MOVILES`, `Seguimiento KM-HR` y `PROGRAMA`. Sus tablas son `fuentes`, `hojas`, `filas` y `metadatos`. Preserva fechas nativas, números, celdas vacías, orden de filas y calendario de Excel. Los cálculos existentes se aplican a esta copia para permitir consultar cualquier período disponible sin abrir los Excel. La base generada se excluye de Git.

1. Guarda y sincroniza los Excel.
2. Ejecuta **Actualizar_BD.bat** o pulsa **Actualizar BD** en el portal abierto con **Iniciar_Panel.bat**.
3. El botón recarga la página al terminar; si usaste el `.bat`, recarga el navegador. **Consultar BD** cambia el período del reporte sin importar otra vez los Excel.

Una carga valida las hojas y columnas necesarias y reemplaza la BD completa solo al terminar correctamente. Si faltan hojas, el archivo cambia durante la lectura o falla la importación, se conserva la base anterior. Se muestran fecha de carga y errores en el panel. La primera carga es obligatoria: el servidor puede abrir sin BD, pero los reportes indicarán que debe crearse.

La actualización usa `LIBRO_EQUIPOS` de `config/.env`, igual que el servidor. Para fuentes personalizadas, utiliza los mismos argumentos en ambos lanzadores:

```powershell
.\Actualizar_BD.bat --excel "C:\Datos\Control.xlsx" --maestro "C:\Datos\Activos.xlsx" --bd "Datos\mantenimiento.sqlite3"
.\Iniciar_Panel.bat --excel "C:\Datos\Control.xlsx" --maestro "C:\Datos\Activos.xlsx" --bd "Datos\mantenimiento.sqlite3"
```

Alternativa: `python -B -m app.actualizar_BD`. En Mac: `MAC/Actualizar_BD_MAC.command`.

El navegador solicita `POST /api/bd/actualizar`; el servidor ejecuta el mismo importador Python del `.bat`. `GET /api/bd` informa la fecha de carga. Las API de reportes consultan únicamente SQLite y añaden `bd_actualizada`. El navegador no ejecuta directamente archivos `.bat`; necesita el servidor local. La BD no se publica como descarga HTTP.
