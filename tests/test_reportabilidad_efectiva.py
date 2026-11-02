"""Reglas de efectividad, orden temporal y conteo semanal independiente."""
import unittest
from datetime import date, datetime
from openpyxl.utils.datetime import CALENDAR_WINDOWS_1900, to_excel
from app.base_datos import FuenteBD, HojaBD
from app.excel import TIPO_ADC, TIPO_MANTENCION
from app.reportes import crear_reporte
from app.reportabilidad_efectiva import evaluar_criterios, filas_efectivas
from app.zonas import enriquecer_zonas


COLUMNAS = ['Hora de finalización', 'CeCo (Centro de costo)', 'REGION', 'PATENTE',
            'Reportabilidad a realizar', 'Unidad de Control del equipo',
            'Kilometraje actual (km)', 'Horómetro actual (hrs)']


def fila(fecha, patente='ABCD12', control='Por kilometraje', km=None, hr=None, ceco='U1', tipo=TIPO_ADC):
    return [fecha, ceco, 'REGION PRUEBA', patente, tipo, control, km, hr]


def fuentes(filas):
    excel = FuenteBD('prueba.xlsx', CALENDAR_WINDOWS_1900, [HojaBD('Sheet1', [COLUMNAS, *filas])])
    maestro = FuenteBD('maestro.xlsx', CALENDAR_WINDOWS_1900, [HojaBD('BD ACTIVOS MOVILES', [
        ['NOMBRE CeCo ACTUAL', 'REGION ACTUAL', 'PATENTE'],
        ['U1', 'REGION PRUEBA', 'ABCD12'], ['U1', 'REGION PRUEBA', 'EFGH34']]),
        HojaBD('VIGENCIA', [['PATENTE','INICIO VIGENCIA','FIN VIGENCIA','NOMBRE CeCo ACTUAL','REGION ACTUAL','ZONA ACTUAL','CeCo ACTUAL','LN','Nombre LN'],
            ['ABCD12','2026-08-04',None,'U1','REGION PRUEBA','ZONA 3',1001,1,'RESIDUOS'],
            ['EFGH34','2026-08-04',None,'U1','REGION PRUEBA','ZONA 3',1001,1,'RESIDUOS']])])
    maestro.catalogo_zonas = {'unidades': [{'unidad': 'U1', 'ceco': '1001', 'zona': 'ZONA 3',
                                          'lineas': [{'codigo': '1', 'nombre': 'RESIDUOS'}]}]}
    return excel, maestro


