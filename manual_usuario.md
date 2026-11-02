# Manual de usuario — Panel de Mantenimiento

## Consulta sin servidor

Abre **Panel.html** con doble clic. Consulta Reportabilidad (total y efectiva), Seguimiento KM-HR, Resumen de mantención, Calendario de mantención y Programa Mantención, con sus filtros, gráficos y descargas CSV/PDF. No necesitas ejecutar un BAT ni instalar Python. La franja al pie del encabezado muestra la última publicación. Los avisos de calidad y el resumen de configuración aparecen solo en el modo interactivo. Configuraciones solo se abre en el modo interactivo de Iniciar_Panel.bat. La consulta utiliza la configuración de la última publicación.

## Base vigente de cada semana

El martes seleccionado determina la base. Se incluyen las patentes cuyo inicio de VIGENCIA sea igual o anterior a ese martes y cuyo fin esté vacío o sea igual o posterior. Región, zona, Unidad y línea salen del período vigente. Los envíos ADC de lunes a viernes se atribuyen a esa asignación, aunque Sheet1 declare otra Unidad. Cada patente cuenta una vez por semana.

Los porcentajes anteriores usan la base de su propia semana. Los reportes sin un período vigente único y las patentes del maestro sin registro aparecen en **Reportes fuera de base y vigencias pendientes**. Su CSV separado se descarga solo en modo interactivo; la consulta sin servidor conserva el detalle visible. No se suman al cumplimiento. El CSV principal incluye también las bases históricas. El status sigue siendo el actual del maestro.

## Reportabilidad total y efectiva

Abre **Reportabilidad**. Inicialmente muestra la reportabilidad total. Pulsa **Mostrar reportabilidad efectiva** para desplegar los criterios, indicadores y gráficos efectivos. El mismo botón cambia a **Mostrar reportabilidad total** para volver. La fecha, los filtros de región/zona, Unidad, Línea y Status del equipo, y los criterios elegidos se conservan al alternar. Las descargas CSV/PDF corresponden al modo activo. Por defecto, cuenta la patente si el último envío ADC de la patente en la semana, después de reasignar su Unidad tiene una lectura mayor que cero, mayor o igual que su lectura anterior y menor o igual al doble de ella. Se acepta mantener una lectura positiva: 1.000 → 1.000 cumple los tres criterios. El doble exacto también se acepta.

En **Criterios a considerar** puedes activar o desactivar cada una de esas tres condiciones. Deben cumplirse todas las condiciones seleccionadas. El cambio recalcula inmediatamente las cantidades efectivas y no efectivas de todas las semanas, gráficos, tablas y descargas, manteniendo el total reportado y el maestro. La selección se conserva al consultar y al cambiar entre región y zona. El resumen **Criterios aplicados** y el ejemplo se actualizan, y las descargas CSV/PDF registran la selección.

Con algún criterio activo se requiere lectura numérica y control KM/HR reconocido. Si seleccionas una comparación con el dato anterior, ese antecedente debe existir y ser numérico. Si no seleccionas ningún criterio, todas las patentes reportadas se consideran efectivas, incluso si faltan lecturas o control; las no efectivas quedan en cero.

La columna **Unidad de Control del equipo** de Sheet1 determina qué revisar: **Por kilometraje** usa **Kilometraje actual (km)**; **Por horómetro** usa **Horómetro actual (hrs)**. Se compara con la lectura numérica anterior disponible del mismo medidor y patente, ordenada por Hora de finalización, aunque esté fuera de las semanas visibles. Con los tres criterios activados, sin antecedente positivo o sin control reconocido no se considera efectiva. El porcentaje compara las patentes efectivas con la base vigente semanal. CSV y PDF conservan este conteo y los filtros elegidos.

La **evolución semanal** muestra solo los puntos y líneas de las efectivas. Las barras de la **semana seleccionada** apilan ambas partes. El gráfico semanal que mostraba solo efectivas fue retirado. El gráfico **Reportabilidad semanal: efectivas y no efectivas** muestra las efectivas en la parte sólida y las reportadas que no cumplen los requisitos en el tramo superior achurado. La altura completa es la reportabilidad total. Por ejemplo, con 100 patentes de base, 60 efectivas y 20 reportadas no efectivas, la barra llega a 80 %: 60 % sólido y 20 % achurado. El porcentaje superior corresponde a las efectivas. En las barras de la semana seleccionada, el color sigue el porcentaje efectivo: rojo bajo 75 %, amarillo desde 75 % hasta menos de 90 %, verde desde 90 %. En **Reportabilidad semanal**, las barras y su achurado usan el color de su entidad en la leyenda, igual que la evolución semanal; ese color se conserva al cambiar criterios y filtros. Los números bajo las barras semanales remiten a su entidad en la leyenda. Pasa el mouse o enfoca un tramo para consultar las cantidades y ambos porcentajes. Los filtros y el modo zona se aplican a toda la barra. El PDF conserva el achurado y el CSV incluye las tres cantidades.

