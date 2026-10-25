"""Autenticación administrativa con contraseña Supabase + código OTP por correo."""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from supabase import Client

from app.config import obtener_configuracion
from app.core.seguridad import UsuarioActual
from app.core.supabase_client import cliente_admin
from app.dependencias import usuario_actual
from app.services.correo_apps_script import ErrorCorreoAppsScript, enviar_codigo_admin

router = APIRouter(prefix="/api/admin", tags=["Administración"])


class CodigoEntrada(BaseModel):
    codigo: str = Field(pattern=r"^[0-9]{6}$")


class CorreoEntrada(BaseModel):
    email: EmailStr


class CorreoCodigoEntrada(BaseModel):
    email: EmailStr
    codigo: str = Field(pattern=r"^[0-9]{6}$")


def _configuracion_admin():
    cfg = obtener_configuracion()
    if (not _correos_admin(cfg) or not cfg.admin_otp_secret or not cfg.admin_session_secret
            or not cfg.supabase_secret_key):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El acceso administrativo no está configurado en el servidor.",
        )
    return cfg


def _correos_admin(cfg) -> list[str]:
    """Correos autorizados: FLORAVIVA_ADMIN_EMAIL admite varios separados por coma."""
    bruto = (cfg.floraviva_admin_email or "").replace(";", ",")
    return [c.strip().lower() for c in bruto.split(",") if c.strip()]


def _es_admin(email: str | None, cfg) -> bool:
    """True si el correo está en la lista de administradores (comparación segura)."""
    if not email:
        return False
    email = email.strip().lower()
    return any(hmac.compare_digest(email, permitido) for permitido in _correos_admin(cfg))


def _comprobar_admin(usuario: UsuarioActual) -> None:
    cfg = _configuracion_admin()
    if not _es_admin(usuario.email, cfg):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cuenta no autorizada como administradora.")


def _hash_codigo(user_id: str, codigo: str, secreto: str) -> str:
    mensaje = f"{user_id}:{codigo}".encode("utf-8")
    return hmac.new(secreto.encode("utf-8"), mensaje, hashlib.sha256).hexdigest()


def _emitir_token_admin(user: UsuarioActual) -> str:
    cfg = _configuracion_admin()
    ahora = datetime.now(timezone.utc)
    vencimiento = ahora + timedelta(minutes=cfg.admin_session_ttl_minutes)
    return jwt.encode(
        {"sub": user.id, "email": user.email, "role": "admin", "iss": "floraviva-api", "iat": ahora, "exp": vencimiento},
        cfg.admin_session_secret,
        algorithm="HS256",
    )


def verificar_token_admin(token: str) -> dict:
    cfg = _configuracion_admin()
    try:
        claims = jwt.decode(token, cfg.admin_session_secret, algorithms=["HS256"], issuer="floraviva-api")
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Sesión administrativa inválida o vencida.") from exc
    if claims.get("role") != "admin" or not claims.get("sub"):
        raise HTTPException(status_code=403, detail="Se requieren permisos de administrador.")
    if not _es_admin(claims.get("email"), cfg):
        raise HTTPException(status_code=403, detail="La sesión no pertenece a un administrador autorizado.")
    return claims


@router.post("/solicitar-codigo")
async def solicitar_codigo_admin(usuario: UsuarioActual = Depends(usuario_actual)):
    """Envía un OTP de seis dígitos solo a la cuenta administrativa autorizada."""
    _comprobar_admin(usuario)
    cfg = _configuracion_admin()
    db: Client = cliente_admin()
    actual = db.table("admin_login_challenges").select("requested_at, attempts, used_at").eq("user_id", usuario.id).limit(1).execute()
    if actual.data:
        reto = actual.data[0]
        solicitado = datetime.fromisoformat(str(reto["requested_at"]).replace("Z", "+00:00"))
        if (datetime.now(timezone.utc) - solicitado).total_seconds() < 60:
            raise HTTPException(status_code=429, detail="Espera un minuto antes de solicitar otro código.")

    codigo = f"{secrets.randbelow(1_000_000):06d}"
    reto = {
        "user_id": usuario.id,
        "email": usuario.email.strip().lower(),
        "code_hash": _hash_codigo(usuario.id, codigo, cfg.admin_otp_secret),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "attempts": 0,
        "used_at": None,
    }
    try:
        db.table("admin_login_challenges").upsert(reto, on_conflict="user_id").execute()
        await enviar_codigo_admin(usuario.email, codigo)
    except ErrorCorreoAppsScript as exc:
        # Invalida el reto si no se pudo enviar el correo.
        db.table("admin_login_challenges").update({"used_at": datetime.now(timezone.utc).isoformat()}).eq("user_id", usuario.id).execute()
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="No se pudo preparar el código administrativo. Verifica la tabla y la configuración del servidor.") from exc
    return {"mensaje": "Código enviado al correo administrativo autorizado.", "expira_en_segundos": 300}


@router.post("/verificar-codigo")
def verificar_codigo_admin(datos: CodigoEntrada, usuario: UsuarioActual = Depends(usuario_actual)):
    """Consume el OTP de forma atómica; los códigos expirados/reutilizados fallan."""
    _comprobar_admin(usuario)
    cfg = _configuracion_admin()
    try:
        resultado = cliente_admin().rpc(
            "consume_admin_login_code",
            {"p_user_id": usuario.id, "p_code_hash": _hash_codigo(usuario.id, datos.codigo, cfg.admin_otp_secret)},
        ).execute()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="No se pudo verificar el código. Comprueba la migración SQL de administración.") from exc
    filas = resultado.data or []
    if not filas or not filas[0].get("valid"):
        raise HTTPException(status_code=401, detail="Código incorrecto, vencido, reutilizado o con demasiados intentos.")
    return {"token_admin": _emitir_token_admin(usuario), "tipo": "Bearer", "expira_en_minutos": cfg.admin_session_ttl_minutes}


