# connection_sharepoint

Componente de extracción de Excel con tipos BigQuery mediante `ClientContext` y autenticación moderna OAuth con tenant ID y client ID. Devuelve registros Python y JSON; no realiza cargas a BigQuery. Usa la versión 3.1 de Office365-REST-Python-Client; instala las dependencias con un Python compatible con esa versión.

El inicio de sesión usa un código de dispositivo: Microsoft muestra una URL y un código, y el usuario completa el acceso en el navegador, incluido MFA cuando corresponda. No se solicita contraseña en Python. La organización debe permitir este flujo.

## Instalación y ejecución

Desde la raíz del proyecto:

```powershell
python -m pip install -r App/panel_mantenimiento/requirements.txt
python App/panel_mantenimiento/connection_sharepoint.py
```

## Configuración general: `App/panel_mantenimiento/.env`

```dotenv
TENANT_ID=TU_TENANT_ID
CLIENT_ID=TU_CLIENT_ID
SHAREPOINT_SITE_URL=https://TU_EMPRESA.sharepoint.com/sites/Mantenimiento
```

Estos tres valores son la configuración general. Se conserva la URL existente al restaurar los identificadores. Usa la URL del sitio sin enlaces de compartir, parámetros ni formato Markdown. El `.env` se busca junto al módulo independientemente de la carpeta de ejecución. Las variables del proceso tienen prioridad. La lectura no modifica el entorno global.

El `.gitignore` local excluye `.env`, cachés y la salida predeterminada. No configures usuario, contraseña ni client secret. La sesión se mantiene en memoria durante la ejecución, sin una caché persistente de tokens configurada por el componente.

### Configuración de Microsoft Entra ID

1. Obtén una aplicación autorizada por TI. Copia el identificador del directorio en `TENANT_ID` y el identificador de aplicación en `CLIENT_ID`.
2. En autenticación de la aplicación, habilita **Permitir flujos de cliente público** para usar código de dispositivo.
3. En permisos API, selecciona **SharePoint → Permisos delegados → AllSites.Read** y concede el consentimiento requerido. Este componente usa SharePoint REST; configurar solamente permisos de Microsoft Graph no habilita estos llamados.
4. Inicia sesión con una cuenta que tenga acceso al sitio y al archivo. El permiso de la aplicación no otorga acceso adicional a la cuenta.

No se necesita client secret ni URI de redirección para el flujo de dispositivo. El código solicita el recurso `https://<empresa>.sharepoint.com/.default`, que usa los permisos de SharePoint configurados en la aplicación.

```python
from office365.sharepoint.client_context import ClientContext

context = ClientContext(site_url).with_device_flow(
    tenant=tenant_id,
    client_id=client_id,
    scopes=["https://TU_EMPRESA.sharepoint.com/.default"],
)
```

Crear el contexto no confirma la autenticación: esta ocurre en la primera consulta. `verify_connection()` ejecuta una lectura del título del sitio antes de descargar. Los errores orientan a revisar identificadores, URL, permisos, consentimiento y políticas de acceso; no exponen mensajes completos del proveedor.

La implementación ya no usa `UserCredential`, IDCRL ni contraseñas directas. Si el tenant bloquea códigos de dispositivo, TI debe habilitar un flujo permitido; los identificadores por sí solos no eliminan las políticas de acceso.

## Datos solicitados en cada ejecución

El programa solicita por consola:

1. Biblioteca de documentos: nombre exacto, por ejemplo `Documentos`.
2. Ruta dentro de la biblioteca: por ejemplo `Reportes/2026`; Enter para la raíz. No incluyas la biblioteca ni el archivo. Escribe espacios normales, sin `%20`.
3. Nombre del Excel: por ejemplo `mantenimiento.xlsx`. Se admiten `.xlsx` y `.xlsm`.
4. Nombre exacto de la hoja y fila de encabezados, comenzando en 1.
5. Cantidad de columnas a extraer.
6. Para cada columna: encabezado exacto, tipo BigQuery y si permite nulos. Para tipos numéricos pide separadores de texto; para tipos temporales pide formato de texto.
7. Ruta del JSON de salida. Por defecto: `App/panel_mantenimiento/connection_sharepoint_output.json`. Debe ser un archivo nuevo dentro de una carpeta existente; nunca sobrescribe archivos.

Las columnas salen en el orden elegido. Los tipos se aceptan sin distinguir mayúsculas; también se admiten `INTEGER`/`INT`, `FLOAT`, `BOOLEAN`, `DECIMAL` y `BIGDECIMAL` como alias. Los valores vacíos son `None`/`null` si se permiten nulos (`NULLABLE`); de lo contrario se rechazan (`REQUIRED`).

Al comenzar la conexión, sigue la URL y el código que muestra Microsoft. No introduzcas la contraseña en la consola.

## Tipos y conversiones

