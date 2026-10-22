"""
Esquemas de las estadísticas de producción.

peso_total_kg y peso_promedio_kg son None cuando ninguna cosecha tiene
peso medido: no se inventa un peso.
"""

from datetime import datetime

from pydantic import BaseModel


class ProduccionPlantaSalida(BaseModel):
    total_cosechas: int = 0
    total_frutos: int = 0
    peso_total_kg: float | None = None
    peso_promedio_kg: float | None = None
    primera_cosecha: datetime | None = None
    ultima_cosecha: datetime | None = None


class ProduccionCultivoSalida(BaseModel):
    total_plantas: int = 0
    total_cosechas: int = 0
    total_frutos: int = 0
    peso_total_kg: float | None = None
