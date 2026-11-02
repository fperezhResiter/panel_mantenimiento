"""Base y asignación propias de cada martes; Sheet1 acredita los envíos ADC."""
import json
from collections import defaultdict
from datetime import date, datetime, timedelta
from .excel import leer_tabla, normalizar, patente_valida, convertir_fecha, TIPO_ADC
from .vigencia import Vigencias


def sumar(filas, efectiva=False):
    campos = ['reportadas', 'total', 'fuera_maestro'] + (['reportadas_totales'] if efectiva else [])
    arrays = ['historico', 'historico_completo', 'historico_base', 'historico_completo_base']
    if efectiva:
        arrays += ['historico_reportadas', 'historico_completo_reportadas']
    resultado = {c: sum(f.get(c, 0) for f in filas) for c in campos}
    for c in arrays:
        resultado[c] = [sum(f[c][i] for f in filas) for i in range(len(filas[0][c]))] if filas else []
    resultado['porcentaje'] = 100 * resultado['reportadas'] / resultado['total'] if resultado['total'] else None
    estados = sorted({s['status'] for f in filas for s in f.get('por_status', [])})
    if estados:
        resultado['por_status'] = [{'status': s, **sumar([e for f in filas for e in f.get('por_status', []) if e['status'] == s], efectiva)} for s in estados]
    if efectiva and any('por_criterios' in f for f in filas):
        resultado['por_criterios'] = {str(m): sumar([f['por_criterios'][str(m)] for f in filas], efectiva) for m in range(8)}
    return resultado