| Tipo | Tipo Python | Regla del componente |
| --- | --- | --- |
| STRING | str | Conserva texto; convierte otros valores a su representación textual. |
| INT64 | int | Entero con signo de 64 bits; rechaza fracciones y desbordamientos. |
| FLOAT64 | float | Punto flotante aproximado; este componente solo acepta valores finitos. |
| NUMERIC | Decimal | Decimal exacto, dentro del rango NUMERIC y hasta 9 decimales efectivos. |
| BIGNUMERIC | Decimal | Decimal exacto, dentro del rango BIGNUMERIC y hasta 38 decimales efectivos. |
| BOOL | bool | Acepta true/false, verdadero/falso, sí/no y 1/0. |
| DATE | date | Fecha sin hora; rechaza horas diferentes de medianoche. |
| DATETIME | datetime | Fecha y hora sin zona horaria. |
| TIME | time | Hora sin fecha ni zona horaria. |
| TIMESTAMP | datetime | Instante con zona explícita; normaliza a UTC. |

Este componente admite los tipos escalares de la tabla. No implementa ARRAY, STRUCT/RECORD, JSON, BYTES, GEOGRAPHY, INTERVAL, RANGE ni tipos parametrizados como NUMERIC(10,2). Las conversiones son estrictas: no redondea automáticamente decimales que exceden la escala.

Para números almacenados como texto, indica separador decimal `,` y de miles `.` si el origen contiene `1.234,56`. Enter en miles significa sin separador; `ESPACIO` permite `1 234,56`. Los números reales de Excel no se reinterpretan según estos separadores. Excel puede haber perdido precisión antes de la lectura; para decimales extensos e identificadores guarda texto en origen.

Formatos predeterminados para valores temporales en texto:

| Tipo | Formato | Ejemplo |
| --- | --- | --- |
| DATE | `%Y-%m-%d` | `2026-09-24` |
| DATETIME | `%Y-%m-%d %H:%M:%S` | `2026-09-24 10:30:00` |
| TIME | `%H:%M:%S` | `10:30:00` |
| TIMESTAMP | `%Y-%m-%d %H:%M:%S%z` | `2026-09-24 10:30:00-0300` |

Puedes ingresar `%d/%m/%Y` para fechas como `24/09/2026` o añadir `.%f` para fracciones de segundo. Los valores temporales nativos de Excel ya llegan tipados y no usan el formato de texto. Como Excel no almacena zonas horarias, usa DATETIME para sus fechas nativas; TIMESTAMP requiere texto con desplazamiento explícito. No se supone una zona horaria local.

En JSON, Decimal y valores temporales se guardan como texto para preservar precisión y representación; int, float y bool mantienen sus tipos JSON. La salida es una lista de registros y no un archivo de carga NDJSON ni un esquema de BigQuery.

## Diseño y uso desde código

El módulo usa nombres en inglés, anotaciones de tipos y responsabilidades separadas:

- `SharePointSettings`, `ColumnSchema`, `ExtractionRequest`: contratos inmutables y validación de entradas.
- `load_settings`: lectura del entorno y `.env`.
- `create_client_context`: configura OAuth con tenant/client ID y código de dispositivo.
- `SharePointClient.verify_connection`: ejecuta la primera consulta y devuelve el título del sitio.
- `SharePointClient`: acceso de solo lectura mediante SharePoint REST; recibe el contexto como dependencia. Resuelve el título de la biblioteca a su ruta real antes de descargar.
- `convert_value`, `extract_records`: conversión y extracción, sin interacción de consola ni llamadas de red.
- `prompt_extraction_request`: interacción con el usuario.
- `read_sharepoint_excel`: coordinación de conexión y extracción.
- `save_records`, `main`: salida JSON y punto de entrada de consola.

No se inicia sesión ni se solicita información al importar el módulo. Ejemplo desde la raíz del proyecto:

```python
from App.panel_mantenimiento.connection_sharepoint import (
    ColumnSchema, ExtractionRequest, load_settings, read_sharepoint_excel,
)

request = ExtractionRequest(
    library="Documentos",
    folder="Reportes/2026",
    file_name="mantenimiento.xlsx",
    sheet_name="Equipos",
    columns=(
        ColumnSchema("Codigo", "STRING", nullable=False),
        ColumnSchema("Cantidad", "INT64"),
        ColumnSchema("Costo", "NUMERIC", decimal_separator=",", thousands_separator="."),
        ColumnSchema("Fecha", "DATE", date_format="%d/%m/%Y"),
    ),
)
records = read_sharepoint_excel(load_settings(), request)
```

La firma de `read_sharepoint_excel` recibe únicamente configuración general y solicitud de extracción. Para procesar una copia local, reutiliza `request` del ejemplo:

```python
from pathlib import Path
from App.panel_mantenimiento.connection_sharepoint import extract_records

records = extract_records(Path("ruta/al/mantenimiento.xlsx").read_bytes(), request)
```

## Validaciones y límites

Se rechazan columnas seleccionadas duplicadas, encabezados ausentes o duplicados, tipos no soportados, nulos no permitidos y conversiones incompatibles. Los errores de conversión identifican fila y columna. Se omiten filas completamente vacías y se cierra el libro incluso ante errores.

