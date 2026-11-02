"""Asignaciones históricas por patente, con límites de fecha inclusivos."""
from collections import defaultdict
from .excel import abrir_libro, normalizar, patente_valida, convertir_fecha


class Vigencias:
    def __init__(self, maestro):
        self.periodos = defaultdict(list)
        self.advertencias = []
        libro = abrir_libro(maestro)
        try:
            hoja = next((h for h in libro if normalizar(h.title) == 'VIGENCIA'), None)
            if hoja is None:
                raise ValueError('Falta VIGENCIA en la BD. Actualiza la BD con el libro que contiene esa hoja.')
            filas = hoja.iter_rows(values_only=True)
            indices = {normalizar(c): i for i, c in enumerate(next(filas, ())) if c}
            requeridas = {'PATENTE', 'INICIO VIGENCIA', 'FIN VIGENCIA', 'NOMBRE CECO ACTUAL',
                          'REGION ACTUAL', 'ZONA ACTUAL', 'LN', 'NOMBRE LN', 'CECO ACTUAL'}
            if not requeridas <= indices.keys():
                raise ValueError('VIGENCIA: faltan columnas: ' + ', '.join(sorted(requeridas - indices.keys())))
            for numero, fila in enumerate(filas, 2):
                def valor(c):
                    i = indices[c]
                    return fila[i] if i < len(fila) else None
                p = patente_valida(valor('PATENTE'))
                if not p:
                    continue
                inicio = convertir_fecha(valor('INICIO VIGENCIA'), libro.epoch)
                bruto_fin = valor('FIN VIGENCIA')
                fin = convertir_fecha(bruto_fin, libro.epoch)
                valido = bool(inicio and (bruto_fin in (None, '') or fin) and (not fin or fin >= inicio))
                if not valido:
                    self.advertencias.append(f'VIGENCIA, fila {numero}: {p} tiene fechas incompletas o inválidas; ese período no se incluye en la base.')
                codigo = valor('CECO ACTUAL')
                if isinstance(codigo, (int, float)) and float(codigo).is_integer():
                    codigo = str(int(codigo))
                self.periodos[p].append(dict(patente=p, inicio=inicio, fin=fin, valido=valido, fila=numero,
                    unidad=normalizar(valor('NOMBRE CECO ACTUAL')) or 'SIN CECO',
                    region=normalizar(valor('REGION ACTUAL')) or 'SIN REGIÓN',
                    zona=normalizar(valor('ZONA ACTUAL')) or 'SIN ZONA',
                    ln=normalizar(valor('LN')), linea=normalizar(valor('NOMBRE LN')) or 'SIN LÍNEA',
                    codigo=str(codigo or '').strip()))
        finally:
            libro.close()

    def resolver(self, patente, fecha):
        periodos = self.periodos.get(patente, [])
        candidatos = [p for p in periodos if p['valido'] and p['inicio'] <= fecha
                      and (p['fin'] is None or fecha <= p['fin'])]
        if len(candidatos) == 1:
            return candidatos[0], None
        if len(candidatos) > 1:
            return None, 'Vigencias superpuestas'
        if not periodos:
            return None, 'Sin registro en VIGENCIA'
        if any(not p['valido'] for p in periodos):
            return None, 'Fechas de vigencia incompletas o inválidas'
        return None, 'Fuera del período de vigencia'
