"""Publicación transportable: mismos cálculos Python, sin servidor en la consulta.

Cada intervalo contiguo de columnas de lectura se calcula una vez. Cualquier
fecha elegida por el usuario se resuelve contra esas columnas, como en la API.
"""
import base64
import gzip
import json
import os
import tempfile
from datetime import date, timedelta
from pathlib import Path
from .base_datos import leer_fuentes, leer_configuracion
from .excel import convertir_fecha, normalizar
from .reportes import crear_reporte
from .seguimiento_hoja import crear_seguimiento
from .programa import crear_programa
from .cecos import catalogo_cecos
from .zonas import enriquecer_zonas


def crear_publicacion(bd):
    excel, maestro, estado = leer_fuentes(bd)
    hoy = date.fromisoformat(estado['actualizado'][:10])
    fechas = []
    hoja = next(h for h in excel if normalizar(h.title) == 'SEGUIMIENTO KM-HR')
    for fila in hoja.filas[:20]:
        if 'PATENTE' in {normalizar(c) for c in fila} and 'INTERVALO' in {normalizar(c) for c in fila}:
            fechas = sorted(d for c in fila if (d := convertir_fecha(c, excel.epoch)))
            break
    if len(set(fechas)) != len(fechas):
        raise ValueError('Seguimiento KM-HR: hay columnas con fechas duplicadas.')
    datos = dict(estado=estado, configuracion=leer_configuracion(bd), cecos_codigos=catalogo_cecos(maestro),
                 fechas=[d.isoformat() for d in fechas], reportes={}, intervalos={}, programas={})
    imagenes = Path(__file__).resolve().parent.parent / 'web/img'
    datos['imagenes'] = {p.name: 'data:image/png;base64,' + base64.b64encode(p.read_bytes()).decode()
                         for p in imagenes.glob('*.png')}
    martes = date(2026, 8, 4)
    ultimo = hoy + timedelta(days=1-hoy.weekday())
    while martes <= ultimo:
        reporte = crear_reporte(excel, maestro, martes)
        enriquecer_zonas(reporte, excel, maestro)
        reporte['actualizado'] = reporte['bd_actualizada'] = estado['actualizado']
        datos['reportes'][martes.isoformat()] = reporte
        martes += timedelta(days=7)
    for i, inicio in enumerate(fechas):
        for j in range(i, len(fechas)):
            if (fechas[j]-inicio).days // 7 + 1 > 104:
                break
            resultado = crear_seguimiento(excel, maestro, fechas[j], inicio, incluir_estado=True)
            enriquecer_zonas(resultado, excel, maestro)
            resultado['bd_actualizada'] = estado['actualizado']
            datos['intervalos'][f'{i}:{j}'] = resultado
    programa = crear_programa(excel, hoy.strftime('%Y-%m'))
    meses = {h['mes'] for h in programa['historico']} | {hoy.strftime('%Y-%m')}
    for mes in sorted(meses):
        resultado = crear_programa(excel, mes)
        resultado['bd_actualizada'] = estado['actualizado']
        enriquecer_zonas(resultado, excel, maestro)
        datos['programas'][mes] = resultado
    contenido = json.dumps(datos, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode()
    comprimido = base64.b64encode(gzip.compress(contenido, mtime=0)).decode()
    return ('// Publicación generada por Actualizar_BD.bat.\n'
            'window.PublicacionFecha = "' + estado['actualizado'][:10] + '";\n'
            'window.PublicacionMantenimientoGzip = "' + comprimido + '";\n').encode()


def publicar_consulta(bd, destino):
    contenido = crear_publicacion(bd)
    destino = Path(destino)
    destino.parent.mkdir(parents=True, exist_ok=True)
    descriptor, nombre = tempfile.mkstemp(dir=destino.parent, suffix='.tmp')
    try:
        with os.fdopen(descriptor, 'wb') as archivo:
            archivo.write(contenido)
        os.replace(nombre, destino)
    finally:
        Path(nombre).unlink(missing_ok=True)


def actualizar_configuracion_publicada(destino, configuracion, bd=None):
    """Actualiza solo las preferencias, conservando todos los cálculos publicados."""
    destino = Path(destino)
    contenido = destino.read_text(encoding='utf-8') if destino.exists() else crear_publicacion(bd).decode('utf-8')
    prefijo = 'window.PublicacionMantenimientoGzip = "'
    inicio = contenido.index(prefijo) + len(prefijo)
    fin = contenido.index('"', inicio)
    datos = json.loads(gzip.decompress(base64.b64decode(contenido[inicio:fin])))
    datos['configuracion'] = configuracion
    comprimido = base64.b64encode(gzip.compress(json.dumps(datos, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode(), mtime=0)).decode()
    descriptor, temporal = tempfile.mkstemp(dir=destino.parent, suffix='.tmp')
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as archivo:
            archivo.write(contenido[:inicio] + comprimido + contenido[fin:])
        os.replace(temporal, destino)
    finally:
        Path(temporal).unlink(missing_ok=True)
