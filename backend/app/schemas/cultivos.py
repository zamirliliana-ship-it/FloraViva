"""
Esquemas (forma de los datos) de los cultivos.

    CultivoCrear       Lo que envía el frontend al crear un cultivo.
    CultivoActualizar  Cambios parciales: solo se envían los campos a modificar.
    CultivoSalida      Lo que devuelve la API.

Los esquemas de entrada rechazan campos desconocidos (extra="forbid"), así
nadie puede intentar enviar por ejemplo un user_id ajeno.
"""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

EstadoCultivo = Literal["planificado", "activo", "finalizado"]


class CultivoCrear(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre_comun: str = Field(min_length=1, max_length=120)
    nombre_cientifico: str | None = Field(default=None, max_length=160)
    variedad: str | None = Field(default=None, max_length=120)
    ubicacion: str | None = Field(default=None, max_length=160)
    fecha_siembra: date | None = None
    cantidad_plantas: int | None = Field(default=None, gt=0)
    estado: EstadoCultivo = "activo"
    observaciones: str | None = None
    especie_id: UUID | None = None


class CultivoActualizar(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre_comun: str | None = Field(default=None, min_length=1, max_length=120)
    nombre_cientifico: str | None = Field(default=None, max_length=160)
    variedad: str | None = Field(default=None, max_length=120)
    ubicacion: str | None = Field(default=None, max_length=160)
    fecha_siembra: date | None = None
    cantidad_plantas: int | None = Field(default=None, gt=0)
    estado: EstadoCultivo | None = None
    observaciones: str | None = None
    especie_id: UUID | None = None


class CultivoSalida(BaseModel):
    id: UUID
    nombre_comun: str
    nombre_cientifico: str | None = None
    variedad: str | None = None
    ubicacion: str | None = None
    fecha_siembra: date | None = None
    cantidad_plantas: int | None = None
    estado: EstadoCultivo
    observaciones: str | None = None
    especie_id: UUID | None = None
    creado_en: datetime
    actualizado_en: datetime
