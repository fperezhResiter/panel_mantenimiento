"""Verifica independencia del Excel, equivalencia de cálculos y carga atómica."""
import tempfile
import unittest
from datetime import date, datetime
from pathlib import Path
from openpyxl import Workbook
from unittest.mock import patch
from app.base_datos import actualizar_base_datos, leer_fuentes
from app.excel import TIPO_ADC
from app.reportes import crear_reporte
from app.seguimiento_hoja import crear_seguimiento
from app.programa import crear_programa


class BaseDatosTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.excel = Path(self.temp.name) / 'control.xlsx'
        self.bd = Path(self.temp.name) / 'mantenimiento.sqlite3'
        libro = Workbook()
        libro.active.title = 'Sheet1'
        libro.active.append(['Hora de finalización', 'CeCo (Centro de costo)', 'REGION', 'PATENTE', 'Reportabilidad a realizar'])
        libro.active.append([datetime(2026, 9, 22, 10), 'CECO A', '', 'ABCD12', TIPO_ADC])
        hoja = libro.create_sheet('BD ACTIVOS MOVILES')
        hoja.append(['PATENTE', 'NOMBRE CeCo ACTUAL', 'REGION ACTUAL'])
        hoja.append(['ABCD12', 'CECO A', 'REGION BHP'])
        hoja = libro.create_sheet('Seguimiento KM-HR')
        hoja.append(['Título'])
        hoja.append(['PATENTE', 'REGION ACTUAL', None, 'KM U HR UM', 'UN UM', 'FECHA UM',
                     'INTERVALO', 'UN IN', 'STATUS EQUIPO', date(2026, 9, 1), date(2026, 9, 22)])
        hoja.append(['ABCD12', 'REGION BHP', 'CECO A', 1000, 'Kms', date(2026, 8, 1), 500, 'Kms',
                     'Operativo', 1100, 1400])
        hoja = libro.create_sheet('PROGRAMA')
        hoja.append(['REGION ACTUAL', 'NOMBRE CeCo ACTUAL', 'PATENTE', 'FECHA PROYECTADA', 'ESTADO'])
        hoja.append(['REGION BHP', 'CECO A', 'ABCD12', date(2026, 9, 25), 'REALIZADA'])
        libro.save(self.excel)
        libro.close()

    def test_calculos_identicos_sin_excel(self):
        funciones = [lambda e, m: crear_reporte(e, m, date(2026, 9, 22)),
                     lambda e, m: crear_seguimiento(e, m, date(2026, 9, 22)),
                     lambda e, m: crear_programa(e, '2026-09')]
        esperados = [f(self.excel, self.excel) for f in funciones]
        actualizar_base_datos(self.excel, self.excel, self.bd)
        self.excel.unlink()
        with patch('app.excel.load_workbook', side_effect=AssertionError('No abrir Excel')):
            excel, maestro, estado = leer_fuentes(self.bd)
            self.assertTrue(estado['actualizado'])
            for funcion, esperado in zip(funciones, esperados):
                actual = funcion(excel, maestro)
                actual.pop('actualizado', None)
                esperado.pop('actualizado', None)
                self.assertEqual(actual, esperado)

    def test_carga_fallida_conserva_bd(self):
        actualizar_base_datos(self.excel, self.excel, self.bd)
        anterior = self.bd.read_bytes()
        with self.assertRaises(FileNotFoundError):
            actualizar_base_datos(self.excel, Path(self.temp.name) / 'no-existe.xlsx', self.bd)
        self.assertEqual(anterior, self.bd.read_bytes())
        self.assertEqual(list(self.bd.parent.glob('mantenimiento-*.sqlite3')), [])

    def test_recarga_sustituye_datos(self):
        actualizar_base_datos(self.excel, self.excel, self.bd)
        from openpyxl import load_workbook
        libro = load_workbook(self.excel)
        libro['Sheet1'].delete_rows(2)
        libro.save(self.excel)
        libro.close()
        actualizar_base_datos(self.excel, self.excel, self.bd)
        excel, maestro, _ = leer_fuentes(self.bd)
        self.assertEqual(crear_reporte(excel, maestro, date(2026, 9, 22))['reportadas'], 0)
