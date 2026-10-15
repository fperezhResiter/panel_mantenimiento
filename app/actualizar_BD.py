"""Recarga SQLite desde los Excel configurados para el portal."""
import argparse
from pathlib import Path
from .base_datos import actualizar_base_datos
from .servidor import BASE, LIBRO_EQUIPOS, LIBRO_ZONAS


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--excel', type=Path, default=LIBRO_EQUIPOS)
    parser.add_argument('--maestro', type=Path, default=LIBRO_EQUIPOS)
    parser.add_argument('--bd', type=Path, default=BASE / 'Datos' / 'mantenimiento.sqlite3')
    parser.add_argument('--zonas', type=Path, default=LIBRO_ZONAS)
    args = parser.parse_args()
    publicacion = (BASE / 'web/datos/publicacion.js' if args.bd.resolve() == (BASE / 'Datos/mantenimiento.sqlite3').resolve()
                   else args.bd.resolve().parent / 'publicacion.js')
    catalogo_destino = (BASE / 'config/unidades_zonas.json' if args.bd.resolve() == (BASE / 'Datos/mantenimiento.sqlite3').resolve()
                        else args.bd.resolve().parent / 'unidades_zonas.json')
    print('Leyendo los Excel. La BD anterior se conserva si la carga falla.', flush=True)
    try:
        estado = actualizar_base_datos(args.excel, args.maestro, args.bd, publicacion, args.zonas, catalogo_destino)
    except Exception as error:
        print(f'ERROR: {error}', flush=True)
        raise SystemExit(1) from error
    print(f'BD actualizada: {args.bd.resolve()}\nFecha: {estado["actualizado"]}', flush=True)
    print('Consulta publicada. Abre Panel.html con doble clic, sin iniciar servidor.', flush=True)
    for hoja in estado['hojas']:
        print(f'  {hoja["hoja"]}: {hoja["filas"]} filas', flush=True)


if __name__ == '__main__':
    main()
