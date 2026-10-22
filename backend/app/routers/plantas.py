"""
Rutas de plantas:  /api/plantas

    GET     /api/plantas         Lista las plantas (filtro opcional ?cultivo_id=).
    POST    /api/plantas         Registra una planta dentro de un cultivo.
    GET     /api/plantas/{id}    Consulta una planta.
    PATCH   /api/plantas/{id}    Modifica campos (por ejemplo, su estado).
    DELETE  /api/plantas/{id}    Elimina la planta (y sus eventos y cosechas).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from supabase import Client

from app.core.seguridad import UsuarioActual
from app.dependencias import base_de_datos, usuario_actual
from app.schemas.plantas import PlantaActualizar, PlantaCrear, PlantaSalida
from app.utils.respuestas import primero_o_404

router = APIRouter(prefix="/api/plantas", tags=["Plantas"])
NO_ENCONTRADA = "Planta no encontrada"


@router.get("", response_model=list[PlantaSalida])
def listar_plantas(
    cultivo_id: UUID | None = Query(default=None, description="Solo las plantas de este cultivo"),
    limite: int = Query(default=50, ge=1, le=200),
    desplazamiento: int = Query(default=0, ge=0),
    db: Client = Depends(base_de_datos),
):
    """Lista las plantas del usuario, de la más reciente a la más antigua."""
    consulta = db.table("plantas").select("*")
    if cultivo_id:
        consulta = consulta.eq("cultivo_id", str(cultivo_id))
    respuesta = (
        consulta.order("creado_en", desc=True)
        .range(desplazamiento, desplazamiento + limite - 1)
        .execute()
    )
    return respuesta.data


@router.post("", response_model=PlantaSalida, status_code=status.HTTP_201_CREATED)
def crear_planta(
    datos: PlantaCrear,
    usuario: UsuarioActual = Depends(usuario_actual),
    db: Client = Depends(base_de_datos),
):
    """
    Registra una planta. Si el cultivo no existe o es de otra persona, la base
    de datos lo rechaza (clave foránea compuesta) y se responde con un 400.
    """
    nueva = datos.model_dump(mode="json", exclude_none=True) | {"user_id": usuario.id}
    return primero_o_404(db.table("plantas").insert(nueva).execute(), NO_ENCONTRADA)


@router.get("/{planta_id}", response_model=PlantaSalida)
def obtener_planta(planta_id: UUID, db: Client = Depends(base_de_datos)):
    """Consulta una planta por su id."""
    respuesta = db.table("plantas").select("*").eq("id", str(planta_id)).limit(1).execute()
    return primero_o_404(respuesta, NO_ENCONTRADA)


@router.patch("/{planta_id}", response_model=PlantaSalida)
def actualizar_planta(
    planta_id: UUID, datos: PlantaActualizar, db: Client = Depends(base_de_datos)
):
    """Modifica solo los campos enviados."""
    cambios = datos.model_dump(mode="json", exclude_unset=True)
    if not cambios:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No se enviaron cambios")
    respuesta = db.table("plantas").update(cambios).eq("id", str(planta_id)).execute()
    return primero_o_404(respuesta, NO_ENCONTRADA)


@router.delete("/{planta_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_planta(planta_id: UUID, db: Client = Depends(base_de_datos)):
    """Elimina la planta junto con sus eventos y cosechas."""
    respuesta = db.table("plantas").delete().eq("id", str(planta_id)).execute()
    primero_o_404(respuesta, NO_ENCONTRADA)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
