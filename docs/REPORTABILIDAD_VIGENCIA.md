# Reportabilidad con base semanal

Reportabilidad total y efectiva usan VIGENCIA para la base y la asignación histórica de cada patente. Sheet1 acredita el envío ADC y aporta las lecturas. BD ACTIVOS MOVILES aporta el status actual por patente y permite detectar equipos del maestro pendientes de vigencia.

## Corte y asignación

- El corte es el martes seleccionado. Inicio y fin de vigencia son inclusivos; fin vacío mantiene abierto el período.
- Región, zona, Unidad, código CeCo y línea corresponden al único período vigente en ese martes. El catálogo GDM no interviene en Reportabilidad.
- Los envíos se buscan entre lunes y viernes completos, conservando la ventana ADC existente.
- Una patente se cuenta una sola vez por semana y se atribuye a su Unidad vigente, aunque Sheet1 declare otro CeCo. Los CeCo declarados se conservan en las reasignaciones de la respuesta API/publicación.
- La base histórica se calcula para cada martes. Altas, bajas y traslados cambian sus denominadores; una semana sin base muestra —.
- Efectividad usa el último envío de la patente después de reasignar todas sus unidades declaradas. Mantiene el antecedente numérico anterior de la misma patente y medidor, incluso antes del período o en otra Unidad. Se conservan los ocho conjuntos de criterios.
- El filtro Status usa el estado actual del maestro en todas las semanas; no representa un historial de estados.

## Fuera de base y datos pendientes

No se inventan fechas, no se usa el maestro actual como reemplazo silencioso de un período ausente y no se elige una fila entre vigencias superpuestas. Los envíos sin una asignación vigente única se conservan en `incidencias_vigencia`, separados del numerador. Las patentes del maestro sin registro y las asignaciones con fechas inválidas o superpuestas se conservan en `pendientes_vigencia`. El panel muestra ambos conjuntos filtrados por su origen. La descarga de pendientes en un CSV independiente está disponible únicamente en modo interactivo; en consulta sin servidor se conserva el detalle visible.

Los porcentajes se obtienen dividiendo cantidades de la misma base vigente. Una patente ajena a ella nunca eleva el cumplimiento. Los registros que existen únicamente en VIGENCIA pueden formar parte de una base histórica; si no tienen status en el maestro actual quedan en SIN STATUS.

Los nombres de línea son los registrados en el período, sin traducción del catálogo de zonas. Los datos contradictorios del origen deben corregirse en el Excel; el panel no inventa su interpretación.

## Actualización y consulta

Actualizar_BD importa también VIGENCIA a la BD propia y regenera la publicación local de todos los paneles. Conserva las preferencias y las demás tablas. La API y la publicación comparten el mismo cálculo. Las respuestas v3 incluyen `historico_base` y `historico_completo_base` en cada grupo, status y combinación de criterios. Región y zona suman numeradores y denominadores; el historial, los tooltips, CSV y PDF usan la base propia de cada semana.

Cambiar el Excel requiere volver a actualizar la BD. Una BD antigua sin VIGENCIA informa que debe actualizarse. El libro fuente se lee sin modificarlo.

El catálogo GDM continúa en Seguimiento, Resumen, Calendario y Programa. No debe borrarse por este cambio de Reportabilidad.
