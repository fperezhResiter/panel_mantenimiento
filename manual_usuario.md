# Manual de usuario — Panel de Mantenimiento

## Consulta sin servidor

Abre **Panel.html** con doble clic. Consulta Reportabilidad, Seguimiento KM-HR, Resumen de mantención, Calendario de mantención y Programa Mantención, con sus filtros, gráficos y descargas CSV/PDF. No necesitas ejecutar un BAT ni instalar Python. La franja al pie del encabezado muestra la última publicación. Los avisos de calidad y el resumen de configuración aparecen solo en el modo interactivo. Configuraciones solo se abre en el modo interactivo de Iniciar_Panel.bat. La consulta utiliza la configuración de la última publicación.

## Agrupar por zona

En cualquiera de los cinco paneles, pulsa **Modo zona**, junto a **Volver al inicio** para ver los subtotales por zona, unidad y línea de negocio. Puedes combinar los filtros de zona, unidad y línea; las tarjetas, gráficos y descargas se ajustan a la selección. El botón cambia a **Modo región** para recuperar la vista habitual; el filtro alterna entre **Zona** y **Región**. La selección del modo queda recordada en el navegador.

Las subzonas 4A, 4B, 8A y 8B se muestran por separado. **SIN ZONA** y **SIN LÍNEA** conservan los equipos cuya asociación no es única o está incompleta. La línea de negocio es distinta de la medida KM/HR. La relación de unidades y zonas se conserva en `config/unidades_zonas.json`; al actualizarla, se debe regenerar la publicación para usarla sin servidor.

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