class ReportabilidadEfectivaTest(unittest.TestCase):
    def reporte(self, filas, efectiva=True, fecha=date(2026, 8, 11)):
        return crear_reporte(*fuentes(filas), fecha, efectiva=efectiva)

    def test_criterios_independientes_y_ninguno(self):
        casos = [(100, 150, 7), (100, 100, 7), (100, 250, 3), (100, 0, 4),
                 (None, 50, 1), (0, 1, 3), (-100, -50, 2), (100, None, 0), (0, 0, 6)]
        filas, actuales = [], {}
        for n, (anterior, actual, mascara) in enumerate(casos):
            patente = f'CASO{n}'
            filas.extend([fila('2026-08-04', patente=patente, km=anterior),
                          fila('2026-08-11', patente=patente, km=actual)])
            actuales[len(filas)-1] = mascara
        filas.extend([fila('2026-08-04', patente='HORAS1', control='Por horómetro', hr=10),
                      fila('2026-08-11', patente='HORAS1', control='Por horómetro', hr=20),
                      fila('2026-08-11', patente='SINCTRL', control='', km=150)])
        actuales[len(filas)-2], actuales[len(filas)-1] = 7, 0
        excel, maestro = fuentes(filas)
        r = crear_reporte(excel, maestro, date(2026, 8, 11), efectiva=True)
        evaluadas = evaluar_criterios(filas, excel.epoch, r['semanas_completas'])
        self.assertEqual({i: evaluadas[i] for i in actuales}, actuales)
        for seleccion in range(8):
            with self.subTest(criterios=seleccion):
                esperado = {i for i, cumplidos in actuales.items() if cumplidos & seleccion == seleccion}
                resultado = filas_efectivas(filas, excel.epoch, r['semanas_completas'], seleccion)
                self.assertEqual(resultado & actuales.keys(), esperado)
        for invalido in (-1, 8, True, '7'):
            with self.assertRaises(ValueError):
                filas_efectivas(filas, excel.epoch, r['semanas_completas'], invalido)

    def test_variantes_conservan_total_status_historial_y_zonas(self):
        filas = [fila('2026-08-04', km=100), fila('2026-08-11', km=150),
                 fila('2026-08-04', patente='EFGH34', km=100),
                 fila('2026-08-11', patente='EFGH34', km=100),
                 fila('2026-08-11', patente='FUERA1', control='', km=None)]
        excel, maestro = fuentes(filas)
        r = crear_reporte(excel, maestro, date(2026, 8, 11), efectiva=True)
        enriquecer_zonas(r, excel, maestro)
        self.assertEqual(r['version_criterios_efectiva'], 1)
        for regiones in (r['regiones'], r['detalle_zona']):
            for c in (c for region in regiones for c in region['cecos']):
                for mascara in range(8):
                    v = c['por_criterios'][str(mascara)]
                    self.assertEqual(v['reportadas'], sum(s['reportadas'] for s in v['por_status']))
                    self.assertEqual(v['historico_completo'][-1], v['reportadas'])
                    self.assertLessEqual(v['reportadas'], c['reportadas_totales'])
                    self.assertGreaterEqual(v['reportadas'], c['reportadas'])
                for campo in ['reportadas', 'fuera_maestro', 'historico', 'historico_completo']:
                    self.assertEqual(c['por_criterios']['7'][campo], c[campo])
                self.assertEqual(c['por_criterios']['0']['reportadas'], c['reportadas_totales'])
                self.assertEqual(c['por_criterios']['0']['historico_completo'], c['historico_completo_reportadas'])
        c = r['regiones'][0]['cecos'][0]
        self.assertEqual(c['por_criterios']['5']['reportadas'], 2)
        self.assertEqual(c['por_criterios']['7']['reportadas'], 2)
        self.assertEqual(c['por_criterios']['0']['reportadas'], 2)

    def test_limites_en_ambos_medidores(self):
        for control, campo in [('Por kilometraje', 'km'), ('Por horómetro', 'hr')]:
            for actual, esperado in [(0, 0), (-1, 0), (99, 0), (100, 1), (101, 1),
                                     (200, 1), (200.01, 0), (None, 0), ('error', 0),
                                     (True, 0), ('nan', 0), ('inf', 0), ('150,5', 1)]:
                with self.subTest(control=control, actual=actual):
                    filas = [fila('2026-08-04', control=control, **{campo: 100}),
                             fila('2026-08-11', control=control, **{campo: actual})]
                    reporte = self.reporte(filas)
                    self.assertEqual(reporte['reportadas'], esperado)
                    self.assertEqual(reporte['total'], 2)
                    self.assertEqual(reporte['regiones'][0]['cecos'][0]['historico_completo'], [0, esperado])

    def test_sin_antecedente_positivo_o_control(self):
        for anterior in (None, 0, 'error'):
            with self.subTest(anterior=anterior):
                self.assertEqual(self.reporte([fila('2026-08-04', km=anterior),
                                              fila('2026-08-11', km=150)])['reportadas'], 0)
        self.assertEqual(self.reporte([fila('2026-08-04', km=100),
                                      fila('2026-08-11', control='', km=150, hr=150)])['reportadas'], 0)
        self.assertEqual(self.reporte([fila('2026-08-03', km=100), fila('2026-08-04', km=-1),
                                      fila('2026-08-11', km=150)])['reportadas'], 0)

    def test_solo_medidor_declarado_y_sin_mezclar_km_hr(self):
        filas = [fila('2026-08-04', km=100, hr=10),
                 fila('2026-08-11', control='Por horómetro', km=150, hr=15)]
        self.assertEqual(self.reporte(filas)['reportadas'], 0)
        filas.insert(0, fila('2026-07-28', control='Por horómetro', km=900, hr=10))
        self.assertEqual(self.reporte(filas)['reportadas'], 1)
        filas[-1][-1] = 0  # El km correcto no rescata un horómetro inválido.
        self.assertEqual(self.reporte(filas)['reportadas'], 0)

    def test_ultimo_envio_prevalece_y_no_usa_ultimo_efectivo(self):
        filas = [fila('2026-08-04', km=100), fila('2026-08-10', km=150), fila('2026-08-11', km=0)]
        self.assertEqual(self.reporte(filas)['reportadas'], 0)
        self.assertEqual(self.reporte(filas, efectiva=False)['reportadas'], 1)
        filas.append(fila('2026-08-12', km=160))
        self.assertEqual(self.reporte(filas)['reportadas'], 0)  # El antecedente es cero.
        filas[-2][-2] = None
        self.assertEqual(self.reporte(filas)['reportadas'], 1)  # Vacío no es una lectura.
        filas[-2][-2] = 400
        filas[-1][-2] = 500
        self.assertEqual(self.reporte(filas)['reportadas'], 1)  # Se compara con 400, aunque no fue efectivo.

    def test_ordena_horas_nativas_texto_y_series_excel(self):
        for temprano, tarde in [(datetime(2026,8,11,8), datetime(2026,8,11,17)),
                                ('11/08/2026 08:00', '11/08/2026 17:00'),
                                ('11-08-2026 08:00:00', '11-08-2026 17:00:00'),
                                (to_excel(datetime(2026,8,11,8)), to_excel(datetime(2026,8,11,17)))]:
            with self.subTest(temprano=temprano):
                # El archivo está desordenado; el envío de las 17:00 es el último.
                filas = [fila(tarde, km=160), fila('2026-08-04', km=100), fila(temprano, km=150)]
                self.assertEqual(self.reporte(filas)['reportadas'], 1)
                filas[0][-2] = 140
                self.assertEqual(self.reporte(filas)['reportadas'], 0)

    def test_antecedente_fuera_de_ventana_cambio_unidad_y_saltos(self):
        filas = [fila('2026-07-20', ceco='ANTIGUA', km=100), fila('2026-08-04', km=150)]
        self.assertEqual(self.reporte(filas, fecha=date(2026,8,4))['reportadas'], 1)
        filas.append(fila('2026-08-18', km=200))
        r = self.reporte(filas, fecha=date(2026,8,18))
        self.assertEqual(r['regiones'][0]['cecos'][0]['historico_completo'], [1, 0, 1])

    def test_adc_patentes_normalizadas_fuera_de_maestro_y_zonas(self):
        filas = [fila('2026-08-04', km=100), fila('2026-08-11', patente='ab-cd.12', km=150),
                 fila('2026-08-12', km=999, tipo=TIPO_MANTENCION),
                 fila('2026-08-04', patente='FUERA1', control='Por horómetro', hr=10),
                 fila('2026-08-11', patente='FUERA1', control='Por horómetro', hr=20),
                 fila('2026-08-11', patente='REVISAR', km=50)]
        excel, maestro = fuentes(filas)
        r = crear_reporte(excel, maestro, date(2026,8,11), efectiva=True)
        enriquecer_zonas(r, excel, maestro)
        self.assertTrue(r['reportabilidad_efectiva'])
        self.assertEqual((r['reportadas'], r['total'], r['fuera_maestro']), (1, 2, 0))
        self.assertEqual(r['incidencias_vigencia'][0]['patente'], 'FUERA1')
        self.assertEqual(sum(c['reportadas'] for z in r['detalle_zona'] for c in z['cecos']), 1)
        self.assertEqual(sum(c['total'] for z in r['detalle_zona'] for c in z['cecos']), 2)
        self.assertEqual(r['detalle_zona'][0]['cecos'][0]['historico_completo'], [0, 1])

    def test_comparacion_incluye_reportadas_no_efectivas_y_grupos_sin_base(self):
        filas = [fila('2026-08-04', km=100), fila('2026-08-11', km=150),
                 fila('2026-08-04', patente='EFGH34', control='Por horómetro', hr=10),
                 fila('2026-08-11', patente='EFGH34', control='Por horómetro', hr=10),
                 fila('2026-08-11', patente='EFGH34', control='Por horómetro', hr=0),
                 fila('2026-08-11', patente='FUERA1', ceco='OTRA', km=500)]
        excel, maestro = fuentes(filas)
        normal = crear_reporte(excel, maestro, date(2026,8,11))
        efectivo = crear_reporte(excel, maestro, date(2026,8,11), efectiva=True)
        self.assertEqual(efectivo['reportadas_totales'], normal['reportadas'])
        self.assertEqual((efectivo['reportadas'], efectivo['reportadas_totales']), (1, 2))
        normales = {c['ceco']: c for r in normal['regiones'] for c in r['cecos']}
        for r in efectivo['regiones']:
            for c in r['cecos']:
                self.assertEqual(c['historico_completo_reportadas'], normales[c['ceco']]['historico_completo'])
                self.assertTrue(all(e<=t for e,t in zip(c['historico_completo'],c['historico_completo_reportadas'])))
        enriquecer_zonas(efectivo, excel, maestro)
        self.assertEqual(sum(c['reportadas_totales'] for r in efectivo['detalle_zona'] for c in r['cecos']), 2)
        self.assertEqual(sum(c['reportadas'] for r in efectivo['detalle_zona'] for c in r['cecos']), 1)


if __name__ == '__main__':
    unittest.main()
