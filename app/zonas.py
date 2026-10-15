"""Clasificación actual por unidad/CeCo y línea, sin usar la zona AF."""
import json
from collections import defaultdict
from pathlib import Path
from .excel import abrir_libro, normalizar, patente_valida
from .cecos import catalogo_cecos

CATALOGO = Path(__file__).resolve().parent.parent / 'config/unidades_zonas.json'


class ClasificadorZonas:
    def __init__(self, maestro):
        catalogo = getattr(maestro, 'catalogo_zonas', None)
        self.catalogo = (catalogo if catalogo is not None else json.loads(CATALOGO.read_text(encoding='utf-8')))['unidades']
        self.codigos_unidades = catalogo_cecos(maestro)
        self.activos = defaultdict(set)
        libro = abrir_libro(maestro)
        try:
            hoja = next(h for h in libro if normalizar(h.title) == 'BD ACTIVOS MOVILES')
            filas = hoja.iter_rows(values_only=True)
            indices = {normalizar(v): i for i, v in enumerate(next(filas))}
            for fila in filas:
                def valor(nombre):
                    i = indices.get(nombre)
                    return fila[i] if i is not None and i < len(fila) else None
                patente = patente_valida(valor('PATENTE'))
                if patente:
                    self.activos[(normalizar(valor('NOMBRE CECO ACTUAL')), patente)].add((
                        normalizar(valor('CECO ACTUAL')), normalizar(valor('LN')),
                        normalizar(valor('NOMBRE LN'))))
        finally:
            libro.close()

    def resolver(self, unidad, patente=None):
        unidad = normalizar(unidad) or 'SIN CECO'
        activos = self.activos.get((unidad, patente_valida(patente)), set())
        codigo, ln, nombre_ln = next(iter(activos)) if len(activos) == 1 else ('', '', '')
        # Una patente histórica puede haber cambiado de unidad. La zona todavía
        # se resuelve con el CeCo único de la unidad del reporte, sin tomar la LN
        # ni la ubicación actual de otro equipo.
        if not codigo:
            codigo = self.codigos_unidades.get(unidad, '')
        exactos = [u for u in self.catalogo if unidad in
                   {normalizar(u['unidad']), *(normalizar(a) for a in u.get('alias', []))}]
        # El nombre exacto prevalece sobre un código compartido por contratos distintos.
        candidatos = [u for u in exactos if not codigo or u['ceco'] == codigo]
        if not candidatos:
            # Los alias confirmados en el catálogo definen la unidad incluso
            # cuando el maestro conserva un CeCo distinto para esa patente.
            candidatos = [u for u in exactos if unidad in
                          {normalizar(a) for a in u.get('alias', [])}]
        if not candidatos and codigo and not exactos:
            candidatos = [u for u in self.catalogo if u['ceco'] == codigo]
        zonas = {u['zona'] for u in candidatos}
        zona = next(iter(zonas)) if len(zonas) == 1 else 'SIN ZONA'
        lineas = {l['nombre'] for u in candidatos for l in u['lineas'] if l['codigo'] == ln}
        linea = next(iter(lineas)) if len(lineas) == 1 else nombre_ln or 'SIN LÍNEA'
        if not ln and candidatos:
            disponibles = {l['nombre'] for u in candidatos for l in u['lineas']}
            if len(disponibles) == 1:
                linea = next(iter(disponibles))
        return {'zona': zona, 'linea': linea, 'unidad_nombre': unidad}

    def clave(self, unidad, patente):
        d = self.resolver(unidad, patente)
        return json.dumps([d['zona'], d['unidad_nombre'], d['linea']], ensure_ascii=False)


def enriquecer_zonas(datos, excel, maestro):
    from .reportes import crear_reporte
    from .programa import crear_programa
    from datetime import date
    clasificador = ClasificadorZonas(maestro)
    if 'equipos' in datos:
        for equipo in datos['equipos']:
            equipo.update(clasificador.resolver(equipo['ceco'], equipo['patente']))
    elif 'version_reporte' in datos:
        datos['detalle_zona'] = crear_reporte(excel, maestro, date.fromisoformat(datos['fecha']), clasificador.clave)['regiones']
    elif 'historico' in datos:
        zonal = crear_programa(excel, datos['mes'], clasificador.clave)
        datos['detalle_zona'] = zonal['regiones']
        datos['historico_zona'] = zonal['historico']
    return datos
