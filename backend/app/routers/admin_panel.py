"""Panel administrativo: métricas agregadas y moderación del foro.

Todas las rutas exigen el token administrativo temporal.
El panel muestra métricas agregadas y no expone datos personales individuales.
"""
from __future__ import annotations

from collections import Counter
from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from supabase import Client

from app.core.supabase_client import cliente_admin
from app.routers.admin import verificar_token_admin

router = APIRouter(prefix="/api/admin/panel", tags=["Panel administrativo"])

# Los días de las gráficas se cuentan en hora de Colombia (UTC-5, sin horario
# de verano). Con UTC, lo registrado después de las 7 p. m. caía en el día
# siguiente.
ZONA_PANEL = timezone(timedelta(hours=-5))

TABLAS_CONTEO = {
    "cultivos": "cultivos",
    "plantas": "plantas",
    "observaciones": "observaciones_cultivo",
    "registros_produccion": "produccion_cultivo",
    "publicaciones_foro": "foro_publicaciones",
    "escaneos": "identificaciones",
    "recordatorios": "recordatorios",
}


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def admin_requerido(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict:
    """Exige un token administrativo válido."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Falta la sesión administrativa.")
    return verificar_token_admin(authorization.removeprefix("Bearer ").strip())


def _contar(db: Client, tabla: str) -> int | None:
    try:
        respuesta = (
            db.table(tabla)
            .select("id", count="exact")
            .limit(1)
            .execute()
        )
        return respuesta.count or 0
    except Exception:
        return None


def _a_fecha(valor) -> datetime | None:
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor if valor.tzinfo else valor.replace(tzinfo=timezone.utc)
    try:
        resultado = datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
        return resultado if resultado.tzinfo else resultado.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _dia_local(valor) -> str | None:
    """Día (AAAA-MM-DD) en hora de Colombia de una marca de tiempo."""
    fecha = _a_fecha(valor)
    if fecha is None:
        return None
    return fecha.astimezone(ZONA_PANEL).date().isoformat()


def _ventana_utc(fechas: list[str]) -> tuple[str, str]:
    """Inicio y fin (en UTC) que cubren los días locales indicados."""
    inicio = datetime.combine(
        date.fromisoformat(fechas[0]), time.min, tzinfo=ZONA_PANEL
    )
    fin = datetime.combine(
        date.fromisoformat(fechas[-1]) + timedelta(days=1),
        time.min,
        tzinfo=ZONA_PANEL,
    )
    return (
        inicio.astimezone(timezone.utc).isoformat(),
        fin.astimezone(timezone.utc).isoformat(),
    )


def _usuarios_resumen(db: Client, fechas: list[str]) -> dict:
    total = confirmados = 0
    nuevos_por_dia: Counter = Counter()

    # Mantiene el límite de paginación del panel actual.
    for pagina in range(1, 21):
        respuesta = db.auth.admin.list_users(page=pagina, per_page=200)
        usuarios = getattr(respuesta, "users", respuesta)

        if not usuarios:
            break

        for usuario in usuarios:
            total += 1

            if getattr(usuario, "email_confirmed_at", None):
                confirmados += 1

            dia = _dia_local(getattr(usuario, "created_at", None))
            if dia in fechas:
                nuevos_por_dia[dia] += 1

        if len(usuarios) < 200:
            break

    serie = [
        {"fecha": fecha, "total": nuevos_por_dia[fecha]}
        for fecha in fechas
    ]

    return {
        "total": total,
        "confirmados": confirmados,
        "sin_confirmar": total - confirmados,
        "nuevos_7_dias": sum(punto["total"] for punto in serie[-7:]),
        "nuevos_por_dia": serie,
    }


def _filas(
    db: Client,
    tabla: str,
    columnas: str,
    maximo: int = 5000,
) -> list[dict]:
    """Lee filas por páginas de 1000 registros."""
    filas: list[dict] = []

    for inicio in range(0, maximo, 1000):
        lote = (
            db.table(tabla)
            .select(columnas)
            .order("id")
            .range(inicio, inicio + 999)
            .execute()
            .data
            or []
        )
        filas.extend(lote)

        if len(lote) < 1000:
            break

    return filas


def _serie_diaria_tabla(
    db: Client,
    tabla: str,
    fechas: list[str],
    columnas_fecha: list[str],
) -> list[dict] | None:
    """Cuenta registros diarios probando columnas de fecha conocidas.

    Devuelve None si la tabla o sus columnas de fecha no son compatibles.
    """
    inicio, fin = _ventana_utc(fechas)

    for columna in columnas_fecha:
        conteos: Counter = Counter()
        desplazamiento = 0

        try:
            while True:
                lote = (
                    db.table(tabla)
                    .select(columna)
                    .gte(columna, inicio)
                    .lt(columna, fin)
                    .order(columna)
                    .order("id")
                    .range(desplazamiento, desplazamiento + 999)
                    .execute()
                    .data
                    or []
                )

                for fila in lote:
                    dia = _dia_local(fila.get(columna))
                    if dia in fechas:
                        conteos[dia] += 1

                if len(lote) < 1000:
                    break

                desplazamiento += 1000

            return [
                {"fecha": fecha, "total": conteos[fecha]}
                for fecha in fechas
            ]

        except Exception:
            # Si la columna no existe, intenta la siguiente alternativa.
            continue

    return None


def _sumar_series(fechas: list[str], *series: list[dict] | None) -> list[dict] | None:
    """Suma series diarias; ignora las que no están disponibles."""
    disponibles = [serie for serie in series if serie is not None]
    if not disponibles:
        return None

    return [
        {
            "fecha": fecha,
            "total": sum(serie[indice]["total"] for serie in disponibles),
        }
        for indice, fecha in enumerate(fechas)
    ]


@router.get("/metricas")
def metricas(_: dict = Depends(admin_requerido)):
    """Cifras generales y series diarias de los últimos 14 días."""
    db = cliente_admin()
    hoy = _ahora().astimezone(ZONA_PANEL).date()
    fechas = [
        (hoy - timedelta(days=d)).isoformat()
        for d in range(13, -1, -1)
    ]

    resultado: dict = {"generado_en": _ahora().isoformat()}

    try:
        resultado["usuarios"] = _usuarios_resumen(db, fechas)
        serie_usuarios = resultado["usuarios"]["nuevos_por_dia"]
    except Exception:
        resultado["usuarios"] = None
        serie_usuarios = None

    for clave, tabla in TABLAS_CONTEO.items():
        resultado[clave] = _contar(db, tabla)

    try:
        filas_produccion = _filas(
            db, "produccion_cultivo", "cantidad_frutos"
        )
        resultado["frutos_registrados"] = sum(
            int(fila.get("cantidad_frutos") or 0)
            for fila in filas_produccion
        )
    except Exception:
        resultado["frutos_registrados"] = None

    try:
        nombres = [
            str(fila.get("nombre_comun") or "").strip().lower()
            for fila in _filas(db, "cultivos", "nombre_comun")
        ]
        resultado["cultivos_frecuentes"] = [
            {"nombre": nombre.capitalize(), "total": cantidad}
            for nombre, cantidad in Counter(
                nombre for nombre in nombres if nombre
            ).most_common(5)
        ]
    except Exception:
        resultado["cultivos_frecuentes"] = []

    try:
        categorias = [
            fila.get("categoria")
            for fila in _filas(db, "foro_publicaciones", "categoria")
        ]
        resultado["foro_por_categoria"] = [
            {"categoria": categoria, "total": cantidad}
            for categoria, cantidad in Counter(
                categoria for categoria in categorias if categoria
            ).most_common()
        ]
    except Exception:
        resultado["foro_por_categoria"] = []

    # La app guarda las cosechas en "produccion_cultivo" (App.jsx). La tabla
    # "cosechas" (API /api/cosechas) también se suma por si se usa.
    serie_cosechas = _sumar_series(
        fechas,
        _serie_diaria_tabla(
            db, "produccion_cultivo", fechas, ["created_at", "creado_en"]
        ),
        _serie_diaria_tabla(
            db, "cosechas", fechas, ["creado_en", "created_at"]
        ),
    )

    serie_escaneos = _serie_diaria_tabla(
        db,
        "identificaciones",
        fechas,
        ["creado_en", "created_at", "fecha_creacion", "created_on"],
    )

    resultado["actividad_14_dias"] = {
        "fechas": fechas,
        "usuarios_nuevos": serie_usuarios,
        "cosechas_registradas": serie_cosechas,
        "escaneos": serie_escaneos,
    }

    return resultado


@router.get("/foro")
def listar_foro(_: dict = Depends(admin_requerido)):
    """Lista todas las publicaciones para filtrar y exportar."""
    db = cliente_admin()

    try:
        filas: list[dict] = []
        desplazamiento = 0

        while True:
            lote = (
                db.table("foro_publicaciones")
                .select(
                    "id, autor_nombre, titulo, categoria, contenido, created_at"
                )
                .order("created_at", desc=True)
                .range(desplazamiento, desplazamiento + 999)
                .execute()
                .data
                or []
            )

            filas.extend(lote)

            if len(lote) < 1000:
                break

            desplazamiento += 1000

        return {"publicaciones": filas}

    except Exception as exc:
        raise HTTPException(
            503, "No se pudo leer el foro."
        ) from exc


@router.delete("/foro/{publicacion_id}")
def eliminar_publicacion(
    publicacion_id: UUID,
    _: dict = Depends(admin_requerido),
):
    """Elimina una publicación del foro."""
    db = cliente_admin()

    try:
        borradas = (
            db.table("foro_publicaciones")
            .delete()
            .eq("id", str(publicacion_id))
            .execute()
            .data
            or []
        )
    except Exception as exc:
        raise HTTPException(
            503, "No se pudo eliminar la publicación."
        ) from exc

    if not borradas:
        raise HTTPException(
            404, "La publicación no existe o ya fue eliminada."
        )

    return {"eliminado": True, "id": str(publicacion_id)}
