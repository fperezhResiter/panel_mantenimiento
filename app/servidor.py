"""Servidor HTTP local del portal."""
import argparse
import json
import os
import socket
from datetime import date, datetime
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit
from dotenv import load_dotenv
from .rutas import ARCHIVOS_WEB
from .reportes import crear_reporte
from .api import API_RUTAS
from .cecos import catalogo_cecos
from .zonas import enriquecer_zonas
from .base_datos import actualizar_base_datos, leer_fuentes, estado_base_datos, leer_configuracion, guardar_configuracion

BASE = Path(__file__).resolve().parent.parent
BASE_DOCUMENTOS = Path(__file__).resolve().parents[4]
load_dotenv(BASE / "config" / ".env", encoding="utf-8-sig")
LIBRO_EQUIPOS = Path(
    os.environ.get("LIBRO_EQUIPOS")
    or BASE_DOCUMENTOS
    / "06. Mantenimiento"
    / "Forms"
    / "Control de Equipos Móviles – Minería.xlsx"
)
LIBRO_ZONAS = Path(os.environ.get('LIBRO_ZONAS') or BASE_DOCUMENTOS / '06. Mantenimiento' / 'Datos GDM ADC y CC Minería 230926.xlsx')

class ServidorPanel(ThreadingHTTPServer):
    """Evita que dos instancias atiendan el mismo puerto en Windows."""
    allow_reuse_address = False
    allow_reuse_port = False

    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    
    parser.add_argument('--excel', type=Path, default=LIBRO_EQUIPOS,
                        help='Libro de formularios (hoja Sheet1).')
    parser.add_argument('--maestro', type=Path, default=LIBRO_EQUIPOS,
                        help='Libro de activos (hoja BD ACTIVOS MOVILES).')
    parser.add_argument('--puerto', type=int, default=8765)
    parser.add_argument('--zonas', type=Path, default=LIBRO_ZONAS, help='Catálogo GDM de unidades, zonas y líneas.')
    parser.add_argument('--abrir', action='store_true', help='Abrir el modo interactivo en el navegador.')
    parser.add_argument('--bd', type=Path, default=BASE / 'Datos' / 'mantenimiento.sqlite3',
                        help='Base SQLite que consultan los paneles.')
    args = parser.parse_args()
    # Una BD alternativa mantiene su publicación al lado de esa BD.
    publicacion = (BASE / 'web/datos/publicacion.js' if args.bd.resolve() == (BASE / 'Datos/mantenimiento.sqlite3').resolve()
                   else args.bd.resolve().parent / 'publicacion.js')
    catalogo_destino = (BASE / 'config/unidades_zonas.json' if args.bd.resolve() == (BASE / 'Datos/mantenimiento.sqlite3').resolve()
                        else args.bd.resolve().parent / 'unidades_zonas.json')

    class Handler(BaseHTTPRequestHandler):
        def responder(self, status, contenido, tipo):
            self.send_response(status)
            self.send_header('Content-Type', tipo)
            self.send_header('Content-Length', str(len(contenido)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(contenido)

        def do_GET(self):
            url = urlsplit(self.path)
            if url.path in ARCHIVOS_WEB:
                nombre, tipo = ARCHIVOS_WEB[url.path]
                try:
                    contenido = (BASE / nombre).read_bytes()
                except OSError:
                    self.responder(404, b'Archivo del panel no disponible.', 'text/plain; charset=utf-8')
                    return
                self.responder(200, contenido, tipo)
            elif url.path == '/api/bd':
                try:
                    datos = estado_base_datos(args.bd)
                    self.responder(200, json.dumps(datos, ensure_ascii=False).encode(), 'application/json; charset=utf-8')
                except (ValueError, OSError) as error:
                    self.responder(400, json.dumps({'error': str(error)}).encode(), 'application/json')
                except Exception:
                    self.responder(500, b'{"error":"BD no disponible. Ejecuta Actualizar_BD.bat."}', 'application/json')
            elif url.path == '/api/configuracion':
                try:
                    datos = leer_configuracion(args.bd)
                    self.responder(200, json.dumps(datos, ensure_ascii=False).encode(), 'application/json; charset=utf-8')
                except Exception as error:
                    self.responder(400, json.dumps({'error': str(error)}).encode(), 'application/json')
            elif url.path in API_RUTAS:
                try:
                    excel_bd, maestro_bd, estado = leer_fuentes(args.bd)
                    datos = API_RUTAS[url.path](excel_bd, maestro_bd, parse_qs(url.query))
                    enriquecer_zonas(datos, excel_bd, maestro_bd)
                    datos['cecos_codigos'] = catalogo_cecos(maestro_bd)
                    datos['bd_actualizada'] = estado['actualizado']
                    if 'actualizado' in datos:
                        datos['actualizado'] = estado['actualizado']
                    self.responder(200, json.dumps(datos, ensure_ascii=False).encode(), 'application/json; charset=utf-8')
                except (ValueError, OverflowError) as error:
                    self.responder(400, json.dumps({'error': str(error)}).encode(), 'application/json')
                except Exception as error:
                    mensaje = f'No se pudo consultar la BD ({type(error).__name__}). Ejecuta Actualizar_BD.bat y vuelve a consultar.'
                    self.responder(500, json.dumps({'error': mensaje}).encode(), 'application/json')
            else:
                self.responder(404, b'No encontrado', 'text/plain')

        def do_POST(self):
            try:
                longitud = int(self.headers.get('Content-Length', '0'))
            except ValueError:
                longitud = -1
            if not 0 <= longitud <= 1048576:
                self.responder(400, b'{"error":"Solicitud invalida."}', 'application/json')
                return
            cuerpo = self.rfile.read(longitud)
            ruta = urlsplit(self.path).path
            if ruta not in ('/api/bd/actualizar', '/api/configuracion'):
                self.responder(404, b'No encontrado', 'text/plain')
                return
            # Solo el panel local puede solicitar una carga; no acepta rutas del navegador.
            host = self.headers.get('Host', '')
            origen = self.headers.get('Origin')
            esperado = f'127.0.0.1:{self.server.server_address[1]}'
            host_valido = host in (esperado, f'localhost:{self.server.server_address[1]}')
            if (not host_valido or (origen and origen != 'http://' + host)
                    or self.headers.get('Sec-Fetch-Site') == 'cross-site'
                    or self.headers.get_content_type() != 'application/json'):
                self.responder(403, b'{"error":"Solicitud no permitida."}', 'application/json')
                return
            try:
                if ruta == '/api/configuracion':
                    datos = guardar_configuracion(args.bd, json.loads(cuerpo), publicacion)
                else:
                    datos = actualizar_base_datos(args.excel, args.maestro, args.bd, publicacion, args.zonas, catalogo_destino)
                self.responder(200, json.dumps(datos, ensure_ascii=False).encode(), 'application/json; charset=utf-8')
            except Exception as error:
                datos = {'error': f'No se pudo guardar o actualizar la BD: {error}.'}
                self.responder(500, json.dumps(datos, ensure_ascii=False).encode(), 'application/json; charset=utf-8')

    try:
        servidor = ServidorPanel(('127.0.0.1', args.puerto), Handler)
    except OSError as error:
        print(f'No se pudo iniciar el panel en el puerto {args.puerto}: {error}', flush=True)
        print('Si hay otro panel abierto, detén esa instancia antes de iniciar una nueva. '
              'También puedes elegir otro puerto con --puerto 8766.', flush=True)
        raise SystemExit(1)
    print(f'Panel disponible en http://127.0.0.1:{servidor.server_address[1]} | Reporte v2 | Ctrl+C para detener', flush=True)
    if args.abrir:
        import webbrowser
        webbrowser.open(f'http://127.0.0.1:{servidor.server_address[1]}/')
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        servidor.server_close()


if __name__ == '__main__':
    """ fecha = "22/09/2026"
    BASE = Path(__file__).parent
    # Convertir la fecha a objeto date
    fecha = datetime.strptime(fecha, "%d/%m/%Y").date()
    datos = crear_reporte(BASE / 'PruebaForm.xlsx', BASE / 'BD ACTIVOS MOBILES.xlsx', fecha)

    # Imprimir cada linea del json
    for linea in json.dumps(datos, ensure_ascii=False, indent=4).splitlines():
        print(linea) """
    main()
