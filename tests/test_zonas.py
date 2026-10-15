import json
import unittest
from collections import defaultdict
from app.zonas import ClasificadorZonas, CATALOGO


class ZonasTest(unittest.TestCase):
    def setUp(self):
        self.c = ClasificadorZonas.__new__(ClasificadorZonas)
        self.c.catalogo = json.loads(CATALOGO.read_text(encoding='utf-8'))['unidades']
        self.c.activos = defaultdict(set)
        self.c.codigos_unidades = {}

    def test_patente_historica_usa_ceco_de_su_unidad_reportada(self):
        self.c.codigos_unidades = {'CANDELARIA': '3220'}
        self.c.activos[('OTRA UNIDAD', 'KKZV94')].add(('3788', '5', 'ASEO'))
        resultado = self.c.resolver('CANDELARIA', 'KKZV94')
        self.assertEqual(resultado['zona'], 'ZONA 3')
        self.assertEqual(resultado['linea'], 'SIN LÍNEA')

    def test_nombre_distinto_se_resuelve_con_ceco_unico(self):
        self.c.codigos_unidades = {'CANDELARIA ASEO': '3788', 'CASERONES INTEGRAL': '3470', 'CMP VALLE DEL HUASCO': '3793'}
        for unidad, zona in [('CANDELARIA ASEO', 'ZONA 8B'), ('CASERONES INTEGRAL', 'ZONA 3'), ('CMP VALLE DEL HUASCO', 'ZONA 8B')]:
            with self.subTest(unidad=unidad):
                self.assertEqual(self.c.resolver(unidad, 'ABCD12')['zona'], zona)

    def test_codigo_de_patente_prevalece_sobre_fallback(self):
        self.c.codigos_unidades = {'CANDELARIA': '3220'}
        self.c.activos[('CANDELARIA', 'ABCD12')].add(('3788', '5', 'ASEO'))
        self.assertEqual(self.c.resolver('CANDELARIA', 'ABCD12')['zona'], 'ZONA 8B')

    def test_alias_confirmado_prevalece_sobre_codigo_distinto(self):
        for patente in ['VZZS49', 'WBJL16']:
            self.c.activos[('CMP VALLE COPIAPO ASEO', patente)].add(('3793', '5', 'ASEO INDUSTRIAL'))
            resultado = self.c.resolver('CMP VALLE COPIAPO ASEO', patente)
            self.assertEqual(resultado['zona'], 'ZONA 8B')
            self.assertEqual(resultado['linea'], 'ASEO')
        self.c.activos[('CODELCO EL SALVADOR', 'FYBX32')].add(('3290', '1', 'RESIDUOS'))
        self.assertEqual(self.c.resolver('CODELCO EL SALVADOR', 'FYBX32')['zona'], 'SIN ZONA')

    def test_unidad_en_distintas_zonas_se_resuelve_por_codigo(self):
        self.c.activos[('ANTUCOYA', 'ABCD12')].add(('3170', '1', 'RESIDUOS'))
        self.c.activos[('ANTUCOYA', 'EFGH34')].add(('3771', '5', 'ASEO'))
        self.assertEqual(self.c.resolver('ANTUCOYA', 'ABCD12')['zona'], 'ZONA 6')
        self.assertEqual(self.c.resolver('ANTUCOYA', 'EFGH34')['zona'], 'ZONA 8A')
        self.assertEqual(self.c.resolver('ANTUCOYA')['zona'], 'SIN ZONA')

    def test_linea_no_se_reparte_entre_todas_las_del_contrato(self):
        self.c.activos[('QUEBRADA BLANCA', 'ABCD12')].add(('3400', '3', 'SANITARIOS'))
        self.assertEqual(self.c.resolver('QUEBRADA BLANCA', 'ABCD12')['linea'], 'SANITARIOS')
        self.assertEqual(self.c.resolver('QUEBRADA BLANCA')['linea'], 'SIN LÍNEA')

    def test_nombre_exacto_no_confunde_con_codigo_compartido(self):
        self.c.activos[('ECOMETALES PTAS', 'ABCD12')].add(('3060', '2', 'AGUAS'))
        self.assertEqual(self.c.resolver('ECOMETALES PTAS', 'ABCD12')['linea'], 'AGUAS')
        self.assertEqual(self.c.resolver('NO EXISTE')['zona'], 'SIN ZONA')

    def test_subzonas_y_duplicados_del_excel(self):
        self.assertEqual(self.c.resolver('ESCONDIDA')['zona'], 'ZONA 4A')
        self.assertEqual(self.c.resolver('SPENCE')['zona'], 'ZONA 4B')
        u = next(u for u in self.c.catalogo if u['unidad'] == 'COLLAHUASI')
        self.assertEqual(len([l for l in u['lineas'] if l['codigo']=='3']), 1)


if __name__ == '__main__': unittest.main()
