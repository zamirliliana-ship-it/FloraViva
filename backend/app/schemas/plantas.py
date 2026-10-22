"""
Esquemas de las plantas individuales.

El estado de la planta refleja la etapa actual de su ciclo de vida.
"""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

EstadoPlanta = Literal[
    "sembrada", "germinada", "en_floracion", "en_fructificacion", "en_cosecha", "finalizada"
]


class PlantaCrear(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cultivo_id: UUID
    nombre: str = Field(min_length=1, max_length=120)
    especie_id: UUID | None = None
    fecha_siembra: date | None = None
    estado: EstadoPlanta = "sembrada"
    observaciones: str | None = None


class PlantaActualizar(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre: str | None = Field(default=None, min_length=1, max_length=120)
    especie_id: UUID | None = None
    fecha_siembra: date | None = None
    estado: EstadoPlanta | None = None
    observaciones: str | None = None


class PlantaSalida(BaseModel):
    id: UUID
    cultivo_id: UUID
    nombre: str
    especie_id: UUID | None = None
    fecha_siembra: date | None = None
    estado: EstadoPlanta
    observaciones: str | None = None
    creado_en: datetime
    actualizado_en: datetime