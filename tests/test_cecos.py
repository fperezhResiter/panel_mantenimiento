import unittest
from datetime import datetime
from openpyxl.utils.datetime import WINDOWS_EPOCH
from app.base_datos import FuenteBD, HojaBD
from app.cecos import catalogo_cecos


class CatalogoCecosTest(unittest.TestCase):
    def fuente(self, filas):
        return FuenteBD('maestro.xlsx', WINDOWS_EPOCH, [HojaBD('BD ACTIVOS MOVILES', filas)])

    def test_codigos_numericos_texto_ausentes_y_ambiguos(self):
        maestro = self.fuente([
            ('NOMBRE CeCo ACTUAL', 'CeCo ACTUAL'),
            ('Quebrada blanca', 3400.0), ('QUEBRADA BLANCA', '3400'),
            ('Sin código', None), ('Otro', '0032'),
            ('Ambiguo', 123), ('Ambiguo', 456), ('Sin dato', 'N/A'),
        ])
        self.assertEqual(catalogo_cecos(maestro), {'QUEBRADA BLANCA': '3400', 'OTRO': '0032'})

    def test_compatibilidad_maestro_sin_columna_codigo(self):
        self.assertEqual(catalogo_cecos(self.fuente([('NOMBRE CeCo ACTUAL',), ('Unidad',)])), {})
