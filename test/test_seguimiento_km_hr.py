import unittest
from datetime import date, datetime
from pathlib import Path
from unittest.mock import patch
from openpyxl.utils.datetime import CALENDAR_WINDOWS_1900
from app.seguimiento import crear_seguimiento, calcular_equipo, estado_mantencion
from app.excel import TIPO_ADC, TIPO_MANTENCION


def lectura(semana, valor, fecha, unidad='KM'):
    return {'semana': semana, 'valor': valor, 'fecha_lectura': fecha, 'unidad': unidad}


def equipo(lecturas):
    return {'unidad': 'KM', 'unidad_intervalo': 'KM', 'ultima_mantencion': 1000,
            'intervalo': 500, 'fecha_mantencion': '2026-08-01', 'conflicto_maestro': False,
            'lecturas': lecturas}


class SeguimientoTest(unittest.TestCase):
    def reporte(self, filas, maestro=None):
        if maestro is None:
            maestro = [('ABCD12', 'A', 'REGION BHP', 1000, 'Kms', '01-08-2026', 500, 'Kms'),
                       ('EFGH34', 'B', 'REGION BHP', 100, 'Hrs', '01-08-2026', 250, 'Hrs')]
        filas = [(*f, TIPO_ADC, None, None, None, None, None, None, None) if len(f) == 6 else f for f in filas]
        with patch('app.seguimiento.leer_tabla', side_effect=[
            (maestro, CALENDAR_WINDOWS_1900, 'Maestro'),
            (filas, CALENDAR_WINDOWS_1900, 'Form')]):
            return crear_seguimiento(Path('form.xlsx'), Path('maestro.xlsx'), date(2026, 9, 22))

    def test_ventanas_y_ultimo_envio_incluyen_dia_posterior(self):
        filas = [(datetime(2026, 8, 28, 23, 59), 'ABCD12', 'Por kilometraje', '2026-08-28', 1, 0),
                 (datetime(2026, 8, 29), 'ABCD12', 'Por kilometraje', '2026-08-29', 1100, 0),
                 (datetime(2026, 9, 2, 23, 59), 'ABCD12', 'Por kilometraje', '2026-09-02', 1200, 0),
                 (datetime(2026, 9, 3), 'ABCD12', 'Por kilometraje', '2026-09-03', 9999, 0),
                 (datetime(2026, 9, 8), 'ABCD12', 'Por kilometraje', '2026-09-08', 1300, 0),
                 (datetime(2026, 9, 23), 'ABCD12', 'Por kilometraje', '2026-09-23', 1400, 0),
                 (datetime(2026, 9, 24), 'ABCD12', 'Por kilometraje', '2026-09-24', 9999, 0),
                 (datetime(2026, 9, 22), 'FUERA1', 'Por kilometraje', '2026-09-22', 1, 0)]
        r = self.reporte(filas)
        self.assertEqual([s['fecha'] for s in r['semanas']], ['2026-09-01','2026-09-08','2026-09-15','2026-09-22'])
        self.assertEqual(len(r['equipos']), 2)
        self.assertEqual([l['valor'] if l else None for l in r['equipos'][0]['lecturas']], [1200,1300,None,1400])
        self.assertEqual(r['equipos'][1]['calculo']['estado'], 'REVISAR')

    def test_formula_limites_exactos(self):
        for saldo, esperado in [(51,'verde'), (50,'verde'), (49.99,'amarillo'), (0,'amarillo'),
                                (-50,'amarillo'), (-50.01,'rojo'), (None,'neutro')]:
            with self.subTest(saldo=saldo):
                self.assertEqual(estado_mantencion(saldo, 500)[1], esperado)

    def test_proyeccion_y_objetivo_alcanzado(self):
        e = equipo([lectura(1,1100,'2026-09-01'), lectura(2,1240,'2026-09-08')])
        c = calcular_equipo(e)
        self.assertEqual((c['proxima'], c['saldo'], c['ritmo_diario']), (1500,260,20))
        self.assertEqual(c['fecha_proyectada'], '2026-09-21')
        e['lecturas'].append(lectura(3,1520,'2026-09-22'))
        c = calcular_equipo(e)
        self.assertEqual(c['fecha_proyectada'], '2026-09-21')
        self.assertEqual(c['estado'], 'Próxima a vencer')

    def test_sin_proyeccion_cero_consumo_o_una_lectura(self):
        for lecturas in [[lectura(1,1100,'2026-09-01')],
                         [lectura(1,1100,'2026-09-01'), lectura(2,1100,'2026-09-08')]]:
            self.assertIsNone(calcular_equipo(equipo(lecturas))['fecha_proyectada'])

    def test_inconsistencias_no_generan_estado_ni_proyeccion(self):
        base = [lectura(1,1200,'2026-09-01'), lectura(2,1100,'2026-09-08')]
        for e in [equipo(base), {**equipo(base[:1]), 'unidad_intervalo':'HR'},
                  {**equipo(base[:1]), 'fecha_mantencion':'2026-10-01'},
                  {**equipo(base[:1]), 'intervalo':None},
                  equipo([lectura(1,1200,'2026-09-01'), lectura(2,1300,'2026-09-01')])]:
            c = calcular_equipo(e)
            self.assertEqual(c['estado'], 'REVISAR')
            self.assertIsNone(c['fecha_proyectada'])

    def test_unidad_del_maestro_y_duplicados_conflictivos(self):
        maestro = [('ABCD12','A','R',1000,'Kms','01-08-2026',500,'Kms'),
                   ('ABCD12','A','R',1500,'Kms','01-08-2026',500,'Kms')]
        r = self.reporte([('2026-09-01','ABCD12',None,None,1100,0)], maestro)
        e = r['equipos'][0]
        self.assertTrue(e['conflicto_maestro'])
        self.assertTrue(e['lecturas'][0]['unidad_desde_maestro'])
        self.assertEqual(e['calculo']['estado'], 'REVISAR')

    def test_mantencion_actualiza_sin_contar_como_adc(self):
        adc = ('2026-09-22','ABCD12','Por kilometraje','2026-09-22',1400,0)
        mtto = ('2026-09-23','REVISAR',None,None,9999,9999,TIPO_MANTENCION,'REGION BHP',
                None,None,'ABCD12','2026-09-20',1300,'https://example.test/certificado.pdf')
        e = self.reporte([adc, mtto])['equipos'][0]
        self.assertEqual(e['lecturas'][3]['valor'],1400)
        self.assertEqual(e['ultima_mantencion'],1300)
        self.assertEqual(e['fecha_mantencion'],'2026-09-20')
        self.assertEqual(e['calculo']['proxima'],1800)
        self.assertEqual(e['calculo']['saldo'],400)
        self.assertEqual(e['certificado_mantencion'],'https://example.test/certificado.pdf')
        self.assertEqual(e['origen_mantencion'],'PruebaForm · Jefe de Mantenimiento')

    def test_historial_mtto_fuera_de_ventanas_y_correccion_mismo_dia(self):
        filas = [('2026-09-22','ABCD12','Por kilometraje','2026-09-22',1400,0)]
        def mtto(envio, fecha, valor, candidata='ABCD12',extra=None):
            return (envio,'REVISAR',None,None,None,None,TIPO_MANTENCION,'REGION BHP',
                    extra,None,candidata,fecha,valor,'certificado')
        filas += [mtto('2026-09-18','2026-09-10',1100), # El envío del 18 está entre ventanas ADC.
                  mtto('2026-09-20','2026-09-10',1150), # Corrige el mismo evento.
                  mtto('2026-09-22','2026-08-01',1000), # Envío tardío de evento más antiguo.
                  mtto('2026-09-24','2026-09-22',1300), # Posterior al límite de consulta.
                  mtto('2026-09-22','2026-09-21',1200,extra='OTRA12')] # Ambiguo.
        r=self.reporte(filas)
        e=r['equipos'][0]
        self.assertEqual(e['ultima_mantencion'],1150)
        self.assertEqual(e['fecha_mantencion'],'2026-09-10')
        self.assertTrue(any('omitidas' in a for a in r['advertencias']))

    def test_mtto_antigua_no_reemplaza_maestro_y_sin_certificado_avisa(self):
        def mtto(fecha,certificado):
            return ('2026-09-22','REVISAR',None,None,None,None,TIPO_MANTENCION,'REGION BHP',
                    None,None,'ABCD12',fecha,1200,certificado)
        e=self.reporte([mtto('2026-07-01','certificado')])['equipos'][0]
        self.assertEqual(e['ultima_mantencion'],1000)
        r=self.reporte([mtto('2026-09-20',None)])
        self.assertEqual(r['equipos'][0]['ultima_mantencion'],1200)
        self.assertTrue(any('no incluyen certificado' in a for a in r['advertencias']))
        self.assertEqual(r['equipos'][0]['calculo']['estado'],'REVISAR') # No existe una lectura ADC.


if __name__ == '__main__':
    unittest.main()
