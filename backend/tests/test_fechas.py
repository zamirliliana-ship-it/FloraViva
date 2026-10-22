"""Pruebas de los cálculos de fechas. Ejecutar con:  pytest"""

from datetime import date

import pytest

from app.utils.fechas import dias_desde, dias_entre


def test_dias_entre_etapas():
    assert dias_entre(date(2026, 10, 1), date(2026, 10, 11)) == 10


def test_mismo_dia():
    assert dias_entre(date(2026, 10, 1), date(2026, 10, 1)) == 0


def test_fecha_final_anterior():
    with pytest.raises(ValueError):
        dias_entre(date(2026, 10, 11), date(2026, 10, 1))


def test_dias_desde_con_hoy_fijo():
    assert dias_desde(date(2026, 9, 10), hoy=date(2026, 10, 20)) == 40
