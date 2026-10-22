"""
Rutas de estadísticas de producción:  /api/estadisticas

    GET  /api/estadisticas/plantas/{id}    Totales de una planta.
    GET  /api/estadisticas/cultivos/{id}   Totales de un cultivo.

Los totales los calculan las vistas SQL v_produccion_por_planta y
v_produccion_por_cultivo. Si no hay cosechas con peso medido, el peso
total sale como null (no se inventa un valor).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencias import base_de_datos
from app.schemas.estadisticas import ProduccionCultivoSalida, ProduccionPlantaSalida

router = APIRouter(prefix="/api/estadisticas", tags=["Estadísticas"])


@router.get("/plantas/{planta_id}", response_model=ProduccionPlantaSalida)
def produccion_de_planta(planta_id: UUID, db: Client = Depends(base_de_datos)):
    """Totales de producción de una planta (ceros si aún no tiene cosechas)."""
    vista = (
        db.table("v_produccion_por_planta")
        .select("*")
        .eq("planta_id", str(planta_id))
        .limit(1)
        .execute()
    )
    if vista.data:
        return vista.data[0]

    existe = db.table("plantas").select("id").eq("id", str(planta_id)).limit(1).execute()
    if not existe.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Planta no encontrada")
    return ProduccionPlantaSalida()


@router.get("/cultivos/{cultivo_id}", response_model=ProduccionCultivoSalida)
def produccion_de_cultivo(cultivo_id: UUID, db: Client = Depends(base_de_datos)):
    """Totales de producción de un cultivo (ceros si aún no tiene plantas)."""
    vista = (
        db.table("v_produccion_por_cultivo")
        .select("*")
        .eq("cultivo_id", str(cultivo_id))
        .limit(1)
        .execute()
    )
    if vista.data:
        return vista.data[0]

    existe = db.table("cultivos").select("id").eq("id", str(cultivo_id)).limit(1).execute()
    if not existe.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cultivo no encontrado")
    return ProduccionCultivoSalida()
