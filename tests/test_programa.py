"""Cumplimiento del programa con regularizadas y exclusión de N/A."""
from pathlib import Path
import tempfile
import unittest

from openpyxl import Workbook
from app.programa import crear_programa, resumir


class ProgramaTest(unittest.TestCase):
    def test_regularizadas_y_estados_sin_clasificar(self):
        estados = ['realizadas', 'regularizadas', 'no_realizadas', 'na', 'sin_clasificar']
        resultado = resumir([{'estado': estado} for estado in estados])
        self.assertEqual(resultado['porcentaje'], 50)
        self.assertIsNone(resumir([])['porcentaje'])
        self.assertIsNone(resumir([{'estado': 'na'}])['porcentaje'])
        self.assertEqual(resumir([{'estado': 'regularizadas'}])['porcentaje'], 100)

    def test_formula_en_total_region_ceco_e_historial(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as carpeta:
            ruta = Path(carpeta) / 'programa.xlsx'
            libro = Workbook()
            hoja = libro.active
            hoja.title = 'PROGRAMA'
            hoja.append(['REGION ACTUAL', 'NOMBRE CeCo ACTUAL', 'PATENTE',
                         'FECHA PROYECTADA', 'ESTADO'])
            for mes in ['09', '10']:
                for patente, estado in [('ABCD12', 'REALIZADA'), ('EFGH34', 'REGULARIZADA'),
                                         ('IJKL56', 'NO REALIZADA'), ('MNOP78', 'N/A')]:
                    hoja.append(['Norte', 'CECO 1', patente, f'2026-{mes}-05', estado])
            libro.save(ruta)
            libro.close()
            datos = crear_programa(ruta, '2026-10')
        for resumen in [datos, datos['regiones'][0], datos['regiones'][0]['cecos'][0],
                        *datos['historico'], datos['historico'][0]['regiones'][0],
                        datos['historico'][0]['regiones'][0]['cecos'][0]]:
            self.assertAlmostEqual(resumen['porcentaje'], 200 / 3)


if __name__ == '__main__':
    unittest.main()
