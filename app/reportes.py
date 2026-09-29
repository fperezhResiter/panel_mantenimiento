"""Reportabilidad exclusiva de formularios semanales ADC."""
from collections import defaultdict
from datetime import datetime, timedelta
from .excel import leer_tabla, normalizar, patente_valida, convertir_fecha, TIPO_ADC

def crear_reporte(excel, maestro, fecha):
    inicio, fin = fecha - timedelta(days=3), fecha + timedelta(days=1)
    mapa = defaultdict(set)
    advertencias = []
    activos, _, _ = leer_tabla(maestro, ['NOMBRE CeCo ACTUAL', 'REGION ACTUAL', 'PATENTE'])
    for ceco, region, patente in activos:
        ceco, region = normalizar(ceco), normalizar(region)
        if ceco and region.startswith('REGION '):
            mapa[ceco].add(region)

    def region_ceco(ceco):
        regiones = mapa.get(ceco, set())
        return next(iter(regiones)) if len(regiones) == 1 else 'SIN REGIÓN'


    base = defaultdict(set)
    reportadas = defaultdict(set)
    invalidas_maestro = 0
    for ceco, region, patente in activos:
        patente = patente_valida(patente)
        if patente is None:
            invalidas_maestro += 1
            continue
        ceco = normalizar(ceco) or 'SIN CECO'
        base[ceco].add(patente)

    filas, epoch, hoja = leer_tabla(excel, ['Hora de finalización', 'CeCo (Centro de costo)', 'REGION', 'PATENTE', 'Reportabilidad a realizar'])
    invalidas = sin_patente = filas_periodo = 0
    fechas = []
    for hora, ceco, region, patente, tipo in filas:
        if normalizar(tipo) != normalizar(TIPO_ADC):
            continue
        dia = convertir_fecha(hora, epoch)
        if dia is None:
            invalidas += 1
            continue
        fechas.append(dia)
        if not inicio <= dia <= fin:
            continue
        filas_periodo += 1
        patente = patente_valida(patente)
        if patente is None:
            sin_patente += 1
            continue
        ceco = normalizar(ceco) or 'SIN CECO'
        reportadas[ceco].add(patente)
    grupos = defaultdict(list)
    for ceco in sorted(base.keys() | reportadas.keys()):
        cantidad, esperado = len(reportadas[ceco]), len(base[ceco])
        fuera = len(reportadas[ceco] - base[ceco])
        grupos[region_ceco(ceco)].append({'ceco': ceco, 'reportadas': cantidad, 'total': esperado,
            'porcentaje': cantidad / esperado * 100 if esperado else None, 'fuera_maestro': fuera})
    regiones_resultado = []
    for region, detalle in sorted(grupos.items()):
        cantidad, esperado = sum(c['reportadas'] for c in detalle), sum(c['total'] for c in detalle)
        regiones_resultado.append({'region': region, 'cecos': detalle, 'reportadas': cantidad, 'total': esperado,
            'porcentaje': cantidad / esperado * 100 if esperado else None})
    cantidad = sum(r['reportadas'] for r in regiones_resultado)
    esperado = sum(r['total'] for r in regiones_resultado)
    fuera = sum(c['fuera_maestro'] for r in regiones_resultado for c in r['cecos'])
    if invalidas:
        advertencias.append(f'{invalidas} filas del archivo tienen fecha vacía o inválida y no se cuentan.')
    if sin_patente:
        advertencias.append(f'{sin_patente} filas del período sin patente válida (incluye REVISAR) fueron excluidas.')
    if invalidas_maestro:
        advertencias.append(f'{invalidas_maestro} filas del maestro sin patente válida fueron excluidas del total.')
    if fuera:
        advertencias.append(f'{fuera} patentes reportadas por CeCo no figuran en el maestro de ese CeCo. Se incluyen en Reportadas; el porcentaje puede superar 100%.')
    if 'SIN REGIÓN' in grupos:
        advertencias.append('Los CeCo sin región única en el maestro se muestran en SIN REGIÓN; sus patentes se incluyen en los totales.')
    if any(len(regiones) > 1 for regiones in mapa.values()):
        advertencias.append('Hay CeCo con varias regiones en el maestro; se agrupan en SIN REGIÓN para evitar duplicar el conteo.')
    return {'version_reporte': 2, 'fecha': fecha.isoformat(), 'inicio': inicio.isoformat(), 'fin': fin.isoformat(),
            'reportadas': cantidad, 'total': esperado, 'porcentaje': cantidad / esperado * 100 if esperado else None,
            'regiones': regiones_resultado, 'advertencias': advertencias,
            'filas_fuente': len(filas), 'filas_periodo': filas_periodo, 'fuera_maestro': fuera,
            'fuente': excel.name, 'hoja': hoja, 'actualizado': datetime.now().isoformat(timespec='seconds'),
            'min_fecha': min(fechas).isoformat() if fechas else None, 'max_fecha': max(fechas).isoformat() if fechas else None}