Las tarjetas resumen las patentes reportadas totales, efectivas y no efectivas, además del maestro y las unidades. Muestran también los tres porcentajes respecto dla base vigente semanal. Reportadas totales = efectivas + no efectivas; todos los indicadores responden a los filtros.

## Filtrar por Status del equipo

En **Reportabilidad**, tanto en modo total como efectivo, el filtro **Status del equipo** utiliza la columna **STATUS DEL EQUIPO** de **BD ACTIVOS MOVILES**, asociada por patente. Puedes marcar uno o varios estados; sin selección se incluyen todos. Se filtran las patentes reportadas, efectivas, no efectivas y la base vigente semanal, incluyendo las semanas anteriores, tablas, gráficos y descargas. Los porcentajes se calculan sobre la base vigente del conjunto elegido.

El status es el actual del maestro y se aplica a todas las semanas consultadas. Las patentes sin ese dato, con estados contradictorios en el maestro o que no figuran en él se conservan en **Sin status**. La selección se mantiene al consultar otra semana o alternar entre región y zona. El CSV registra el filtro y el PDF lo muestra junto con los demás filtros.

## Seleccionar varias regiones y unidades

Abre el filtro **Región/Zona** o **Unidad** y marca las casillas que quieras combinar. El buscador permite encontrar opciones por nombre; **Seleccionar todas** marca todas las opciones disponibles y **Limpiar selección** vuelve a incluirlas todas. Al cambiar la región o zona se conservan las unidades seleccionadas que sigan siendo válidas. Las tarjetas, gráficos, tablas y descargas utilizan el conjunto elegido. Las selecciones se mantienen al volver a consultar; cambiar entre modo región y modo zona restablece los filtros.

En **Reportabilidad**, tanto total como efectiva, **Línea de negocio** también admite varias casillas en modo zona. Solo ofrece las líneas de las zonas y unidades elegidas; sin selección incluye todas. **Limpiar filtros** vuelve a incluir todas las regiones o zonas, unidades, líneas y status, conservando la fecha de referencia, el modo de reportabilidad y los criterios de efectividad.

## Agrupar por zona

En cualquiera de los cinco paneles, pulsa **Modo zona**, junto a **Volver al inicio** para ver los subtotales por zona, unidad y línea de negocio. Puedes combinar los filtros de zona, unidad y línea; las tarjetas, gráficos y descargas se ajustan a la selección. El botón cambia a **Modo región** para recuperar la vista habitual; el filtro alterna entre **Zona** y **Región**. La selección del modo queda recordada en el navegador.

Las subzonas **4A y 4B se muestran juntas como ZONA 4**; **8A y 8B, como ZONA 8**. La agrupación se aplica a filtros, tablas, gráficos, descargas y Configuraciones, conservando los totales. Basta con recargar la página para verla, también sin servidor. **SIN ZONA** y **SIN LÍNEA** conservan los equipos cuya asociación no es única o está incompleta. La línea de negocio es distinta de la medida KM/HR. La relación de unidades y zonas se conserva en `config/unidades_zonas.json`; al actualizarla, se debe regenerar la publicación para usarla sin servidor.

## Barras semanales de Reportabilidad

El gráfico **Cumplimiento semanal en barras** muestra todas las semanas disponibles hasta la fecha de referencia, con una barra por región o zona, Unidad o línea de negocio según el nivel actual, y su porcentaje encima. Abre en las semanas más recientes; mueve la barra deslizadora hacia la izquierda para revisar las anteriores. La evolución en líneas también incluye todas esas semanas. Los dos gráficos superiores se presentan lado a lado y juntos ocupan todo el ancho de la página; las barras semanales van debajo a todo el ancho. En móvil se apilan para mantener la lectura.

