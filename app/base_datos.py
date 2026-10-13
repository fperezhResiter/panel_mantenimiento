"""Copia local SQLite de las hojas que consumen los paneles."""
import json
import os
import sqlite3
import tempfile
from contextlib import closing
from datetime import date, datetime, time
from pathlib import Path
from threading import Lock

from openpyxl import load_workbook
from .excel import normalizar

VERSION = '1'
ACTUALIZACION = Lock()
REQUERIDAS = {
    'Sheet1': ['Hora de finalización', 'CeCo (Centro de costo)', 'REGION', 'PATENTE', 'Reportabilidad a realizar'],
    'BD ACTIVOS MOVILES': ['PATENTE', 'NOMBRE CeCo ACTUAL', 'REGION ACTUAL'],
    'Seguimiento KM-HR': ['PATENTE', 'REGION ACTUAL', 'KM U HR UM', 'UN UM', 'FECHA UM', 'INTERVALO', 'UN IN', 'STATUS EQUIPO'],
    'PROGRAMA': ['REGION ACTUAL', 'NOMBRE CeCo ACTUAL', 'PATENTE', 'FECHA PROYECTADA', 'ESTADO'],
}


def codificar(valor):
    if isinstance(valor, (datetime, date, time)):
        return {'tipo': type(valor).__name__, 'valor': valor.isoformat()}
    raise TypeError(f'Tipo de celda no compatible: {type(valor).__name__}')


def decodificar(valor):
    tipos = {'datetime': datetime, 'date': date, 'time': time}
    return tipos[valor['tipo']].fromisoformat(valor['valor'])


class HojaBD:
    def __init__(self, titulo, filas):
        self.title, self.filas = titulo, filas

    def iter_rows(self, values_only=True):
        return iter(self.filas)


class FuenteBD:
    def __init__(self, nombre, epoch, hojas):
        self.name, self.epoch, self.hojas = nombre, epoch, hojas
        self.sheetnames = [h.title for h in hojas]

    def __iter__(self):
        return iter(self.hojas)

    def close(self):
        pass


