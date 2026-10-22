"""Pruebas del cálculo de producción. Ejecutar con:  pytest"""

from decimal import Decimal

import pytest

from app.services.produccion import convertir_a_kg, resumir_cosechas


def test_ejemplo_del_documento():
    """Tres cosechas del documento de propuesta: 30 frutos y 4,0 kg."""
    cosechas = [
        {"num_frutos": 12, "peso_valor": 1.5, "peso_unidad": "kg"},
        {"num_frutos": 8, "peso_valor": 1.1, "peso_unidad": "kg"},
        {"num_frutos": 10, "peso_valor": 1.4, "peso_unidad": "kg"},
    ]
    r = resumir_cosechas(cosechas)
    assert r.total_cosechas == 3
    assert r.total_frutos == 30
    assert r.peso_total_kg == Decimal("4.0")
    assert r.peso_promedio_kg == Decimal("1.333")


def test_mezcla_gramos_y_kilos():
    r = resumir_cosechas([
        {"num_frutos": 5, "peso_valor": 500, "peso_unidad": "g"},
        {"num_frutos": 5, "peso_valor": 1, "peso_unidad": "kg"},
    ])
    assert r.peso_total_kg == Decimal("1.5")


def test_sin_peso_no_se_estima():
    r = resumir_cosechas([{"num_frutos": 7, "peso_valor": None, "peso_unidad": None}])
    assert r.total_frutos == 7
    assert r.peso_total_kg is None
    assert r.peso_promedio_kg is None
    assert r.cosechas_sin_peso == 1


def test_cosecha_sin_peso_no_baja_el_promedio():
    r = resumir_cosechas([
        {"num_frutos": 3, "peso_valor": 2, "peso_unidad": "kg"},
        {"num_frutos": 4, "peso_valor": None, "peso_unidad": None},
    ])
    assert r.peso_promedio_kg == Decimal("2.000")
    assert r.cosechas_con_peso == 1


def test_lista_vacia():
    r = resumir_cosechas([])
    assert (r.total_cosechas, r.total_frutos, r.peso_total_kg) == (0, 0, None)


def test_sin_error_de_redondeo_de_float():
    assert convertir_a_kg(0.1, "kg") + convertir_a_kg(0.2, "kg") == Decimal("0.3")


def test_unidad_invalida():
    with pytest.raises(ValueError):
        convertir_a_kg(1, "lb")
