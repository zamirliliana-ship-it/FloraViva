"""
Rutas de cosechas:  /api/cosechas

    GET     /api/cosechas        Lista cosechas (filtro opcional ?planta_id=).
    POST    /api/cosechas        Registra una cosecha.
    GET     /api/cosechas/{id}   Consulta una cosecha.
    DELETE  /api/cosechas/{id}   Elimina una cosecha.

El peso es opcional y solo se guarda si fue medido (ver schemas/cosechas.py).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from supabase import Client

from app.core.seguridad import UsuarioActual
from app.dependencias import base_de_datos, usuario_actual
from app.schemas.cosechas import CosechaCrear, CosechaSalida
from app.utils.respuestas import primero_o_404

router = APIRouter(prefix="/api/cosechas", tags=["Cosechas"])
NO_ENCONTRADA = "Cosecha no encontrada"


@router.get("", response_model=list[CosechaSalida])
def listar_cosechas(
    planta_id: UUID | None = Query(default=None, description="Solo las cosechas de esta planta"),
    limite: int = Query(default=50, ge=1, le=200),
    desplazamiento: int = Query(default=0, ge=0),
    db: Client = Depends(base_de_datos),
):
    """Lista las cosechas, de la más reciente a la más antigua."""
    consulta = db.table("cosechas").select("*")
    if planta_id:
        consulta = consulta.eq("planta_id", str(planta_id))
    respuesta = (
        consulta.order("fecha_cosecha", desc=True)
        .range(desplazamiento, desplazamiento + limite - 1)
        .execute()
    )
    return respuesta.data


@router.post("", response_model=CosechaSalida, status_code=status.HTTP_201_CREATED)
def crear_cosecha(
    datos: CosechaCrear,
    usuario: UsuarioActual = Depends(usuario_actual),
    db: Client = Depends(base_de_datos),
):
    """Registra una cosecha en una planta del usuario."""
    nueva = datos.model_dump(mode="json", exclude_none=True) | {"user_id": usuario.id}
    return primero_o_404(db.table("cosechas").insert(nueva).execute(), NO_ENCONTRADA)


@router.get("/{cosecha_id}", response_model=CosechaSalida)
def obtener_cosecha(cosecha_id: UUID, db: Client = Depends(base_de_datos)):
    """Consulta una cosecha por su id."""
    respuesta = db.table("cosechas").select("*").eq("id", str(cosecha_id)).limit(1).execute()
    return primero_o_404(respuesta, NO_ENCONTRADA)


@router.delete("/{cosecha_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cosecha(cosecha_id: UUID, db: Client = Depends(base_de_datos)):
    """Elimina una cosecha."""
    respuesta = db.table("cosechas").delete().eq("id", str(cosecha_id)).execute()
    primero_o_404(respuesta, NO_ENCONTRADA)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
