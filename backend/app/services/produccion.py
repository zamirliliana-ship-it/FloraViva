"""
Cálculos de producción (lógica pura, sin base de datos).

Reglas clave:
  * Los pesos se convierten a kilogramos antes de sumarlos (g y kg no se mezclan).
  * Los frutos (unidades) y los kilos son magnitudes distintas: nunca se suman entre sí.
  * Una cosecha sin peso medido NO aporta peso: no se estima ni se rellena con ceros.
  * Se usa Decimal para evitar errores de redondeo (0.1 + 0.2 en float).

Hoy los totales de la API salen de las vistas SQL v_produccion_por_*;
este módulo sirve para pruebas, informes y cálculos que no estén en la base.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable, Mapping

FACTORES_A_KG: dict[str, Decimal] = {"kg": Decimal("1"), "g": Decimal("0.001")}
_TRES_DECIMALES = Decimal("0.001")


def convertir_a_kg(valor: float | int | str | Decimal, unidad: str) -> Decimal:
    """
    Convierte un peso a kilogramos.

    Raises:
        ValueError: si la unidad no es 'g' ni 'kg'.
    """
    if unidad not in FACTORES_A_KG:
        raise ValueError(f"Unidad de peso no válida: {unidad!r} (use 'g' o 'kg')")
    return (Decimal(str(valor)) * FACTORES_A_KG[unidad]).quantize(_TRES_DECIMALES)


@dataclass(frozen=True)
class ResumenProduccion:
    """Totales de un conjunto de cosechas."""

    total_cosechas: int
    total_frutos: int
    peso_total_kg: Decimal | None
    peso_promedio_kg: Decimal | None
    cosechas_con_peso: int
    cosechas_sin_peso: int


def resumir_cosechas(cosechas: Iterable[Mapping]) -> ResumenProduccion:
    """
    Calcula los totales de una lista de cosechas.

    Cada cosecha es un diccionario con las claves num_frutos, peso_valor y
    peso_unidad (las dos últimas pueden ser None si no se midió el peso).
    """
    total_cosechas = 0
    total_frutos = 0
    pesos_kg: list[Decimal] = []

    for cosecha in cosechas:
        total_cosechas += 1
        total_frutos += cosecha.get("num_frutos") or 0
        valor, unidad = cosecha.get("peso_valor"), cosecha.get("peso_unidad")
        if valor is not None and unidad is not None:
            pesos_kg.append(convertir_a_kg(valor, unidad))

    peso_total = sum(pesos_kg, Decimal("0")) if pesos_kg else None
    peso_promedio = (peso_total / len(pesos_kg)).quantize(_TRES_DECIMALES) if pesos_kg else None

    return ResumenProduccion(
        total_cosechas=total_cosechas,
        total_frutos=total_frutos,
        peso_total_kg=peso_total,
        peso_promedio_kg=peso_promedio,
        cosechas_con_peso=len(pesos_kg),
        cosechas_sin_peso=total_cosechas - len(pesos_kg),
    )
