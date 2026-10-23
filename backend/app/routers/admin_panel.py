"""Panel administrativo: métricas agregadas y moderación del foro.

Todas las rutas exigen el token administrativo temporal que se obtiene tras
validar el código por correo (Authorization: Bearer <token_admin>).

Privacidad: el panel muestra solo cifras agregadas. No expone correos, ni los
cultivos, fotos o escaneos individuales de cada persona.
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from supabase import Client

from app.core.supabase_client import cliente_admin
from app.routers.admin import verificar_token_admin

router = APIRouter(prefix="/api/admin/panel", tags=["Panel administrativo"])

TABLAS_CONTEO = {
    "cultivos": "cultivos",
    "plantas": "plantas",
    "observaciones": "observaciones_cultivo",
    "registros_produccion": "produccion_cultivo",
    "publicaciones_foro": "foro_publicaciones",
    "escaneos": "identificaciones",
    "recordatorios": "recordatorios",
}


def admin_requerido(authorization: str | None = Header(default=None, alias="Authorization")) -> dict:
    """Exige un token administrativo válido; un token de usuario normal no sirve."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Falta la sesión administrativa.")
    return verificar_token_admin(authorization.removeprefix("Bearer ").strip())


def _contar(db: Client, tabla: str) -> int | None:
    try:
        return db.table(tabla).select("id", count="exact").limit(1).execute().count or 0
    except Exception:
        return None  # una tabla que falle no tumba todo el panel


def _a_fecha(valor) -> datetime | None:
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor if valor.tzinfo else valor.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
    except ValueError:
        return None


def _usuarios_resumen(db: Client) -> dict:
    total = confirmados = nuevos = 0
    limite = datetime.now(timezone.utc) - timedelta(days=7)
    for pagina in range(1, 21):
        usuarios = db.auth.admin.list_users(page=pagina, per_page=200)
        if not usuarios:
            break
        for u in usuarios:
            total += 1
            if getattr(u, "email_confirmed_at", None):
                confirmados += 1
            creado = _a_fecha(getattr(u, "created_at", None))
            if creado and creado >= limite:
                nuevos += 1
        if len(usuarios) < 200:
            break
    return {"total": total, "confirmados": confirmados, "sin_confirmar": total - confirmados, "nuevos_7_dias": nuevos}


def _filas(db: Client, tabla: str, columnas: str, maximo: int = 5000) -> list[dict]:
    """Lee una tabla por páginas de 1000 filas (límite de PostgREST)."""
    filas: list[dict] = []
    for inicio in range(0, maximo, 1000):
        lote = db.table(tabla).select(columnas).range(inicio, inicio + 999).execute().data or []
        filas.extend(lote)
        if len(lote) < 1000:
            break
    return filas


@router.get("/metricas")
def metricas(_: dict = Depends(admin_requerido)):
    """Cifras agregadas de toda la plataforma."""
    db = cliente_admin()
    resultado: dict = {"generado_en": datetime.now(timezone.utc).isoformat()}

    try:
        resultado["usuarios"] = _usuarios_resumen(db)
    except Exception:
        resultado["usuarios"] = None

    for clave, tabla in TABLAS_CONTEO.items():
        resultado[clave] = _contar(db, tabla)

    try:
        resultado["frutos_registrados"] = sum(int(f.get("cantidad_frutos") or 0) for f in _filas(db, "produccion_cultivo", "cantidad_frutos"))
    except Exception:
        resultado["frutos_registrados"] = None

    try:
        nombres = [str(f.get("nombre_comun") or "").strip().lower() for f in _filas(db, "cultivos", "nombre_comun")]
        resultado["cultivos_frecuentes"] = [{"nombre": n.capitalize(), "total": t} for n, t in Counter(x for x in nombres if x).most_common(5)]
    except Exception:
        resultado["cultivos_frecuentes"] = []

    try:
        categorias = [f.get("categoria") for f in _filas(db, "foro_publicaciones", "categoria")]
        resultado["foro_por_categoria"] = [{"categoria": c, "total": t} for c, t in Counter(x for x in categorias if x).most_common()]
    except Exception:
        resultado["foro_por_categoria"] = []

    return resultado


@router.get("/foro")
def listar_foro(_: dict = Depends(admin_requerido)):
    """Últimas 50 publicaciones del foro para moderar."""
    db = cliente_admin()
    try:
        filas = (
            db.table("foro_publicaciones")
            .select("id, autor_nombre, titulo, categoria, contenido, created_at")
            .order("created_at", desc=True)
            .limit(50)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        raise HTTPException(503, "No se pudo leer el foro.") from exc
    for fila in filas:
        texto = str(fila.get("contenido") or "")
        fila["contenido"] = texto if len(texto) <= 280 else texto[:277] + "…"
    return {"publicaciones": filas}


@router.delete("/foro/{publicacion_id}")
def eliminar_publicacion(publicacion_id: UUID, _: dict = Depends(admin_requerido)):
    """Elimina una publicación del foro (moderación)."""
    db = cliente_admin()
    try:
        borradas = db.table("foro_publicaciones").delete().eq("id", str(publicacion_id)).execute().data or []
    except Exception as exc:
        raise HTTPException(503, "No se pudo eliminar la publicación.") from exc
    if not borradas:
        raise HTTPException(404, "La publicación no existe o ya fue eliminada.")
    return {"eliminado": True, "id": str(publicacion_id)}