def actualizar_base_datos(excel, maestro, destino):
    """Publica una carga completa; un error conserva intacta la BD anterior."""
    with ACTUALIZACION:
        destino = Path(destino).resolve()
        firmas = {Path(ruta).resolve(): (Path(ruta).stat().st_size, Path(ruta).stat().st_mtime_ns)
                  for ruta in (excel, maestro)}
        destino.parent.mkdir(parents=True, exist_ok=True)
        descriptor, nombre = tempfile.mkstemp(prefix='mantenimiento-', suffix='.sqlite3', dir=destino.parent)
        os.close(descriptor)
        temporal = Path(nombre)
        try:
            with closing(sqlite3.connect(temporal)) as conexion, conexion:
                conexion.executescript('''
                    CREATE TABLE metadatos (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
                    CREATE TABLE fuentes (rol TEXT PRIMARY KEY, nombre TEXT NOT NULL, ruta TEXT NOT NULL, epoch TEXT NOT NULL);
                    CREATE TABLE hojas (rol TEXT NOT NULL, nombre TEXT NOT NULL, PRIMARY KEY (rol, nombre));
                    CREATE TABLE filas (rol TEXT NOT NULL, hoja TEXT NOT NULL, numero INTEGER NOT NULL, datos TEXT NOT NULL,
                                        PRIMARY KEY (rol, hoja, numero));
                ''')
                for rol, ruta, titulos in [('excel', Path(excel), ['Sheet1', 'Seguimiento KM-HR', 'PROGRAMA']),
                                           ('maestro', Path(maestro), ['BD ACTIVOS MOVILES'])]:
                    firma = ruta.stat()
                    libro = load_workbook(ruta, read_only=True, data_only=True)
                    try:
                        conexion.execute('INSERT INTO fuentes VALUES (?, ?, ?, ?)',
                                         (rol, ruta.name, str(ruta.resolve()), libro.epoch.isoformat()))
                        for titulo in titulos:
                            hoja = next((h for h in libro if normalizar(h.title) == normalizar(titulo)), None)
                            if hoja is None:
                                raise ValueError(f'{ruta.name}: falta la hoja {titulo}.')
                            conexion.execute('INSERT INTO hojas VALUES (?, ?)', (rol, hoja.title))
                            valida = False
                            limite = 20 if titulo == 'Seguimiento KM-HR' else 1
                            for numero, fila in enumerate(hoja.iter_rows(values_only=True), 1):
                                if numero <= limite and all(normalizar(c) in {normalizar(v) for v in fila}
                                                           for c in REQUERIDAS[titulo]):
                                    valida = True
                                if numero == limite and not valida:
                                    raise ValueError(f'{ruta.name}: faltan columnas requeridas en {titulo}.')
                                conexion.execute('INSERT INTO filas VALUES (?, ?, ?, ?)',
                                                 (rol, hoja.title, numero, json.dumps(fila, ensure_ascii=False,
                                                                                     default=codificar, allow_nan=False)))
                            if not valida:
                                raise ValueError(f'{ruta.name}: no hay cabecera válida en {titulo}.')
                    finally:
                        libro.close()
                    nueva_firma = ruta.stat()
                    if (firma.st_size, firma.st_mtime_ns) != (nueva_firma.st_size, nueva_firma.st_mtime_ns):
                        raise ValueError(f'{ruta.name} cambió durante la carga. Guarda y vuelve a actualizar.')
                conexion.executemany('INSERT INTO metadatos VALUES (?, ?)',
                                     [('version', VERSION), ('actualizado', datetime.now().astimezone().isoformat(timespec='seconds'))])
                for ruta, firma in firmas.items():
                    estado = ruta.stat()
                    if (estado.st_size, estado.st_mtime_ns) != firma:
                        raise ValueError(f'{ruta.name} cambió durante la carga. Guarda y vuelve a actualizar.')
            os.replace(temporal, destino)
        finally:
            temporal.unlink(missing_ok=True)
        return estado_base_datos(destino)


def conectar(ruta):
    ruta = Path(ruta).resolve()
    if not ruta.is_file():
        raise ValueError('No existe la BD. Pulsa Actualizar BD o ejecuta Actualizar_BD.bat.')
    return sqlite3.connect(ruta.as_uri() + '?mode=ro', uri=True)


def estado_base_datos(ruta):
    with closing(conectar(ruta)) as conexion:
        return _estado(conexion)


def _estado(conexion):
    meta = dict(conexion.execute('SELECT clave, valor FROM metadatos'))
    if meta.get('version') != VERSION:
        raise ValueError('BD incompatible. Ejecuta Actualizar_BD.bat.')
    return dict(actualizado=meta['actualizado'],
                hojas=[dict(fuente=rol, hoja=hoja, filas=max(0, cantidad - 1))
                       for rol, hoja, cantidad in conexion.execute(
                           'SELECT rol, hoja, COUNT(*) FROM filas GROUP BY rol, hoja')])


def leer_fuentes(ruta):
    """Una sola conexión obtiene la misma versión para Excel y maestro."""
    with closing(conectar(ruta)) as conexion, conexion:
        estado = _estado(conexion)
        fuentes = {}
        for rol, nombre, epoch in conexion.execute('SELECT rol, nombre, epoch FROM fuentes'):
            hojas = []
            for (titulo,) in conexion.execute('SELECT nombre FROM hojas WHERE rol=?', (rol,)):
                filas = [tuple(json.loads(datos, object_hook=decodificar)) for (datos,) in conexion.execute(
                    'SELECT datos FROM filas WHERE rol=? AND hoja=? ORDER BY numero', (rol, titulo))]
                hojas.append(HojaBD(titulo, filas))
            fuentes[rol] = FuenteBD(nombre, datetime.fromisoformat(epoch), hojas)
        return fuentes['excel'], fuentes['maestro'], estado
