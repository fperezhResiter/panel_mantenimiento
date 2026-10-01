"""Lectura de la fecha explícita sin alterar la proyección de uso."""
from datetime import date, datetime
from pathlib import Path
import tempfile
import unittest

from openpyxl import Workbook
from openpyxl.utils.datetime import to_excel
from app.seguimiento_hoja import crear_seguimiento


class FechaCalendarioTest(unittest.TestCase):
    def consultar(self, valor=None, columna=True, sin_lecturas=False):
        with tempfile.TemporaryDirectory() as carpeta:
            ruta = Path(carpeta) / 'control.xlsx'
            libro = Workbook()
            maestro = libro.active
            maestro.title = 'BD ACTIVOS MOVILES'
            maestro.append(['PATENTE', 'NOMBRE CeCo ACTUAL', 'REGION ACTUAL'])
            maestro.append(['ABCD12', 'CECO A', 'REGION BHP'])
            hoja = libro.create_sheet('Seguimiento KM-HR')
            cabecera = ['PATENTE', 'REGION ACTUAL', 'KM U HR UM', 'UN UM', 'FECHA UM',
                        'INTERVALO', 'UN IN', 'STATUS EQUIPO', '01-09-2026', '08-09-2026']
            fila = ['ABCD12', 'REGION BHP', 1000, 'KM', '01-08-2026', 500, 'KM',
                    'Operativo', None if sin_lecturas else 1100, None if sin_lecturas else 1200]
            if columna:
                cabecera.append('FECHA PROYECTADA REAL')
                fila.append(valor)
            hoja.append(cabecera)
            hoja.append(fila)
            libro.save(ruta)
            libro.close()
            return crear_seguimiento(ruta, ruta, date(2026, 9, 8), date(2026, 9, 1))['equipos'][0]

    def test_fecha_nativa_texto_y_serial(self):
        for valor in [datetime(2026, 10, 5), '05/10/2026', '2026-10-05', to_excel(datetime(2026, 10, 5))]:
            with self.subTest(valor=valor):
                equipo = self.consultar(valor)
                self.assertEqual(equipo['fecha_proyectada_real'], '2026-10-05')
                self.assertEqual(equipo['calculo']['fecha_proyectada'], '2026-09-29')

    def test_columna_opcional_vacia_o_invalida(self):
        for columna, valor in [(False, None), (True, None), (True, 'pendiente'), (True, '31/02/2026')]:
            with self.subTest(columna=columna, valor=valor):
                equipo = self.consultar(valor, columna)
                self.assertIsNone(equipo['fecha_proyectada_real'])
                self.assertEqual(equipo['calculo']['fecha_proyectada'], '2026-09-29')

    def test_fecha_real_sin_proyeccion_calculable(self):
        equipo = self.consultar('05/10/2026', sin_lecturas=True)
        self.assertEqual(equipo['fecha_proyectada_real'], '2026-10-05')
        self.assertIsNone(equipo['calculo']['fecha_proyectada'])
