# Manual de usuario — Panel de Mantenimiento

## 🛠️ Preparación inicial (solo la primera vez)

1. Descargar e instalar **Python 3.10 o superior** desde el sitio oficial: [Descargar Python para Windows](https://www.python.org/downloads/windows/). Si el instalador muestra la opción **Add python.exe to PATH**, marcarla antes de instalar.
2. Tener sincronizada en OneDrive la carpeta **CL - Gestión Minería - Documentos** y esperar a que los archivos estén disponibles en el equipo.
3. Entrar a la carpeta del panel:

   `05. Paneles > Panel Mantenimiento > panel_mantenimiento`

4. Hacer doble clic en **Iniciar_Primera_Vez.bat**. Este paso requiere conexión a Internet y prepara lo necesario para usar el panel.
5. Esperar el mensaje **Preparación completada** antes de continuar.
6. Ejecutar **Actualizar_BD.bat** para crear la base de datos desde los Excel.

## Actualizar los datos

El panel consulta **Datos/mantenimiento.sqlite3**. Guarda el Excel y espera su sincronización; luego pulsa **Actualizar BD** en el portal o ejecuta **Actualizar_BD.bat** con doble clic. El botón requiere que **Iniciar_Panel.bat** esté abierto y recarga la página al terminar. El archivo `.bat` también funciona con el servidor detenido; después recarga el navegador.

**Consultar BD** consulta el período elegido con la última carga guardada. Para incorporar cambios nuevos del Excel, usa **Actualizar BD**. El panel muestra la fecha de la última carga. Si una actualización falla, conserva la base anterior. Los Excel se leen sin modificarlos.

## 🚀 Para abrir el Panel de Mantenimiento

1. Tener sincronizada la carpeta **CL - Gestión Minería - Documentos**.
2. Entrar a:

   `05. Paneles > Panel Mantenimiento > panel_mantenimiento`

3. Hacer doble clic en **Iniciar_Panel.bat** (puede aparecer como **Iniciar_Panel**).
4. Esperar unos segundos hasta que la ventana negra muestre **Panel disponible**.
5. Hacer doble clic en **Panel.html** (puede aparecer como **Panel**). Se abrirá el portal en el navegador.
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
4. Esperar **Panel disponible** y abrir **Panel.html**, ubicado en la carpeta principal.
5. Mantener la terminal abierta mientras se utiliza el panel. Para detenerlo, presionar **Control + C**.

## Organización del proyecto

Los archivos de uso diario de Windows y **Panel.html** permanecen en la carpeta principal. El resto está organizado en **app**, **config**, **scripts**, **tests**, **web** y **MAC**. Conservar todas estas carpetas al copiar el proyecto. La ruta personalizada del Excel se configura en **config/.env**, usando **config/.env.example** como plantilla.

## Descargas PDF

Cada panel incluye **Descargar PDF**. Descarga la vista con los filtros actuales, indicadores, gráficos y tablas visibles. Las secciones ocultas en Configuraciones y los detalles cerrados conservan ese estado. Las tablas con desplazamiento se incluyen completas y las vistas extensas continúan en varias páginas.

En Calendario de mantención, **Descargar calendario + tabla de la región (PDF)** genera el calendario mensual y el detalle de las patentes marcadas para la región y CeCo seleccionados, aunque se esté consultando un solo día. La tabla CSV conserva la misma selección. El botón general **Descargar PDF** refleja la agenda del día o mes que esté visible.

Las descargas se generan en el navegador con bibliotecas locales; no requieren conexión a Internet.
