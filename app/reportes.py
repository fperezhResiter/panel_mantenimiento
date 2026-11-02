"""Reportabilidad exclusiva de formularios semanales ADC."""
from collections import defaultdict
from datetime import date, datetime, timedelta
from .excel import abrir_libro, leer_tabla, normalizar, patente_valida, convertir_fecha, TIPO_ADC


def estados_equipo(maestro):
    """Un estado actual por patente; vacíos o conflictos quedan en SIN STATUS."""
    libro = abrir_libro(maestro)
    estados = defaultdict(set)
    try:
        hoja = next(h for h in libro if normalizar(h.title) == 'BD ACTIVOS MOVILES')
        filas = hoja.iter_rows(values_only=True)
        indices = {normalizar(c): i for i, c in enumerate(next(filas, ()))}
        columna = indices.get('STATUS DEL EQUIPO')
        for fila in filas:
            p = patente_valida(fila[indices['PATENTE']])
            if p:
                valor = fila[columna] if columna is not None and columna < len(fila) else None
                estados[p].add(normalizar(valor) or 'SIN STATUS')
    finally:
        libro.close()
    return {p: next(iter(valores)) if len(valores) == 1 else 'SIN STATUS'
            for p, valores in estados.items()}

def crear_reporte_maestro_anterior(excel, maestro, fecha, clasificar=None, efectiva=False):
    clave_ceco = lambda c, p: clasificar(c, p) if clasificar else normalizar(c) or "SIN CECO"
    primera_semana = date(2026, 8, 4)
    fecha = fecha + timedelta(days=1-fecha.weekday())
    if fecha < primera_semana:
        raise ValueError('La primera semana del reporte es el martes 4 de agosto de 2026.')
    # Martes de la semana calendario (lunes a domingo).
    semana = (fecha - primera_semana).days // 7 + 1
    fecha = primera_semana + timedelta(weeks=semana - 1)
    inicio, fin = fecha - timedelta(days=1), fecha + timedelta(days=3)
    semanas = []
    for retroceso in range(semana - 1, -1, -1):
        referencia = fecha - timedelta(weeks=retroceso)
        semanas.append({'numero': semana-retroceso, 'fecha': referencia.isoformat(),
                        'inicio': (referencia-timedelta(days=1)).isoformat(),
                        'fin': (referencia+timedelta(days=3)).isoformat()})
    historico = [defaultdict(set) for _ in semanas]
    historico_reportadas = [defaultdict(set) for _ in semanas] if efectiva else []
    if efectiva:
        historicos_criterios = {0: historico_reportadas, 7: historico,
                               **{m: [defaultdict(set) for _ in semanas] for m in range(1, 7)}}
    mapa = defaultdict(set)
    advertencias = []
    activos, _, _ = leer_tabla(maestro, ['NOMBRE CeCo ACTUAL', 'REGION ACTUAL', 'PATENTE'], nombre_hoja='BD ACTIVOS MOVILES')
    estados = estados_equipo(maestro)
    for ceco, region, patente in activos:
        ceco, region = normalizar(ceco), normalizar(region)
        if ceco and region.startswith('REGION '):
            mapa[ceco].add(region)

    def region_ceco(ceco):
        if clasificar:
            import json
            return json.loads(ceco)[0]
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
        ceco = clave_ceco(ceco, patente)
        base[ceco].add(patente)

    columnas = ['Hora de finalización', 'CeCo (Centro de costo)', 'REGION', 'PATENTE', 'Reportabilidad a realizar']
    if efectiva:
        columnas += ['Unidad de Control del equipo', 'Kilometraje actual (km)', 'Horómetro actual (hrs)']
    filas, epoch, hoja = leer_tabla(excel, columnas, nombre_hoja='Sheet1')
    if efectiva:
        from .reportabilidad_efectiva import evaluar_criterios
        evaluaciones = evaluar_criterios(filas, epoch, semanas)
        efectivas = {indice for indice, cumplidos in evaluaciones.items() if cumplidos == 7}
    invalidas = sin_patente = filas_periodo = 0
    fechas = []
    for indice, (hora, ceco, region, patente, tipo, *lecturas) in enumerate(filas):
        if normalizar(tipo) != normalizar(TIPO_ADC):
            continue
        dia = convertir_fecha(hora, epoch)
        if dia is None:
            invalidas += 1
            continue
        fechas.append(dia)
        p = patente_valida(patente)
        if p:
            for j, (s, reportes_semana) in enumerate(zip(semanas, historico)):
                if s['inicio'] <= dia.isoformat() <= s['fin']:
                    clave = clave_ceco(ceco, p)
                    if efectiva:
                        historico_reportadas[j][clave].add(p)
                        if indice in evaluaciones:
                            for mascara in range(1, 7):
                                if evaluaciones[indice] & mascara == mascara:
                                    historicos_criterios[mascara][j][clave].add(p)
                    if not efectiva or indice in efectivas:
                        reportes_semana[clave].add(p)
        if not inicio <= dia <= fin:
            continue
        filas_periodo += 1
        patente = patente_valida(patente)
        if patente is None:
            sin_patente += 1
            continue
        if efectiva and indice not in efectivas:
            continue
        ceco = clave_ceco(ceco, patente)
        reportadas[ceco].add(patente)
    grupos = defaultdict(list)
    for ceco in sorted(set(base) | set().union(*(set(h) for h in historico + historico_reportadas))):
        cantidad, esperado = len(reportadas[ceco]), len(base[ceco])
        fuera = len(reportadas[ceco] - base[ceco])
        patentes = base[ceco] | set().union(*(h[ceco] for h in historico + historico_reportadas))
        por_status = defaultdict(set)
        for p in patentes:
            por_status[estados.get(p, 'SIN STATUS')].add(p)
        def resumen_criterio(mascara, conjunto):
            historias = historicos_criterios[mascara]
            actuales = historias[-1][ceco] & conjunto
            return {'reportadas': len(actuales), 'fuera_maestro': len(actuales - base[ceco]),
                    'historico': [len(h[ceco] & conjunto) for h in historias[-4:]],
                    'historico_completo': [len(h[ceco] & conjunto) for h in historias]}

        variantes = {str(m): {**resumen_criterio(m, patentes),
                     'por_status': [{'status': s, **resumen_criterio(m, conjunto)}
                                    for s, conjunto in sorted(por_status.items())]}
                     for m in range(8)} if efectiva else {}
        desglose = []
        for status, conjunto in sorted(por_status.items()):
            reportes_status = reportadas[ceco] & conjunto
            total_status = len(base[ceco] & conjunto)
            desglose.append({'status': status, 'reportadas': len(reportes_status), 'total': total_status,
                'porcentaje': len(reportes_status) / total_status * 100 if total_status else None,
                'fuera_maestro': len(reportes_status - base[ceco]),
                'historico': [len(h[ceco] & conjunto) for h in historico[-4:]],
                'historico_completo': [len(h[ceco] & conjunto) for h in historico],
                **({'reportadas_totales': len(historico_reportadas[-1][ceco] & conjunto),
                    'historico_reportadas': [len(h[ceco] & conjunto) for h in historico_reportadas[-4:]],
                    'historico_completo_reportadas': [len(h[ceco] & conjunto) for h in historico_reportadas]} if efectiva else {})})
        grupos[region_ceco(ceco)].append({'ceco': ceco, 'reportadas': cantidad, 'total': esperado, 'por_status': desglose,
            **({'por_criterios': variantes} if efectiva else {}),
            'porcentaje': cantidad / esperado * 100 if esperado else None, 'fuera_maestro': fuera,
            'historico': [len(h[ceco]) for h in historico[-4:]],
            'historico_completo': [len(h[ceco]) for h in historico],
            **({'reportadas_totales': len(historico_reportadas[-1][ceco]),
                'historico_reportadas': [len(h[ceco]) for h in historico_reportadas[-4:]],
                'historico_completo_reportadas': [len(h[ceco]) for h in historico_reportadas]} if efectiva else {})})
    regiones_resultado = []
    for region, detalle in sorted(grupos.items()):
        cantidad, esperado = sum(c['reportadas'] for c in detalle), sum(c['total'] for c in detalle)
        regiones_resultado.append({'region': region, 'cecos': detalle, 'reportadas': cantidad, 'total': esperado,
            'porcentaje': cantidad / esperado * 100 if esperado else None,
            **({'reportadas_totales': sum(c['reportadas_totales'] for c in detalle)} if efectiva else {})})
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
        etiqueta = 'efectivas' if efectiva else 'reportadas'
        columna = 'Efectivas' if efectiva else 'Reportadas'
        advertencias.append(f'{fuera} patentes {etiqueta} por CeCo no figuran en el maestro de ese CeCo. Se incluyen en {columna}; el porcentaje puede superar 100%.')
    if 'SIN REGIÓN' in grupos:
        advertencias.append('Los CeCo sin región única en el maestro se muestran en SIN REGIÓN; sus patentes se incluyen en los totales.')
    if any(len(regiones) > 1 for regiones in mapa.values()):
        advertencias.append('Hay CeCo con varias regiones en el maestro; se agrupan en SIN REGIÓN para evitar duplicar el conteo.')
    return {'version_reporte': 2, **({'reportabilidad_efectiva': True, 'version_criterios_efectiva': 1} if efectiva else {}), 'semanas': semanas[-4:], 'semanas_completas': semanas, 'semana': semana, 'fecha': fecha.isoformat(), 'inicio': inicio.isoformat(), 'fin': fin.isoformat(),
            'reportadas': cantidad, 'total': esperado, 'porcentaje': cantidad / esperado * 100 if esperado else None,
            **({'reportadas_totales': sum(r['reportadas_totales'] for r in regiones_resultado)} if efectiva else {}),
            'regiones': regiones_resultado, 'advertencias': advertencias,
            'status_equipo_disponibles': sorted({s['status'] for r in regiones_resultado for c in r['cecos'] for s in c['por_status']}),
            'filas_fuente': len(filas), 'filas_periodo': filas_periodo, 'fuera_maestro': fuera,
            'fuente': excel.name, 'hoja': hoja, 'actualizado': datetime.now().isoformat(timespec='seconds'),
            'min_fecha': min(fechas).isoformat() if fechas else None, 'max_fecha': max(fechas).isoformat() if fechas else None}


def crear_reporte(excel, maestro, fecha, clasificar=None, efectiva=False):
    from .reportes_vigencia import crear_reporte_vigencia
    return crear_reporte_vigencia(excel, maestro, fecha, efectiva=efectiva)


