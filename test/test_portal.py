"""Verifica las rutas reales sin dejar un servidor de prueba activo."""
import re
import json
import subprocess
import sys
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen

from app.servidor import BASE, ARCHIVOS_WEB
from urllib.parse import urljoin, urlsplit


class PortalTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.proceso = subprocess.Popen(
            [sys.executable, '-u', str(BASE / 'reportabilidad.py'), '--puerto', '0'],
            cwd=BASE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        cls.addClassCleanup(cls.detener)
        inicio = cls.proceso.stdout.readline()
        encontrado = re.search(r'http://127\.0\.0\.1:\d+', inicio)
        if not encontrado:
            raise RuntimeError(f'No se pudo iniciar el servidor de prueba: {inicio}')
        cls.url = encontrado.group()

    @classmethod
    def detener(cls):
        cls.proceso.terminate()
        try:
            cls.proceso.wait(timeout=5)
        except subprocess.TimeoutExpired:
            cls.proceso.kill()
            cls.proceso.wait(timeout=5)
        cls.proceso.stdout.close()

    def test_paginas_y_recursos_con_tipo_correcto(self):
        for ruta, (archivo, tipo) in ARCHIVOS_WEB.items():
            with self.subTest(ruta=ruta), urlopen(self.url + ruta, timeout=5) as respuesta:
                self.assertEqual(respuesta.status, 200)
                self.assertEqual(respuesta.headers['Content-Type'], tipo)
                self.assertEqual(respuesta.read(), (BASE / archivo).read_bytes())

    def test_no_publica_excel_ni_codigo_python(self):
        for ruta in ['/PruebaForm.xlsx', '/reportabilidad.py', '/../README.md']:
            with self.subTest(ruta=ruta), self.assertRaises(HTTPError) as error:
                urlopen(self.url + ruta, timeout=5)
            self.assertEqual(error.exception.code, 404)

    def test_enlaces_y_separacion(self):
        for nombre in ['Panel.html', 'Panel_Reportabilidad.html', 'Panel_Seguimiento_KM_HR.html', 'Panel_Mantenciones.html', 'Panel_Resumen_Mantencion.html', 'Panel_Calendario_Mantencion.html']:
            html = (BASE / 'web/pages' / nombre).read_text(encoding='utf-8')
            self.assertNotIn('<style>', html)
            self.assertNotIn('<script>', html)
            for enlace in re.findall(r'(?:href|src)="([^"]+)"', html):
                self.assertIn(urlsplit(urljoin('http://localhost/' + nombre, enlace)).path, ARCHIVOS_WEB)

    def test_cuatro_paneles_independientes(self):
        inicio = (BASE / 'web/pages/Panel.html').read_text(encoding='utf-8')
        enlaces = re.findall(r'class="panel-enlace" href="([^"]+)"', inicio)
        self.assertEqual(len(set(enlaces)), 4)
        self.assertTrue(all('#' not in enlace for enlace in enlaces))
        resumen = (BASE / 'web/pages/Panel_Resumen_Mantencion.html').read_text(encoding='utf-8')
        calendario = (BASE / 'web/pages/Panel_Calendario_Mantencion.html').read_text(encoding='utf-8')
        self.assertNotIn('id="mt-calendario"', resumen)
        self.assertNotIn('id="mt-resumen"', calendario)

    def test_api_semanal(self):
        with urlopen(self.url + '/api/seguimiento-km-hr?inicio=2026-09-01&fecha=2026-09-22', timeout=15) as respuesta:
            datos = json.load(respuesta)
        self.assertEqual(datos['version'], 2)
        self.assertEqual(len(datos['semanas']), 4)
        self.assertEqual(datos['semanas'][0]['desde'], '2026-08-29')
        self.assertTrue(datos['equipos'])
        self.assertTrue(all(len(e['lecturas']) == 4 for e in datos['equipos']))

    def test_api_mantenciones(self):
        with urlopen(self.url + '/api/mantenciones?inicio=2026-09-01&fecha=2026-09-22', timeout=15) as respuesta:
            datos = json.load(respuesta)
        self.assertTrue(datos['incluye_estado_equipo'])
        self.assertTrue(all('estado_equipo' in e for e in datos['equipos']))
        self.assertTrue(any(e['estado_equipo'] == 'OPERATIVO' for e in datos['equipos']))


if __name__ == '__main__':
    unittest.main()