Se lee el último resultado guardado de las fórmulas; no se recalculan. Guarda el libro recalculado antes de usarlo. Los formatos visuales de Excel, como ceros iniciales en números, no se aplican a los valores leídos. El libro remoto permanece intacto. La descarga y los registros se mantienen en memoria: el componente está pensado para libros que quepan en la memoria disponible.

## Registro de cambios

### 2026-09-24

#### Restauración de tenant ID y client ID (versión actual)

- Restablecidos `TENANT_ID` y `CLIENT_ID` en `.env` conservando la URL del sitio.
- Reemplazado `UserCredential` por `ClientContext.with_device_flow` con scope SharePoint `/.default`.
- Eliminados parámetros y preguntas de usuario/contraseña; sesión de Microsoft mediante navegador y código.
- Añadida comprobación explícita del sitio antes de la descarga.
- Actualizado `test.py`: prueba básica de conexión por defecto y descarga opcional con `--download`, sin ejecución al importar ni escritura duplicada.
- El modo `--download` reutiliza el formulario de extracción (incluye hoja y columnas), aunque solo comprueba la descarga del archivo, no sus conversiones.
- Fijado rango de dependencia Office365-REST-Python-Client `>=3.1.0,<4`, conservando las otras dependencias del proyecto.
- Ajustado `main.bat` para ejecutarse desde su propia carpeta y detenerse si falla la activación o instalación.
- Actualizadas pruebas de contexto, scope, verificación del sitio y fallos, junto con instrucciones y ejemplos.

#### Cambio a ClientContext con contraseña (histórico, reemplazado)

- Sustituidos MSAL, Microsoft Graph y el flujo de dispositivo por `ClientContext` con `UserCredential`.
- Eliminados tenant y client ID del código y `.env`, conservando la URL existente.
- Agregados usuario por consola y contraseña oculta con `getpass`, sin persistencia.
- Descarga a memoria mediante la ruta real de la biblioteca y errores sin datos del proveedor.
- Documentados retiro de IDCRL, incompatibilidad con MFA y alternativa de lectura local.
- Restauradas constantes NUMERIC/BIGNUMERIC ausentes del archivo actual, necesarias para las conversiones existentes.
- Actualizados API, instalación y pruebas simuladas de contexto y descarga.
- Ajustadas rutas a `App/panel_mantenimiento`, ubicación a la que se movieron los archivos durante el cambio.

#### Versión inicial (histórico: autenticación reemplazada)

- Reemplazados `sharepoint_excel.py` y `sharepoint_excel.md` por `connection_sharepoint.py` y este documento.
- Eliminado `sharepoint_excel.config.json`: configuración general en `.env`, selección del Excel y sus columnas por consola.
- Renombrados identificadores a inglés y separadas responsabilidades con contratos tipados e inmutables.
- Sustituidos tipos en español por tipos BigQuery, con validación de rangos, escala, nulos y zonas horarias.
- Agregados FLOAT64, BIGNUMERIC, TIME y TIMESTAMP, además de alias comunes.
- Agregadas validaciones de entradas interactivas y protección contra sobrescritura de archivos.
- Conservados acceso Microsoft Graph de solo lectura, descarga sin reenviar el token y errores por fila/columna.
- Incorporada dependencia `python-dotenv` y exclusiones locales de Git.
- Agregadas pruebas locales de límites numéricos (incluido el mínimo asimétrico de BIGNUMERIC), nulos, zonas horarias, selección de columnas, errores e interacción por consola.

Toda modificación futura del componente debe actualizar este documento, tanto el comportamiento afectado como el registro de cambios.

## Pruebas

```powershell
python -m unittest discover -s App/panel_mantenimiento -p test_connection_sharepoint.py
```

Las pruebas simulan libro y conexión para verificar conversiones, interacción, tenant/client ID, scope, descarga y errores sin acceder a Microsoft. No certifican autenticación real.

Prueba manual básica con la configuración real:

```powershell
python App/panel_mantenimiento/test.py
# Opcional: comprobar también la descarga del Excel
python App/panel_mantenimiento/test.py --download
```

La descarga de prueba se guarda junto a `test.py`, una sola vez y sin sobrescribir archivos. Completar `TENANT_ID`, `CLIENT_ID`, permisos y consentimiento es necesario antes de estas pruebas. No se ejecutó inicio de sesión real durante la actualización. La ejecución automatizada en `venv_mtto` quedó pendiente: el entorno devolvió acceso denegado y no se autorizó el reintento fuera de ese entorno.

## Referencias

- [Tipos de datos de BigQuery](https://cloud.google.com/bigquery/docs/reference/standard-sql/data-types).
- [Office365-REST-Python-Client](https://github.com/vgrem/Office365-REST-Python-Client).
- [Retiro de IDCRL y migración a autenticación moderna](https://devblogs.microsoft.com/microsoft365dev/migrating-from-idcrl-authentication-to-modern-authentication-in-sharepoint/).
