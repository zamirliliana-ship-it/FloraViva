"""
Rutas de cultivos:  /api/cultivos

    GET     /api/cultivos        Lista los cultivos del usuario.
    POST    /api/cultivos        Crea un cultivo.
    GET     /api/cultivos/{id}   Consulta un cultivo.
    PATCH   /api/cultivos/{id}   Modifica campos de un cultivo.
    DELETE  /api/cultivos/{id}   Elimina el cultivo (y sus plantas y cosechas).

Todas exigen sesión. La base de datos solo devuelve los cultivos del usuario.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from supabase import Client

from app.core.seguridad import UsuarioActual
from app.dependencias import base_de_datos, usuario_actual
from app.schemas.cultivos import CultivoActualizar, CultivoCrear, CultivoSalida
from app.utils.respuestas import primero_o_404

router = APIRouter(prefix="/api/cultivos", tags=["Cultivos"])
NO_ENCONTRADO = "Cultivo no encontrado"


@router.get("", response_model=list[CultivoSalida])
def listar_cultivos(
    estado: str | None = Query(default=None, description="Filtra por estado"),
    limite: int = Query(default=50, ge=1, le=200),
    desplazamiento: int = Query(default=0, ge=0),
    db: Client = Depends(base_de_datos),
):
    """Lista los cultivos del usuario, del más reciente al más antiguo."""
    consulta = db.table("cultivos").select("*")
    if estado:
        consulta = consulta.eq("estado", estado)
    respuesta = (
        consulta.order("creado_en", desc=True)
        .range(desplazamiento, desplazamiento + limite - 1)
        .execute()
    )
    return respuesta.data


@router.post("", response_model=CultivoSalida, status_code=status.HTTP_201_CREATED)
def crear_cultivo(
    datos: CultivoCrear,
    usuario: UsuarioActual = Depends(usuario_actual),
    db: Client = Depends(base_de_datos),
):
    """Crea un cultivo. El dueño se toma de la sesión, no del cuerpo de la petición."""
    nuevo = datos.model_dump(mode="json", exclude_none=True) | {"user_id": usuario.id}
    return primero_o_404(db.table("cultivos").insert(nuevo).execute(), NO_ENCONTRADO)


@router.get("/{cultivo_id}", response_model=CultivoSalida)
def obtener_cultivo(cultivo_id: UUID, db: Client = Depends(base_de_datos)):
    """Consulta un cultivo por su id."""
    respuesta = db.table("cultivos").select("*").eq("id", str(cultivo_id)).limit(1).execute()
    return primero_o_404(respuesta, NO_ENCONTRADO)


@router.patch("/{cultivo_id}", response_model=CultivoSalida)
def actualizar_cultivo(
    cultivo_id: UUID, datos: CultivoActualizar, db: Client = Depends(base_de_datos)
):
    """Modifica solo los campos enviados."""
    cambios = datos.model_dump(mode="json", exclude_unset=True)
    if not cambios:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No se enviaron cambios")
    respuesta = db.table("cultivos").update(cambios).eq("id", str(cultivo_id)).execute()
    return primero_o_404(respuesta, NO_ENCONTRADO)


@router.delete("/{cultivo_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cultivo(cultivo_id: UUID, db: Client = Depends(base_de_datos)):
    """Elimina el cultivo junto con sus plantas, eventos y cosechas."""
    respuesta = db.table("cultivos").delete().eq("id", str(cultivo_id)).execute()
    primero_o_404(respuesta, NO_ENCONTRADO)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
