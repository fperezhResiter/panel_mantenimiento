"""Pruebas de límites y clasificación: python -m unittest -v."""
import unittest
from datetime import date, datetime
from pathlib import Path
from unittest.mock import patch
from http.server import BaseHTTPRequestHandler

from openpyxl.utils.datetime import CALENDAR_WINDOWS_1900
from app.reportes import crear_reporte
from app.servidor import ServidorPanel
from app.excel import TIPO_ADC, TIPO_MANTENCION


class ServidorPanelTest(unittest.TestCase):
    def test_rechaza_segunda_instancia_en_mismo_puerto(self):
        with ServidorPanel(('127.0.0.1', 0), BaseHTTPRequestHandler) as primero:
            with self.assertRaises(OSError):
                with ServidorPanel(primero.server_address, BaseHTTPRequestHandler):
                    pass


class ReportabilidadTest(unittest.TestCase):
    def reporte(self, filas, activos=()):
        filas = [(*f, TIPO_ADC) if len(f) == 4 else f for f in filas]
        with patch('app.reportes.leer_tabla', side_effect=[
                (activos, CALENDAR_WINDOWS_1900, 'Maestro'),
                (filas, CALENDAR_WINDOWS_1900, 'Formularios')]):
            return crear_reporte(Path('form.xlsx'), Path('maestro.xlsx'), date(2026, 9, 22))

    def test_limites_inclusivos_y_duplicados(self):
        filas = [(datetime(2026, 9, 20, 23, 59, 59), 'A', 'REGION BHP', 'FUERA1'),
                 (datetime(2026, 9, 21), 'A', 'REGION BHP', 'AB-CD12'),
                 (datetime(2026, 9, 22), 'A', 'REGION BHP', ' abcd12 '),
                 (datetime(2026, 9, 25, 23, 59, 59), 'A', 'REGION BHP', 'EFGH34'),
                 (datetime(2026, 9, 26), 'A', 'REGION BHP', 'FUERA2')]
        r = self.reporte(filas, [('A', 'REGION BHP', 'ABCD12'), ('A', 'REGION BHP', 'EFGH34'),
                                ('A', 'REGION BHP', 'IJKL56'), ('A', 'REGION BHP', 'ABCD12')])
        self.assertEqual(r['total'], 3)
        self.assertEqual(r['reportadas'], 2)
        self.assertAlmostEqual(r['porcentaje'], 200 / 3)
        self.assertNotIn('dias', r)
        self.assertEqual((r['semana'], r['inicio'], r['fin']), (8, '2026-09-21', '2026-09-25'))

    def test_martes_desde_agosto(self):
        for consulta, semana, referencia, inicio, fin in [
                (date(2026, 8, 4), 1, '2026-08-04', '2026-08-03', '2026-08-07'),
                (date(2026, 8, 10), 2, '2026-08-11', '2026-08-10', '2026-08-14'),
                (date(2026, 8, 16), 2, '2026-08-11', '2026-08-10', '2026-08-14'),
                (date(2026, 8, 11), 2, '2026-08-11', '2026-08-10', '2026-08-14')]:
            with self.subTest(consulta=consulta), patch('app.reportes.leer_tabla', return_value=([], CALENDAR_WINDOWS_1900, 'Hoja')):
                r = crear_reporte(Path('form.xlsx'), Path('maestro.xlsx'), consulta)
                self.assertEqual((r['semana'], r['fecha'], r['inicio'], r['fin']), (semana, referencia, inicio, fin))
        with self.assertRaises(ValueError):
            crear_reporte(Path('form.xlsx'), Path('maestro.xlsx'), date(2026, 8, 2))

    def test_historial_tres_semanas_y_actual(self):
        r = self.reporte([
            ('2026-09-07', 'A', None, 'ABCD12'),
            ('2026-09-11 23:59:59', 'A', None, 'ABCD12'),
            ('2026-09-12', 'A', None, 'OTRA12'),
            ('2026-09-18', 'A', None, 'ABCD12'),
            ('2026-09-25', 'A', None, 'EFGH34'),
            ('2026-09-25', 'A', None, 'ABCD12'),
            ('2026-09-01', 'HISTORICO', None, 'SOLO12'),
        ], [('A', 'REGION BHP', 'ABCD12'), ('A', 'REGION BHP', 'EFGH34')])
        self.assertEqual([s['fecha'] for s in r['semanas']], ['2026-09-01','2026-09-08','2026-09-15','2026-09-22'])
        cecos = {c['ceco']: c for region in r['regiones'] for c in region['cecos']}
        self.assertEqual(cecos['A']['historico'], [0, 1, 1, 2])
        self.assertEqual(len(r['semanas_completas']), 8)
        self.assertEqual(r['semanas_completas'][0]['fecha'], '2026-08-04')
        self.assertEqual(cecos['A']['historico_completo'], [0, 0, 0, 0, 0, 1, 1, 2])
        self.assertEqual(cecos['HISTORICO']['historico'], [1, 0, 0, 0])
        self.assertEqual(cecos['HISTORICO']['total'], 0)
        self.assertEqual(r['reportadas'], 2)

    def test_primera_semana_sin_historial_anterior_al_inicio(self):
        with patch('app.reportes.leer_tabla', return_value=([], CALENDAR_WINDOWS_1900, 'Hoja')):
            r = crear_reporte(Path('form.xlsx'), Path('maestro.xlsx'), date(2026, 8, 4))
        self.assertEqual(len(r['semanas']), 1)
        self.assertEqual(r['semanas'][0]['numero'], 1)

    def test_maestro_fallback_vacios_y_ambiguedad(self):
        filas = [('22/09/2026 10:00', ' á ', 'Hrs', 'ABCD12'),
                 ('2026-09-22', None, 'REGION BHP', 'IJKL56'),
                 ('2026-09-22', 'C', 'Kms', 'REVISAR'),
                 ('2026-09-22', 'B', 'REGION BHP', 'EFGH34'),
                 ('no es fecha', 'A', 'REGION BHP', 'OTRA12')]
        r = self.reporte(filas, [('A', 'REGION COPIAPO', 'ABCD12'), ('B', 'REGION BHP', 'EFGH34'), ('B', 'REGION CALAMA', 'EFGH34')])
        self.assertEqual(r['reportadas'], 3)
        self.assertEqual(r['total'], 2)
        self.assertEqual({g['region']: g['reportadas'] for g in r['regiones']},
                         {'REGION COPIAPO': 1, 'SIN REGIÓN': 2})
        self.assertTrue(any('fecha vacía o inválida' in a for a in r['advertencias']))

    def test_periodo_sin_filas(self):
        r = self.reporte([('2026-09-01', 'A', 'REGION BHP', 'ABCD12')], [('A', 'REGION BHP', 'ABCD12')])
        self.assertEqual(r['total'], 1)
        self.assertEqual(r['reportadas'], 0)
        self.assertEqual(r['regiones'][0]['cecos'][0]['porcentaje'], 0)

    def test_sin_base_y_patentes_fuera_del_maestro(self):
        r = self.reporte([('2026-09-22', 'A', None, 'ABCD12'), ('2026-09-22', 'B', None, 'ABCD12')],
                         [('A', 'REGION BHP', '-')])
        self.assertEqual(r['reportadas'], 2)  # Una vez por CeCo, no deduplicación entre CeCo.
        self.assertEqual(r['fuera_maestro'], 2)
        self.assertIsNone(r['porcentaje'])

    def test_solo_adc_cuenta_en_reportabilidad(self):
        r = self.reporte([('2026-09-22','A',None,'ABCD12',TIPO_ADC),
                          ('2026-09-22','A',None,'EFGH34',TIPO_MANTENCION),
                          ('2026-09-22','A',None,'OTRA12','Otro')])
        self.assertEqual(r['reportadas'], 1)


if __name__ == '__main__':
    unittest.main()
