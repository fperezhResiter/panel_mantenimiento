# Revisión de componentes conservados

No se eliminó ningún archivo. Esta lista distingue código que dejó de ejecutar Reportabilidad de recursos que siguen sosteniendo otros paneles.

## Fuera del cálculo nuevo

| Componente | Situación | Alcance de una eliminación posterior |
| --- | --- | --- |
| `app/reportes.py` → función `crear_reporte_maestro_anterior` | Conserva el cálculo anterior con base fija; no tiene llamadas desde la aplicación. | Se puede retirar esa función cuando se decida cerrar la compatibilidad de código anterior. Conservar `estados_equipo` y `crear_reporte`. |
| `app/reportes.py` → argumento `clasificar` de `crear_reporte` | El nuevo motor recibe sus dimensiones de VIGENCIA y no usa ese argumento. | Se puede retirar junto con las llamadas antiguas que aún lo pasan. |
| `app/zonas.py` → rama de Reportabilidad que vuelve a llamar a `crear_reporte` con un clasificador GDM | Las respuestas v3 ya contienen `detalle_zona` y retornan antes de esa rama. | Se puede retirar esa rama cuando se retire el soporte para objetos de reporte anteriores. No retirar la clase ni las ramas de otros paneles. |
| `Datos/mantenimiento-ggmrdcfk.sqlite3` | Archivo antiguo sin referencias en los lanzadores ni en la configuración de la aplicación. La BD activa es `Datos/mantenimiento.sqlite3`. | Revisar si se quiere conservar como respaldo antes de borrarlo. |
| `tmp/` y `output/pdf/` | Capturas, CSV y PDF de revisiones; no son entradas operativas del portal. Las pruebas vuelven a producir resultados allí. | Revisar individualmente los resultados que se quieran conservar. No es necesario borrarlos para aplicar VIGENCIA. |

## Siguen siendo necesarios

- `app/reportes_vigencia.py`, `app/vigencia.py`: cálculo nuevo.
- `app/reportabilidad_efectiva.py`: comparación de lecturas y criterios.
- `app/catalogo_zonas.py`, `scripts/importar_zonas.py`, `config/unidades_zonas.json` y el libro GDM: asociaciones usadas por los otros paneles.
- `app/zonas.py`: enriquecimiento de Seguimiento, Resumen, Calendario y Programa.
- `web/js/zonas.js`: selector de modo, filtros de líneas y agregación de resultados, incluidos los de Reportabilidad.
- `web/pages/Panel_Reportabilidad_Efectiva.html`: redirección compatible con enlaces anteriores al panel unificado.
- `Datos/mantenimiento.sqlite3` y `web/datos/publicacion.js`: BD y publicación activas.
- `tests/`: validación; los casos de vigencia también comprueban la integración con los filtros y las descargas.

Las carpetas de fuentes, bibliotecas locales, imágenes, lanzadores Windows/Mac y preferencias no se consideran sobrantes por este cambio.
