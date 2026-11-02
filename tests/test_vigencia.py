import unittest
from datetime import date
from openpyxl.utils.datetime import CALENDAR_WINDOWS_1900
from app.base_datos import FuenteBD, HojaBD
from app.excel import TIPO_ADC, TIPO_MANTENCION
from app.reportes import crear_reporte
from app.zonas import enriquecer_zonas

V = ['PATENTE', 'INICIO VIGENCIA', 'FIN VIGENCIA', 'REGION ACTUAL', 'ZONA ACTUAL',
     'NOMBRE CeCo ACTUAL', 'CeCo ACTUAL', 'LN', 'Nombre LN']
F = ['Hora de finalización', 'CeCo (Centro de costo)', 'REGION', 'PATENTE',
     'Reportabilidad a realizar', 'Unidad de Control del equipo', 'Kilometraje actual (km)', 'Horómetro actual (hrs)']


def periodo(p, inicio='2026-08-04', fin=None, unidad='U1', region='REGION NORTE', zona='ZONA 1'):
    return [p, inicio, fin, region, zona, unidad, '1001', 5, 'ASEO INDUSTRIAL']


def envio(d, p='AA-AA.11', u='DECLARADA', km=100, tipo=TIPO_ADC):
    return [d, u, 'REGION DECLARADA', p, tipo, 'Por kilometraje', km, None]


def fuentes(periodos, envios):
    maestro = FuenteBD('maestro.xlsx', CALENDAR_WINDOWS_1900, [
        HojaBD('VIGENCIA', [V, *periodos]),
        HojaBD('BD ACTIVOS MOVILES', [['PATENTE', 'NOMBRE CeCo ACTUAL', 'REGION ACTUAL', 'STATUS DEL EQUIPO'],
            ['AAAA11', 'U2', 'REGION SUR', 'OPERATIVO'], ['BBBB22', 'U1', 'REGION NORTE', 'EN MANTENCION']])])
    excel = FuenteBD('envios.xlsx', CALENDAR_WINDOWS_1900, [HojaBD('Sheet1', [F, *envios])])
    return excel, maestro


class VigenciaTest(unittest.TestCase):
    def reporte(self, periodos, envios, fecha=date(2026, 8, 11), efectiva=False):
        return crear_reporte(*fuentes(periodos, envios), fecha, efectiva=efectiva)

    def test_traslado_por_martes_y_bases_historicas(self):
        ps = [periodo('AAAA11', fin='2026-08-10'), periodo('AAAA11', inicio='2026-08-11', unidad='U2', region='REGION SUR', zona='ZONA 8')]
        r = self.reporte(ps, [envio('2026-08-04'), envio('2026-08-11'), envio('2026-08-12', u='OTRA')])
        self.assertEqual((r['reportadas'], r['total']), (1, 1))
        us = {c['ceco']: c for z in r['regiones'] for c in z['cecos']}
        self.assertEqual(us['U1']['historico_completo_base'], [1, 0])
        self.assertEqual(us['U1']['historico_completo'], [1, 0])
        self.assertEqual(us['U2']['historico_completo_base'], [0, 1])
        self.assertEqual(us['U2']['historico_completo'], [0, 1])
        self.assertEqual(r['detalle_zona'][-1]['cecos'][0]['linea'], 'ASEO INDUSTRIAL')
        self.assertEqual(r['reasignaciones'][0]['unidad_vigente'], 'U2')

    def test_limites_inclusivos_y_ventana_adc(self):
        ps = [periodo('AAAA11', inicio='2026-08-11', fin='2026-08-11')]
        for dia, esperado in [('2026-08-10', 1), ('2026-08-14', 1), ('2026-08-15', 0), ('2026-08-09', 0)]:
            with self.subTest(dia=dia):
                r = self.reporte(ps, [envio(dia)])
                self.assertEqual((r['total'], r['reportadas']), (1, esperado))
        self.assertEqual(self.reporte(ps, [envio('2026-08-11', tipo=TIPO_MANTENCION)])['reportadas'], 0)

    def test_sin_periodo_no_infla_el_cumplimiento(self):
        r = self.reporte([periodo('AAAA11')], [envio('2026-08-11'), envio('2026-08-11', p='FUERA1')])
        self.assertEqual((r['reportadas'], r['total'], r['porcentaje']), (1, 1, 100))
        self.assertEqual(r['incidencias_vigencia'][0]['patente'], 'FUERA1')
        self.assertIn('BBBB22', [i['patente'] for i in r['pendientes_vigencia']])

    def test_fecha_invalida_y_superposicion_no_eligen_una_asignacion(self):
        for ps in ([periodo('AAAA11', inicio=None)], [periodo('AAAA11'), periodo('AAAA11', unidad='U2')]):
            r = self.reporte(ps, [envio('2026-08-11')])
            self.assertEqual((r['reportadas'], r['total']), (0, 0))
            self.assertTrue(r['advertencias'])
            self.assertEqual(len(r['incidencias_vigencia']), 1)
            self.assertIn('AAAA11', [i['patente'] for i in r['pendientes_vigencia']])

    def test_baja_y_alta_posterior_no_se_rellena(self):
        r = self.reporte([periodo('AAAA11', fin='2026-08-04'), periodo('AAAA11', inicio='2026-08-18')], [envio('2026-08-11')])
        self.assertEqual(r['historico_completo_base'], [1, 0])
        self.assertEqual(r['total'], 0)
        self.assertEqual(r['incidencias_vigencia'][0]['motivo'], 'Fuera del período de vigencia')

    def test_efectividad_ultimo_envio_tras_reasignar_y_todas_las_variantes(self):
        r = self.reporte([periodo('AAAA11')], [envio('2026-08-04'), envio('2026-08-11T08:00', u='U1', km=150),
            envio('2026-08-11T17:00', u='OTRA', km=0)], efectiva=True)
        self.assertEqual((r['reportadas'], r['reportadas_totales'], r['total']), (0, 1, 1))
        c = r['regiones'][0]['cecos'][0]
        self.assertEqual(c['por_criterios']['0']['reportadas'], 1)
        for variante in c['por_criterios'].values():
            self.assertLessEqual(variante['reportadas'], variante['total'])
            self.assertEqual(variante['historico_completo_base'], [1, 1])

    def test_modos_y_status_conservan_cantidades_y_bases(self):
        e, m = fuentes([periodo('AAAA11'), periodo('BBBB22', inicio='2026-08-11')], [envio('2026-08-11')])
        for efectiva in (False, True):
            r = crear_reporte(e, m, date(2026,8,11), efectiva=efectiva)
            enriquecer_zonas(r, e, m)
            for vista in ['regiones', 'detalle_zona']:
                cs = [c for z in r[vista] for c in z['cecos']]
                self.assertEqual(sum(c['total'] for c in cs), 2)
                self.assertEqual([sum(c['historico_completo_base'][j] for c in cs) for j in range(2)], [1, 2])
                for c in cs:
                    self.assertEqual(sum(s['total'] for s in c['por_status']), c['total'])
                    self.assertEqual([sum(s['historico_completo_base'][j] for s in c['por_status']) for j in range(2)], c['historico_completo_base'])

    def test_falta_hoja_se_informa_sin_usar_maestro_actual(self):
        e,m = fuentes([], [])
        m.hojas = m.hojas[1:]
        with self.assertRaisesRegex(ValueError, 'Falta VIGENCIA'):
            crear_reporte(e,m,date(2026,8,11))


if __name__ == '__main__':
    unittest.main()
