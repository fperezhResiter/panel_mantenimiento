"""El status actual del maestro particiona base, reportes y todos los históricos."""
import unittest
from datetime import date
from openpyxl.utils.datetime import CALENDAR_WINDOWS_1900
from app.base_datos import FuenteBD, HojaBD
from app.excel import TIPO_ADC
from app.reportes import crear_reporte
from app.zonas import enriquecer_zonas


def fuentes():
    columnas = ['Hora de finalización', 'CeCo (Centro de costo)', 'REGION', 'PATENTE',
                'Reportabilidad a realizar', 'Unidad de Control del equipo',
                'Kilometraje actual (km)', 'Horómetro actual (hrs)', 'Status actual del equipo']
    filas = []
    for patente, actual in [('AAAA11', 150), ('BBBB22', 99), ('FUERA1', 150)]:
        for dia, km in [('2026-08-04', 100), ('2026-08-11', actual)]:
            filas.append([dia, 'U1', 'REGION PRUEBA', patente, TIPO_ADC,
                          'Por kilometraje', km, None, 'FUERA DE SERVICIO'])
    excel = FuenteBD('prueba.xlsx', CALENDAR_WINDOWS_1900, [HojaBD('Sheet1', [columnas, *filas]),
        HojaBD('Seguimiento KM-HR', [['PATENTE', 'STATUS EQUIPO'], ['AAAA11', 'EN MANTENCION']])])
    maestro = FuenteBD('maestro.xlsx', CALENDAR_WINDOWS_1900, [HojaBD('BD ACTIVOS MOVILES', [
        ['NOMBRE CeCo ACTUAL', 'REGION ACTUAL', 'PATENTE', 'STATUS DEL EQUIPO'],
        ['U1', 'REGION PRUEBA', 'AAAA11', 'Operativo'],
        ['U1', 'REGION PRUEBA', 'aa-aa.11', 'OPERATIVO'],
        ['U1', 'REGION PRUEBA', 'BBBB22', 'En mantención'],
        ['U2', 'REGION PRUEBA', 'CCCC33', None]]),
        HojaBD('VIGENCIA', [['PATENTE','INICIO VIGENCIA','FIN VIGENCIA','NOMBRE CeCo ACTUAL','REGION ACTUAL','ZONA ACTUAL','CeCo ACTUAL','LN','Nombre LN'],
            *[[p,'2026-08-04',None,u,'REGION PRUEBA','ZONA 3',1,1,'RESIDUOS'] for p,u in [('AAAA11','U1'),('BBBB22','U1'),('CCCC33','U2')]]])])
    maestro.catalogo_zonas = {'unidades': [{'unidad': u, 'ceco': str(i), 'zona': 'ZONA 3',
        'lineas': [{'codigo': '1', 'nombre': 'RESIDUOS'}]} for i, u in enumerate(['U1', 'U2'], 1)]}
    return excel, maestro


class StatusReportabilidadTest(unittest.TestCase):
    def test_origen_maestro_y_desglose_aditivo_en_ambas_vistas(self):
        for efectiva in (False, True):
            with self.subTest(efectiva=efectiva):
                excel, maestro = fuentes()
                reporte = crear_reporte(excel, maestro, date(2026, 8, 11), efectiva=efectiva)
                enriquecer_zonas(reporte, excel, maestro)
                self.assertEqual(reporte['status_equipo_disponibles'], ['EN MANTENCION', 'OPERATIVO', 'SIN STATUS'])
                self.assertEqual((reporte['reportadas'], reporte['total']), (1 if efectiva else 2, 3))
                for regiones in (reporte['regiones'], reporte['detalle_zona']):
                    for c in (c for r in regiones for c in r['cecos']):
                        for campo in ['reportadas', 'total', 'fuera_maestro'] + (['reportadas_totales'] if efectiva else []):
                            self.assertEqual(sum(s[campo] for s in c['por_status']), c[campo])
                        for campo in ['historico', 'historico_completo'] + (['historico_reportadas', 'historico_completo_reportadas'] if efectiva else []):
                            self.assertEqual([sum(s[campo][i] for s in c['por_status']) for i in range(len(c[campo]))], c[campo])
                unidad = next(c for r in reporte['regiones'] for c in r['cecos'] if c['ceco'] == 'U1')
                estados = {s['status']: s for s in unidad['por_status']}
                self.assertEqual((estados['OPERATIVO']['reportadas'], estados['OPERATIVO']['total']), (1, 1))
                self.assertEqual(estados['OPERATIVO']['historico_completo'], [0 if efectiva else 1, 1])
                self.assertEqual((estados['EN MANTENCION']['reportadas'], estados['EN MANTENCION']['total']), (0 if efectiva else 1, 1))
                self.assertNotIn('SIN STATUS', estados)
                self.assertEqual(reporte['incidencias_vigencia'][0]['patente'], 'FUERA1')
                if efectiva:
                    self.assertEqual(estados['EN MANTENCION']['reportadas_totales'], 1)

    def test_status_ausente_o_ambiguo_conserva_patentes(self):
        excel, maestro = fuentes()
        maestro.hojas[0].filas.append(['U1', 'REGION PRUEBA', 'AAAA11', 'FUERA DE SERVICIO'])
        r = crear_reporte(excel, maestro, date(2026, 8, 11))
        self.assertNotIn('OPERATIVO', r['status_equipo_disponibles'])
        self.assertEqual(r['total'], 3)
        self.assertEqual(r['reportadas'], 2)
        maestro.hojas[0].filas = [fila[:3] for fila in maestro.hojas[0].filas]
        r = crear_reporte(excel, maestro, date(2026, 8, 11), efectiva=True)
        self.assertEqual(r['status_equipo_disponibles'], ['SIN STATUS'])
        self.assertEqual((r['reportadas'], r['total']), (1, 3))


if __name__ == '__main__':
    unittest.main()
