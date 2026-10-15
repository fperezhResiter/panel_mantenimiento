"""Importa únicamente unidad, centro de costo, zona y líneas del catálogo GDM."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.catalogo_zonas import leer_catalogo_zonas


def importar(fuente, destino):
    destino = Path(destino)
    anterior = json.loads(destino.read_text(encoding='utf-8')) if destino.exists() else None
    contenido = leer_catalogo_zonas(fuente, anterior)
    Path(destino).write_text(json.dumps(contenido, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    return len(contenido['unidades'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('excel', type=Path)
    parser.add_argument('--salida', type=Path, default=Path(__file__).resolve().parents[1]/'config/unidades_zonas.json')
    args = parser.parse_args()
    print(f'{importar(args.excel, args.salida)} asociaciones importadas en {args.salida}')
