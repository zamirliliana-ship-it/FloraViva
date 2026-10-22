"""Registro y verificación de correo mediante OTP enviado por Apps Script."""
from __future__ import annotations
import hashlib, hmac, secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from app.config import obtener_configuracion
from app.core.supabase_client import cliente_admin
from app.services.correo_apps_script import ErrorCorreoAppsScript, enviar_codigo_verificacion

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])

class RegistroEntrada(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)

class VerificarEntrada(BaseModel):
    email: EmailStr
    codigo: str = Field(pattern=r"^[0-9]{6}$")

def _hash(email: str, codigo: str, secret: str) -> str:
    return hmac.new(secret.encode(), f"{email.lower()}:{codigo}".encode(), hashlib.sha256).hexdigest()

def _config():
    cfg = obtener_configuracion()
    if not cfg.supabase_secret_key or not cfg.user_email_otp_secret or not cfg.google_apps_script_url or not cfg.google_apps_script_secret:
        raise HTTPException(503, "El registro por correo no está configurado en el servidor.")
    return cfg

@router.post("/registro", status_code=202)
async def registrar(datos: RegistroEntrada):
    cfg = _config()
    email = str(datos.email).strip().lower()
    db = cliente_admin()
    codigo = f"{secrets.randbelow(1_000_000):06d}"
    ahora = datetime.now(timezone.utc)
    try:
        # Crear la cuenta sin confirmar; no se permite iniciar sesión hasta verificar el código.
        creado = db.auth.admin.create_user({"email": email, "password": datos.password, "email_confirm": False, "user_metadata": {"nombre": datos.nombre.strip()}})
        usuario = getattr(creado, "user", None)
        if usuario is None:
            raise RuntimeError("Supabase no devolvió el usuario creado.")
        db.table("user_email_challenges").upsert({"email": email, "user_id": str(usuario.id), "code_hash": _hash(email,codigo,cfg.user_email_otp_secret), "expires_at": (ahora+timedelta(minutes=10)).isoformat(), "requested_at": ahora.isoformat(), "attempts": 0, "used_at": None}, on_conflict="email").execute()
        await enviar_codigo_verificacion(email, codigo)
    except ErrorCorreoAppsScript as exc:
        # La cuenta queda sin confirmar; no se revela ningún secreto al cliente.
        raise HTTPException(502, "La cuenta se creó, pero no se pudo enviar el código. Contacta al administrador antes de volver a registrarte.") from exc
    except Exception as exc:
        texto = str(exc).lower()
        if "already registered" in texto or "already been registered" in texto or "already exists" in texto:
            raise HTTPException(409, "Ya existe una cuenta con ese correo. Si no la confirmaste, contacta al administrador para reenviar el código.") from exc
        raise HTTPException(503, "No se pudo crear la cuenta. Comprueba la configuración de Supabase y la migración SQL.") from exc
    return {"mensaje": "Código enviado. Revisa tu correo y confirma la cuenta en los próximos 10 minutos.", "requiere_confirmacion": True}

@router.post("/verificar")
def verificar(datos: VerificarEntrada):
    cfg = _config()
    email = str(datos.email).strip().lower()
    db = cliente_admin()
    try:
        respuesta = db.table("user_email_challenges").select("user_id,code_hash,expires_at,attempts,used_at").eq("email", email).limit(1).execute()
        if not respuesta.data:
            raise HTTPException(400, "Código incorrecto o vencido.")
        reto = respuesta.data[0]
        ahora = datetime.now(timezone.utc)
        vence = datetime.fromisoformat(str(reto["expires_at"]).replace("Z", "+00:00"))
        intentos = int(reto.get("attempts") or 0)
        valido = (reto.get("used_at") is None and vence > ahora and intentos < 5 and hmac.compare_digest(str(reto["code_hash"]), _hash(email, datos.codigo, cfg.user_email_otp_secret)))
        db.table("user_email_challenges").update({"attempts": intentos + 1, "used_at": ahora.isoformat() if valido else reto.get("used_at")}).eq("email", email).execute()
        if not valido:
            raise HTTPException(400, "Código incorrecto, vencido o con demasiados intentos.")
        db.auth.admin.update_user_by_id(str(reto["user_id"]), {"email_confirm": True})
        return {"mensaje": "Correo confirmado. Ya puedes iniciar sesión."}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, "No se pudo confirmar el correo. Inténtalo más tarde.") from exc
