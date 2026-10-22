
"""Envío de correos de FloraViva mediante Google Apps Script.

FastAPI genera los códigos y tokens. Apps Script únicamente envía los correos.
Nunca registrar el secreto, los códigos OTP ni los enlaces de recuperación.
"""

import secrets
import time
from typing import Any

import httpx

from app.config import obtener_configuracion


ACCIONES_PERMITIDAS = {
    "user_verify",
    "admin_otp",
    "password_reset",
    "user_welcome",
}


class ErrorCorreoAppsScript(RuntimeError):
    """Error controlado al solicitar un envío de correo."""


async def enviar_correo(
    accion: str,
    email: str,
    **datos: Any,
) -> None:
    """Solicita a Apps Script enviar un correo.

    Args:
        accion: Tipo de correo permitido.
        email: Destinatario.
        datos: Campos específicos de la plantilla.
    """
    if accion not in ACCIONES_PERMITIDAS:
        raise ErrorCorreoAppsScript("Tipo de correo no permitido.")

    cfg = obtener_configuracion()
    url = (cfg.google_apps_script_url or "").strip()
    secreto = (cfg.google_apps_script_secret or "").strip()

    if not url or not secreto:
        raise ErrorCorreoAppsScript(
            "Falta configurar el servicio de correo en el backend."
        )

    if not url.startswith("https://script.google.com/macros/s/") or not url.endswith("/exec"):
        raise ErrorCorreoAppsScript(
            "La URL de Google Apps Script no tiene el formato esperado."
        )

    payload = {
        "secret": secreto,
        "timestamp": int(time.time() * 1000),
        "nonce": secrets.token_urlsafe(24),
        "action": accion,
        "email": email.strip().lower(),
        **datos,
    }

    try:
        async with httpx.AsyncClient(
            timeout=20.0,
            follow_redirects=True,
        ) as cliente:
            respuesta = await cliente.post(url, json=payload)
            respuesta.raise_for_status()
            resultado = respuesta.json()

    except (httpx.HTTPError, ValueError) as exc:
        # No incluir payload, secreto, OTP ni URL de recuperación en el error.
        raise ErrorCorreoAppsScript(
            "No se pudo confirmar el envío mediante Google Apps Script."
        ) from exc

    if not isinstance(resultado, dict) or resultado.get("ok") is not True:
        raise ErrorCorreoAppsScript(
            "Google Apps Script rechazó la solicitud de envío."
        )


async def enviar_codigo_verificacion(email: str, codigo: str) -> None:
    """Envía el código de verificación generado por el backend."""
    await enviar_correo(
        "user_verify",
        email,
        code=codigo,
    )


async def enviar_codigo_admin(email: str, codigo: str) -> None:
    """Envía el código de administrador generado por el backend."""
    await enviar_correo(
        "admin_otp",
        email,
        code=codigo,
    )


async def enviar_enlace_recuperacion(email: str, enlace: str) -> None:
    """Envía un enlace de recuperación creado y validado por el backend."""
    await enviar_correo(
        "password_reset",
        email,
        reset_url=enlace,
    )


async def enviar_bienvenida(email: str, nombre: str) -> None:
    """Envía el correo de bienvenida."""
    await enviar_correo(
        "user_welcome",
        email,
        name=nombre,
    )