Las franjas de fondo indican **rojo: menos de 75 %**, **amarillo: desde 75 % y menos de 90 %** y **verde: 90 % o más**. Los colores de las barras identifican las entidades de la leyenda. Pasa el mouse o enfoca una barra para ver entidad, semana, porcentaje, patentes reportadas y total; se destaca esa misma entidad y semana en los demás gráficos. Pasa el mouse o enfoca una franja o su leyenda para destacar todas las barras y puntos de ese rango en los tres gráficos, sin cambiar los filtros ni los totales. **Sin base** destaca los casos con total igual a cero. Pulsa una barra para bajar de nivel y usa **Volver al nivel anterior** para regresar. El PDF de Reportabilidad usa páginas A4 verticales y agrupa el gráfico en bloques de cinco semanas: S1-S5, S6-S10 y así sucesivamente; el último bloque incluye las semanas restantes. Cada bloque muestra todas las unidades filtradas juntas, con margen izquierdo compacto y barras que ajustan su ancho según la cantidad. Cuando hay muchas barras, los porcentajes se giran y escalonan para evitar que se superpongan; cada bloque repite sus ejes y leyendas.

## 🛠️ Preparación inicial (solo la primera vez)

1. Descargar e instalar **Python 3.10 o superior** desde el sitio oficial: [Descargar Python para Windows](https://www.python.org/downloads/windows/). Si el instalador muestra la opción **Add python.exe to PATH**, marcarla antes de instalar.
2. Tener sincronizada en OneDrive la carpeta **CL - Gestión Minería - Documentos** y esperar a que los archivos estén disponibles en el equipo.
3. Entrar a la carpeta del panel:

   `05. Paneles > Panel Mantenimiento > panel_mantenimiento`

4. Hacer doble clic en **Iniciar_Primera_Vez.bat**. Este paso requiere conexión a Internet y prepara lo necesario para usar el panel.
5. Esperar el mensaje **Preparación completada** antes de continuar.
6. Ejecutar **Actualizar_BD.bat** para crear la base de datos desde los Excel.

## Actualizar los datos

El panel consulta **Datos/mantenimiento.sqlite3**. Guarda el Excel y espera su sincronización; luego pulsa **Actualizar BD** en el portal o ejecuta **Actualizar_BD.bat** con doble clic. El botón requiere que **Iniciar_Panel.bat** esté abierto y recarga la página al terminar. El archivo `.bat` también funciona con el servidor detenido y regenera la consulta sin servidor; después recarga el navegador. Conserva las configuraciones guardadas en la BD. Comparte la carpeta completa, incluidos Datos y web/datos. Coordinen las escrituras y actualizaciones para que no coincidan.

**Consultar BD** consulta el período elegido con la última carga guardada. Para incorporar cambios nuevos del Excel, usa **Actualizar BD**. El panel muestra la fecha de la última carga. Si una actualización falla, conserva la base anterior. Los Excel se leen sin modificarlos.

Las asociaciones de zona también se actualizan con ese botón. Modifica y guarda **06. Mantenimiento/ Datos GDM ADC y CC Minería 230926.xlsx**, espera su sincronización y pulsa **Actualizar BD**. Se regeneran el JSON y la publicación sin servidor. Las equivalencias confirmadas, como CMP VALLE COPIAPO ASEO con VALLE COPIAPO y línea ASEO, se conservan; la zona se toma del Excel actualizado. No necesitas importar el catálogo por separado.

## 🚀 Para abrir el Panel de Mantenimiento

1. Tener sincronizada la carpeta **CL - Gestión Minería - Documentos**.
2. Entrar a:

   `05. Paneles > Panel Mantenimiento > panel_mantenimiento`

3. Hacer doble clic en **Iniciar_Panel.bat** (puede aparecer como **Iniciar_Panel**).
4. Esperar unos segundos hasta que la ventana negra muestre **Panel disponible**.
5. Abrir la URL que indica la ventana (normalmente http://127.0.0.1:8765). Se abrirá el modo interactivo.
6. Seleccionar el panel que se desea consultar.

**Mantener la ventana negra abierta mientras se utiliza el panel.** Se puede minimizar.

También se puede abrir el enlace que muestra la ventana negra, normalmente [Abrir Panel de Mantenimiento](http://127.0.0.1:8765). En Windows Terminal se abre con **Ctrl + clic**; si no permite abrirlo, copiar y pegar el enlace en el navegador.

## 🔒 Para cerrar el panel

1. Cerrar la ventana o pestaña del navegador donde está abierto el panel.
2. Ir a la ventana negra que se abrió al iniciar el panel.
3. Presionar **Ctrl + C**.
4. Si aparece un mensaje de confirmación, presionar **S** y luego **Enter**.
5. Cerrar la ventana negra con la **X** si permanece abierta y cerrar cualquier otra ventana del panel.

**Cerrar solo el navegador no detiene el panel:** también hay que detenerlo en la ventana negra.

## Uso en Mac

1. Instalar Python 3.10 o superior.
2. La primera vez, entrar a la carpeta **MAC** y abrir **Iniciar_Primera_vez_MAC.command**.
   Después ejecutar **MAC/Actualizar_BD_MAC.command** para crear o recargar la base.
3. Para iniciar el panel, abrir **MAC/Iniciar_Panel_MAC.command**.
4. Esperar **Panel disponible** y abrir la URL indicada para el modo interactivo. **Panel.html** abre la consulta sin servidor.
5. Mantener la terminal abierta mientras se utiliza el panel. Para detenerlo, presionar **Control + C**.

## Organización del proyecto

Los archivos de uso diario de Windows y **Panel.html** permanecen en la carpeta principal. El resto está organizado en **app**, **config**, **scripts**, **tests**, **web** y **MAC**. Conservar todas estas carpetas al copiar el proyecto. La ruta personalizada del Excel se configura en **config/.env**, usando **config/.env.example** como plantilla.

## Descargas PDF

Cada panel incluye **Descargar PDF**. Genera un informe con el título del panel y el logo de Resiter. Los filtros actuales (fechas, regiones y CeCo), indicadores y tablas se escriben como texto seleccionable; los gráficos se incluyen como figuras. Se omiten el encabezado de navegación y los controles del panel. Las secciones ocultas en Configuraciones y los detalles cerrados conservan ese estado. Las tablas con desplazamiento se incluyen completas y las vistas extensas continúan en varias páginas.

En Calendario de mantención, **Descargar calendario + tabla de la región (PDF)** genera el calendario mensual y el detalle de las patentes marcadas para la región y CeCo seleccionados, aunque se esté consultando un solo día. La tabla CSV conserva la misma selección. El botón general **Descargar PDF** refleja la agenda del día o mes que esté visible.

Las descargas se generan en el navegador con bibliotecas locales; no requieren conexión a Internet.

## Patentes incluidas en el calendario

Abre el calendario desde Iniciar_Panel.bat. Marca o desmarca **Incluir en publicación y descargas** para cada patente. La selección se guarda en la BD y se conserva al actualizar los Excel. Las desmarcadas siguen visibles en el modo interactivo para volver a incluirlas. Ejecuta **Actualizar_BD.bat** y recarga **Panel.html**: la consulta sin servidor muestra solo las patentes marcadas, sin casillas; sus descargas respetan esa selección. Los demás reportes conservan sus patentes.

Los desplegables y las tablas muestran el nombre de la unidad seguido del código CeCo entre paréntesis cuando hay un código único en la columna **CeCo ACTUAL** de **BD ACTIVOS MOVILES** (por ejemplo, `QUEBRADA BLANCA (3400)`). Los gráficos y los PDF conservan solo el nombre. Esto se aplica tanto al modo interactivo como a la consulta sin servidor; al actualizar la BD se renueva también el catálogo de códigos de la publicación.


## Seleccionar regiones, zonas y unidades

Abre **Configuraciones** desde el modo interactivo. Cada región tiene una casilla principal y sus unidades debajo. Desmarca una región para ocultarla junto con sus unidades en los cinco paneles. Desmarca una unidad para ocultarla en todos los paneles, incluidos los totales y las descargas. Al volver a activar una región se respetan las unidades que habías desmarcado.

Pulsa **Modo zona** para ver las casillas agrupadas por zona. Desmarcar una zona la oculta en las vistas por zona; las exclusiones de regiones y unidades también se respetan. **Incluir todas** y **Excluir todas** actúan sobre las regiones o zonas de la agrupación visible, conservando la selección individual de unidades.

Los cambios se guardan automáticamente en la BD y actualizan las preferencias de la publicación sin servidor. Recarga o vuelve a abrir los paneles sin servidor para leer los cambios.
