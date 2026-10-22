"""Cálculos de fechas del ciclo de vida de las plantas."""

from datetime import date


def dias_entre(inicio: date, fin: date) -> int:
    """
    Días transcurridos entre dos etapas (por ejemplo, siembra y germinación).

    Raises:
        ValueError: si la fecha final es anterior a la inicial.
    """
    if fin < inicio:
        raise ValueError("La fecha final no puede ser anterior a la inicial")
    return (fin - inicio).days


def dias_desde(fecha: date, hoy: date | None = None) -> int:
    """Días transcurridos desde una fecha hasta hoy (o hasta 'hoy' si se indica)."""
    return dias_entre(fecha, hoy or date.today())
