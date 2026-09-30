"""Casos de conteo mensual y cumplimiento del programa."""
import tempfile
import unittest
from pathlib import Path
from openpyxl import Workbook
from app.programa import crear_programa


class ProgramaTest(unittest.TestCase):
    def reporte(self, filas, mes='2026-09'):
        with tempfile.TemporaryDirectory() as carpeta:
            ruta = Path(carpeta) / 'programa.xlsx'
            libro = Workbook()
            libro.active.title = 'PROGRAMA'
            libro.active.append(['REGION ACTUAL', 'NOMBRE CeCo ACTUAL', 'PATENTE', 'FECHA PROYECTADA', 'ESTADO'])
            for fila in filas:
                libro.active.append(fila)
            libro.save(ruta)
            libro.close()
            return crear_programa(ruta, mes)

    def test_ejemplo_usuario(self):
        datos = self.reporte([['REGION TARAPACA', 'SUCURSAL IQUIQUE', p, '04/09/2026', e]
                             for p, e in [('LBSR70', 'REALIZADA'), ('FLCZ69', 'N/A'),
                                          ('RDCD91', 'NO REALIZADO'), ('KYYB79', 'NO REALIZADO')]])
        self.assertEqual(datos['total'], 4)
        self.assertEqual(datos['realizadas'], 1)
        self.assertEqual(datos['no_realizadas'], 2)
        self.assertEqual(datos['na'], 1)
        self.assertAlmostEqual(datos['porcentaje'], 100 / 3)

    def test_mes_duplicados_y_regularizadas(self):
        datos = self.reporte([
            ['R', 'A', 'AA1234', '01/09/2026', 'REALIZADA'],
            ['R', 'A', 'AA1234', '01/09/2026', 'REALIZADA'],
            ['R', 'A', 'BB1234', '30/09/2026', 'REGULARIZADA'],
            ['R', 'B', 'CC1234', '01/10/2026', 'REALIZADA'],
            ['R', 'B', 'DD1234', '01/09/2025', 'REALIZADA']])
        self.assertEqual(datos['total'], 2)
        self.assertEqual(datos['regularizadas'], 1)
        self.assertEqual(datos['porcentaje'], 50)
        self.assertEqual(len(datos['regiones'][0]['cecos']), 1)
        self.assertEqual([r['mes'] for r in datos['historico']], ['2025-09', '2026-09', '2026-10'])
        septiembre = datos['historico'][1]
        self.assertEqual(septiembre['total'], 2)
        self.assertEqual(septiembre['realizadas'], 1)
        self.assertEqual(septiembre['porcentaje'], 50)
        self.assertEqual(septiembre['regiones'][0]['region'], 'R')
        self.assertEqual(septiembre['regiones'][0]['cecos'][0]['ceco'], 'A')
        self.assertEqual(septiembre['regiones'][0]['cecos'][0]['porcentaje'], 50)

    def test_sin_aplicables_y_mes_vacio(self):
        filas = [['R', 'A', 'AA1234', '01/09/2026', 'N/A']]
        self.assertIsNone(self.reporte(filas)['porcentaje'])
        vacio = self.reporte(filas, '2026-10')
        self.assertEqual(vacio['total'], 0)
        self.assertIsNone(vacio['porcentaje'])

    def test_conflictos_y_estados_desconocidos(self):
        datos = self.reporte([
            ['R', 'A', 'AA1234', '01/09/2026', 'REALIZADA'],
            ['R', 'A', 'AA1234', '01/09/2026', 'NO REALIZADO'],
            ['R', 'B', 'BB1234', '01/09/2026', None],
            ['R', 'B', None, '01/09/2026', 'REALIZADA'],
            ['R', 'B', 'CC1234', 'N/A', 'REALIZADA']])
        self.assertEqual(datos['total'], 2)
        self.assertEqual(datos['sin_clasificar'], 2)
        self.assertEqual(datos['porcentaje'], 0)
        self.assertEqual(sum(r['total'] for r in datos['regiones']), 2)


if __name__ == '__main__':
    unittest.main()
