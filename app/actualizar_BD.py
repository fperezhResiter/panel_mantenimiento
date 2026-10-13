"""Recarga SQLite desde los Excel configurados para el portal."""
import argparse
from pathlib import Path
from .base_datos import actualizar_base_datos
from .servidor import BASE, LIBRO_EQUIPOS


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--excel', type=Path, default=LIBRO_EQUIPOS)
    parser.add_argument('--maestro', type=Path, default=LIBRO_EQUIPOS)
    parser.add_argument('--bd', type=Path, default=BASE / 'Datos' / 'mantenimiento.sqlite3')
    args = parser.parse_args()
    print('Leyendo los Excel. La BD anterior se conserva si la carga falla.', flush=True)
    try:
        estado = actualizar_base_datos(args.excel, args.maestro, args.bd)
    except Exception as error:
        print(f'ERROR: {error}', flush=True)
        raise SystemExit(1) from error
    print(f'BD actualizada: {args.bd.resolve()}\nFecha: {estado["actualizado"]}', flush=True)
    for hoja in estado['hojas']:
        print(f'  {hoja["hoja"]}: {hoja["filas"]} filas', flush=True)


if __name__ == '__main__':
    main()
