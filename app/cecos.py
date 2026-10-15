"""Catálogo de códigos CeCo del maestro, separado de las claves de agrupación."""
from .excel import abrir_libro, normalizar


def catalogo_cecos(maestro):
    libro = abrir_libro(maestro)
    candidatos = {}
    try:
        hoja = next((h for h in libro if normalizar(h.title) in
                     ('BD ACTIVOS MOVILES', 'BD ACTIVOS MOBILES')), None)
        if hoja is None:
            return {}
        filas = hoja.iter_rows(values_only=True)
        indices = {normalizar(v): i for i, v in enumerate(next(filas, ()))}
        if not {'NOMBRE CECO ACTUAL', 'CECO ACTUAL'} <= indices.keys():
            return {}
        for fila in filas:
            nombre = normalizar(fila[indices['NOMBRE CECO ACTUAL']])
            valor = fila[indices['CECO ACTUAL']]
            if not nombre or valor is None or isinstance(valor, bool):
                continue
            codigo = str(int(valor)) if isinstance(valor, (int, float)) and float(valor).is_integer() else str(valor).strip()
            if codigo and normalizar(codigo) not in ('-', 'N/A', 'NA', 'SIN CECO'):
                candidatos.setdefault(nombre, set()).add(codigo)
        # Un nombre ambiguo conserva su etiqueta sin atribuirle un código erróneo.
        return {nombre: next(iter(codigos)) for nombre, codigos in sorted(candidatos.items()) if len(codigos) == 1}
    finally:
        libro.close()
