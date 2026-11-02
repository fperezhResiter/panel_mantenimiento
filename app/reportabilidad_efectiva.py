"""Validación de la última lectura ADC de cada patente, unidad y semana."""
import math
from datetime import datetime, time
from openpyxl.utils.datetime import from_excel
from .excel import convertir_fecha, normalizar, patente_valida, TIPO_ADC
from .seguimiento import unidad_control


def numero_medidor(valor):
    # Un negativo sigue siendo el dato anterior: no se salta a uno más antiguo.
    if valor is None or isinstance(valor, bool):
        return None
    try:
        valor = float(str(valor).strip().replace(',', '.'))
        return valor if math.isfinite(valor) else None
    except (TypeError, ValueError):
        return None


def hora_envio(valor, epoch):
    """Conserva el orden horario de fechas nativas, series Excel y textos."""
    if isinstance(valor, (int, float)) and not isinstance(valor, bool):
        valor = from_excel(valor, epoch)
    if isinstance(valor, str):
        texto = valor.strip()
        try:
            valor = datetime.fromisoformat(texto)
        except ValueError:
            for formato in ('%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M',
                            '%d-%m-%Y %H:%M:%S', '%d-%m-%Y %H:%M'):
                try:
                    valor = datetime.strptime(texto, formato)
                    break
                except ValueError:
                    pass
    return valor.time().replace(tzinfo=None) if isinstance(valor, datetime) else time.min


def evaluar_criterios(filas, epoch, semanas):
    """Criterios cumplidos por el último ADC de cada patente/unidad/semana.

    Bits: 1 = actual > 0; 2 = actual >= anterior; 4 = actual <= 2 × anterior.
    Las comparaciones necesitan una lectura numérica anterior del mismo medidor.

    El antecedente es la lectura numérica anterior disponible de la misma
    patente y medidor, incluso fuera de las semanas visibles o en otra unidad.
    Se evalúa cada envío contra el anterior, aunque este no haya sido efectivo.
    Los ceros y negativos se conservan como antecedentes; los vacíos no son
    lecturas. En cada patente/unidad/semana prevalece el último envío ADC;
    una lectura posterior inválida no queda oculta por otra válida anterior.
    """
    ordenadas = []
    for indice, (hora, ceco, region, patente, tipo, control, km, hr) in enumerate(filas):
        dia, p = convertir_fecha(hora, epoch), patente_valida(patente)
        if normalizar(tipo) != normalizar(TIPO_ADC) or dia is None or not p:
            continue
        ordenadas.append((dia, hora_envio(hora, epoch), indice, p))
    anteriores, ultimas = {}, {}
    for dia, _, indice, p in sorted(ordenadas):
        hora, ceco, region, patente, tipo, control, km, hr = filas[indice]
        unidad = unidad_control(control)
        actual = numero_medidor(km if unidad == 'KM' else hr) if unidad else None
        anterior = anteriores.get((p, unidad))
        criterios = 0
        if actual is not None:
            if actual > 0:
                criterios |= 1
            if anterior is not None:
                if actual >= anterior:
                    criterios |= 2
                if actual <= 2 * anterior:
                    criterios |= 4
        for s in semanas:
            if s['inicio'] <= dia.isoformat() <= s['fin']:
                ultimas[p, normalizar(ceco), s['numero']] = (indice, criterios)
                break
        if unidad and actual is not None:
            anteriores[p, unidad] = actual
    return dict(ultimas.values())


def filas_efectivas(filas, epoch, semanas, criterios=7):
    """Cumple todos los criterios elegidos; por defecto exige los tres."""
    if type(criterios) is not int or not 0 <= criterios <= 7:
        raise ValueError('La combinación de criterios debe estar entre 0 y 7.')
    return {indice for indice, cumplidos in evaluar_criterios(filas, epoch, semanas).items()
            if cumplidos & criterios == criterios}
