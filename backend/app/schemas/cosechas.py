"""
Esquemas de las cosechas.

Reglas de negocio (las mismas que protege la base de datos):
  * El peso es OPCIONAL y solo se registra si fue medido. Nunca se estima.
  * Si hay peso debe traer su unidad (g o kg), y viceversa.
  * Toda cosecha debe traer al menos el número de frutos o un peso.
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

UnidadPeso = Literal["g", "kg"]
Calidad = Literal["excelente", "optima", "consumo_inmediato", "conserva"]
PuntoMaduracion = Literal["optimo", "pinton", "sobremaduro"]
Destino = Literal["consumo_propio", "regalo", "venta", "semillero"]


class CosechaCrear(BaseModel):
    model_config = ConfigDict(extra="forbid")

    planta_id: UUID
    fecha_cosecha: datetime | None = None  # si no se envía, se usa la fecha actual
    num_frutos: int | None = Field(default=None, ge=0)
    peso_valor: float | None = Field(default=None, ge=0)
    peso_unidad: UnidadPeso | None = None
    calidad: Calidad | None = None
    punto_maduracion: PuntoMaduracion | None = None
    destino: Destino | None = None
    notas: str | None = None

    @model_validator(mode="after")
    def validar_reglas(self) -> "CosechaCrear":
        if (self.peso_valor is None) != (self.peso_unidad is None):
            raise ValueError("El peso y su unidad (g o kg) deben enviarse juntos")
        if self.num_frutos is None and self.peso_valor is None:
            raise ValueError("Indica el número de frutos o el peso medido")
        return self


class CosechaSalida(BaseModel):
    id: UUID
    planta_id: UUID
    fecha_cosecha: datetime
    num_frutos: int | None = None
    peso_valor: float | None = None
    peso_unidad: UnidadPeso | None = None
    peso_kg: float | None = None  # convertido a kg por la base de datos
    calidad: Calidad | None = None
    punto_maduracion: PuntoMaduracion | None = None
    destino: Destino | None = None
    notas: str | None = None
    creado_en: datetime