@router.get("/sesion")
def comprobar_sesion_admin(authorization: str | None = Header(default=None, alias="Authorization")):
    """Valida el token administrativo temporal; un token de usuario normal no sirve."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Falta la sesión administrativa.")
    claims = verificar_token_admin(authorization.removeprefix("Bearer ").strip())
    return {"autorizado": True, "email": claims.get("email"), "exp": claims.get("exp")}


# ---------------------------------------------------------------------------
# Acceso administrativo SOLO con correo (sin contraseña).
# El correo autorizado recibe un OTP de 6 dígitos (5 min, 5 intentos, un solo
# uso) y, al validarlo, la API emite el token administrativo temporal.
# ---------------------------------------------------------------------------

MENSAJE_SOLICITUD = "Si el correo está autorizado, enviamos un código. Revisa tu bandeja y el spam."
ERROR_CODIGO = "Código incorrecto, vencido, reutilizado o con demasiados intentos."


def _buscar_usuario_por_correo(db: Client, email: str):
    """Busca el usuario de Supabase Auth por correo (recorre las páginas)."""
    for pagina in range(1, 11):
        usuarios = db.auth.admin.list_users(page=pagina, per_page=200)
        if not usuarios:
            return None
        for u in usuarios:
            if (getattr(u, "email", None) or "").strip().lower() == email:
                return u
        if len(usuarios) < 200:
            return None
    return None


def _usuario_admin(db: Client, email: str, crear: bool):
    """Devuelve el usuario admin; si no existe y crear=True, lo crea ya confirmado."""
    usuario = _buscar_usuario_por_correo(db, email)
    if usuario is not None or not crear:
        return usuario
    creado = db.auth.admin.create_user({
        "email": email,
        "password": secrets.token_urlsafe(32),  # nunca se usa: el acceso es por código
        "email_confirm": True,
        "user_metadata": {"nombre": "Administrador"},
    })
    return getattr(creado, "user", None)


@router.post("/acceso/solicitar")
async def acceso_admin_solicitar(datos: CorreoEntrada):
    """Envía el OTP si el correo es administrador; responde igual para cualquier otro."""
    cfg = _configuracion_admin()
    email = str(datos.email).strip().lower()
    if not _es_admin(email, cfg):
        return {"mensaje": MENSAJE_SOLICITUD, "expira_en_segundos": 300}

    db: Client = cliente_admin()
    try:
        usuario = _usuario_admin(db, email, crear=True)
        if usuario is None:
            raise RuntimeError("No se pudo obtener la cuenta administradora.")
        user_id = str(usuario.id)
        actual = db.table("admin_login_challenges").select("requested_at").eq("user_id", user_id).limit(1).execute()
    except Exception as exc:
        raise HTTPException(503, "No se pudo preparar el acceso administrativo. Verifica la configuración del servidor.") from exc

    if actual.data:
        solicitado = datetime.fromisoformat(str(actual.data[0]["requested_at"]).replace("Z", "+00:00"))
        if (datetime.now(timezone.utc) - solicitado).total_seconds() < 60:
            raise HTTPException(429, "Espera un minuto antes de solicitar otro código.")

    codigo = f"{secrets.randbelow(1_000_000):06d}"
    ahora = datetime.now(timezone.utc)
    reto = {
        "user_id": user_id,
        "email": email,
        "code_hash": _hash_codigo(user_id, codigo, cfg.admin_otp_secret),
        "expires_at": (ahora + timedelta(minutes=5)).isoformat(),
        "requested_at": ahora.isoformat(),
        "attempts": 0,
        "used_at": None,
    }
    try:
        db.table("admin_login_challenges").upsert(reto, on_conflict="user_id").execute()
        await enviar_codigo_admin(email, codigo)
    except ErrorCorreoAppsScript as exc:
        db.table("admin_login_challenges").update({"used_at": ahora.isoformat()}).eq("user_id", user_id).execute()
        raise HTTPException(502, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(503, "No se pudo guardar el código administrativo. Verifica la tabla en Supabase.") from exc
    return {"mensaje": MENSAJE_SOLICITUD, "expira_en_segundos": 300}


@router.post("/acceso/verificar")
def acceso_admin_verificar(datos: CorreoCodigoEntrada):
    """Valida el OTP (un solo uso) y emite el token administrativo temporal."""
    cfg = _configuracion_admin()
    email = str(datos.email).strip().lower()
    if not _es_admin(email, cfg):
        raise HTTPException(401, ERROR_CODIGO)

    db: Client = cliente_admin()
    try:
        usuario = _usuario_admin(db, email, crear=False)
        if usuario is None:
            raise HTTPException(401, ERROR_CODIGO)
        user_id = str(usuario.id)
        resultado = db.rpc(
            "consume_admin_login_code",
            {"p_user_id": user_id, "p_code_hash": _hash_codigo(user_id, datos.codigo, cfg.admin_otp_secret)},
        ).execute()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, "No se pudo verificar el código. Inténtalo de nuevo.") from exc

    filas = resultado.data or []
    if not filas or not filas[0].get("valid"):
        raise HTTPException(401, ERROR_CODIGO)
    token = _emitir_token_admin(UsuarioActual(id=user_id, email=email, token=""))
    return {"token_admin": token, "tipo": "Bearer", "expira_en_minutos": cfg.admin_session_ttl_minutes}