def crear_reporte_vigencia(excel, maestro, fecha, efectiva=False):
    from .reportes import estados_equipo
    from .reportabilidad_efectiva import evaluar_criterios
    primera = date(2026, 8, 4)
    fecha += timedelta(days=1-fecha.weekday())
    if fecha < primera:
        raise ValueError('La primera semana del reporte es el martes 4 de agosto de 2026.')
    fechas = [primera + timedelta(weeks=i) for i in range((fecha-primera).days//7+1)]
    semanas = [dict(numero=i+1, fecha=d.isoformat(), inicio=(d-timedelta(days=1)).isoformat(),
                    fin=(d+timedelta(days=3)).isoformat()) for i, d in enumerate(fechas)]
    vigencias, estados = Vigencias(maestro), estados_equipo(maestro)
    from .excel import abrir_libro
    ubicaciones = defaultdict(set)
    patentes_maestro = {}
    libro = abrir_libro(maestro)
    try:
        activos = next(h for h in libro if normalizar(h.title) == 'BD ACTIVOS MOVILES').iter_rows(values_only=True)
        columnas_maestro = {normalizar(c): i for i, c in enumerate(next(activos, ())) if c}
        for f in activos:
            def valor(c):
                i = columnas_maestro.get(c)
                return normalizar(f[i]) if i is not None and i < len(f) else ''
            p = patente_valida(valor('PATENTE'))
            if p:
                u = valor('NOMBRE CECO ACTUAL') or 'SIN CECO'
                r, z = valor('REGION ACTUAL') or 'SIN REGIÓN', valor('ZONA ACTUAL') or 'SIN ZONA'
                ubicaciones[u].add((r, z))
                patentes_maestro[p] = dict(patente=p, ceco=u, region=r, zona=z,
                    motivo='Sin registro en VIGENCIA', status=estados.get(p, 'SIN STATUS'))
    finally:
        libro.close()
    asignaciones = []
    bases = [defaultdict(set) for _ in fechas]
    grupos = set()
    def clave(a):
        return a['region'], a['zona'], a['unidad'], a['linea']
    advertencias = list(vigencias.advertencias)
    for j, d in enumerate(fechas):
        asignadas = {}
        for p in vigencias.periodos:
            a, motivo = vigencias.resolver(p, d)
            if a:
                k = clave(a)
                bases[j][k].add(p)
                grupos.add(k)
                asignadas[p] = a
            elif motivo == 'Vigencias superpuestas':
                advertencias.append(f'{p}: períodos superpuestos al {d.isoformat()}; no se incluye hasta corregirlos.')
        asignaciones.append(asignadas)
    columnas = ['Hora de finalización', 'CeCo (Centro de costo)', 'REGION', 'PATENTE', 'Reportabilidad a realizar']
    if efectiva:
        columnas += ['Unidad de Control del equipo', 'Kilometraje actual (km)', 'Horómetro actual (hrs)']
    filas, epoch, hoja = leer_tabla(excel, columnas, nombre_hoja='Sheet1')
    # Todas las unidades declaradas se conservan para auditoría; la evaluación
    # efectiva selecciona el último envío de la patente tras la reasignación.
    reasignadas = []
    evaluacion_fila = {}
    fechas_fuente = []
    incidencias = {}
    diferencias = defaultdict(set)
    invalidas = sin_patente = filas_periodo = 0
    for i, fila in enumerate(filas):
        valores = list(fila)
        if normalizar(fila[4]) != normalizar(TIPO_ADC):
            reasignadas.append(tuple(valores))
            continue
        dia = convertir_fecha(fila[0], epoch)
        if dia is None:
            invalidas += 1
            reasignadas.append(tuple(valores))
            continue
        fechas_fuente.append(dia)
        j = (dia-primera+timedelta(days=1)).days//7
        dentro = 0 <= j < len(semanas) and semanas[j]['inicio'] <= dia.isoformat() <= semanas[j]['fin']
        p = patente_valida(fila[3])
        if dentro and j == len(fechas)-1:
            filas_periodo += 1
            sin_patente += p is None
        if dentro and p:
            a = asignaciones[j].get(p)
            if a:
                valores[1] = a['unidad']
                evaluacion_fila[i] = (j, clave(a), p)
                if normalizar(fila[1]) != a['unidad']:
                    diferencias[(j, p)].add(normalizar(fila[1]) or 'SIN CECO')
            elif j == len(fechas)-1:
                _, motivo = vigencias.resolver(p, fechas[j])
                k = p, normalizar(fila[1]) or 'SIN CECO'
                r, z = next(iter(ubicaciones[k[1]])) if len(ubicaciones[k[1]]) == 1 else (normalizar(fila[2]) or 'SIN REGIÓN', 'SIN ZONA')
                incidencias[k] = dict(patente=p, ceco=k[1], region=r, zona=z,
                    status=estados.get(p, 'SIN STATUS'), motivo=motivo)
        reasignadas.append(tuple(valores))
    evaluaciones = evaluar_criterios(reasignadas, epoch, semanas) if efectiva else {}
    historias = {m: [defaultdict(set) for _ in fechas] for m in (range(8) if efectiva else [0])}
    for i, (j, k, p) in evaluacion_fila.items():
        historias[0][j][k].add(p)
        if efectiva and i in evaluaciones:
            for mascara in range(1, 8):
                if evaluaciones[i] & mascara == mascara:
                    historias[mascara][j][k].add(p)
    principal = 7 if efectiva else 0
    def resumen(k, conjunto, mascara):
        hb = [len(b[k] & conjunto) for b in bases]
        hr = [len(h[k] & conjunto) for h in historias[mascara]]
        r = dict(total=hb[-1], reportadas=hr[-1], fuera_maestro=0,
                 porcentaje=100*hr[-1]/hb[-1] if hb[-1] else None,
                 historico=hr[-4:], historico_completo=hr,
                 historico_base=hb[-4:], historico_completo_base=hb)
        if efectiva:
            ht = [len(h[k] & conjunto) for h in historias[0]]
            r.update(reportadas_totales=ht[-1], historico_reportadas=ht[-4:], historico_completo_reportadas=ht)
        return r
    region_unidad = defaultdict(lambda: defaultdict(list))
    zonales = defaultdict(list)
    for k in sorted(grupos):
        region, zona, unidad, linea = k
        patentes = set().union(*(b[k] for b in bases))
        por_status = defaultdict(set)
        for p in patentes:
            por_status[estados.get(p, 'SIN STATUS')].add(p)
        def con_status(m):
            return {**resumen(k, patentes, m), 'por_status': [dict(status=s, **resumen(k, ps, m)) for s, ps in sorted(por_status.items())]}
        c = dict(ceco=unidad, linea=linea, region_origen=region, **con_status(principal))
        if efectiva:
            c['por_criterios'] = {str(m): con_status(m) for m in range(8)}
        region_unidad[region][unidad].append(c)
        zonales[zona].append({**c, 'ceco': json.dumps([zona, unidad, linea], ensure_ascii=False)})
    regiones = []
    for region, unidades in sorted(region_unidad.items()):
        cs = [dict(ceco=u, **sumar(ls, efectiva)) for u, ls in sorted(unidades.items())]
        regiones.append(dict(region=region, cecos=cs, **sumar(cs, efectiva)))
    detalle_zona = [dict(region=z, cecos=cs, **sumar(cs, efectiva)) for z, cs in sorted(zonales.items())]
    if invalidas:
        advertencias.append(f'{invalidas} filas ADC tienen fecha vacía o inválida y no se cuentan.')
    if sin_patente:
        advertencias.append(f'{sin_patente} filas ADC de la semana sin patente válida fueron excluidas.')
    if incidencias:
        advertencias.append(f'{len({p for p, _ in incidencias})} patentes reportadas no tienen asignación vigente única al martes; se conservan en el detalle de reportes fuera de base.')
    pendientes = [f for p, f in patentes_maestro.items() if p not in vigencias.periodos]
    for p, periodos in vigencias.periodos.items():
        _, motivo = vigencias.resolver(p, fecha)
        if motivo in ('Fechas de vigencia incompletas o inválidas', 'Vigencias superpuestas'):
            for a in periodos:
                pendientes.append(dict(patente=p, ceco=a['unidad'], region=a['region'], zona=a['zona'],
                    linea=a['linea'], status=estados.get(p, 'SIN STATUS'), motivo=motivo))
    totales = sumar([c for r in regiones for c in r['cecos']], efectiva)
    return dict(version_reporte=3, base_semanal='VIGENCIA',
        **({'reportabilidad_efectiva': True, 'version_criterios_efectiva': 1} if efectiva else {}),
        **totales, semanas=semanas[-4:], semanas_completas=semanas, semana=len(fechas),
        fecha=fecha.isoformat(), inicio=semanas[-1]['inicio'], fin=semanas[-1]['fin'],
        regiones=regiones, detalle_zona=detalle_zona, advertencias=list(dict.fromkeys(advertencias)),
        incidencias_vigencia=list(incidencias.values()),
        pendientes_vigencia=pendientes,
        cecos_codigos_vigencia={u: next(iter(cs)) for u in {a['unidad'] for a in asignaciones[-1].values()}
            if len(cs := {a['codigo'] for a in asignaciones[-1].values() if a['unidad'] == u and a['codigo']}) == 1},
        reasignaciones=[dict(patente=p, cecos_declarados=sorted(us), unidad_vigente=asignaciones[j][p]['unidad'])
                       for (j, p), us in diferencias.items() if j == len(fechas)-1],
        status_equipo_disponibles=sorted({s['status'] for r in regiones for c in r['cecos'] for s in c['por_status']}),
        filas_fuente=len(filas), filas_periodo=filas_periodo, fuente=excel.name,
        hoja=hoja+' / VIGENCIA / BD ACTIVOS MOVILES', actualizado=datetime.now().isoformat(timespec='seconds'),
        min_fecha=min(fechas_fuente).isoformat() if fechas_fuente else None,
        max_fecha=max(fechas_fuente).isoformat() if fechas_fuente else None)
