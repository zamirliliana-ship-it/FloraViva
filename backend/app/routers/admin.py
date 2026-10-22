"""Autenticación administrativa con contraseña Supabase + código OTP por correo."""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client

from app.config import obtener_configuracion
from app.core.seguridad import UsuarioActual
from app.core.supabase_client import cliente_admin
from app.dependencias import usuario_actual
from app.services.correo_apps_script import ErrorCorreoAppsScript, enviar_codigo_admin

router = APIRouter(prefix="/api/admin", tags=["Administración"])


class CodigoEntrada(BaseModel):
    codigo: str = Field(pattern=r"^[0-9]{6}$")


def _configuracion_admin():
    cfg = obtener_configuracion()
    if (not cfg.floraviva_admin_email or not cfg.admin_otp_secret or not cfg.admin_session_secret
            or not cfg.supabase_secret_key):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El acceso administrativo no está configurado en el servidor.",
        )
    return cfg


def _comprobar_admin(usuario: UsuarioActual) -> None:
    cfg = _configuracion_admin()
    if not usuario.email or not hmac.compare_digest(
        usuario.email.strip().lower(), cfg.floraviva_admin_email.strip().lower()
    ):
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
    if (claims.get("email") or "").strip().lower() != cfg.floraviva_admin_email.strip().lower():
        raise HTTPException(status_code=403, detail="La sesión no pertenece al administrador autorizado.")
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
