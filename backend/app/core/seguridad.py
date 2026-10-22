"""
Verificación de la sesión del usuario.

El frontend inicia sesión con Supabase y envía el token en cada petición:
    Authorization: Bearer <token>

Aquí se comprueba con Supabase que el token sea válido y de quién es.
Es una consulta de red por petición: suficiente para el MVP. Si más
adelante hace falta velocidad, se puede validar la firma del JWT en local.
"""

from dataclasses import dataclass

from app.core.supabase_client import cliente_publico


class TokenInvalido(Exception):
    """El token no existe, expiró o no fue emitido por este proyecto."""


@dataclass(frozen=True)
class UsuarioActual:
    """Datos mínimos del usuario autenticado."""

    id: str
    email: str | None
    token: str


def verificar_token(token: str) -> UsuarioActual:
    """
    Valida el token con Supabase Auth.

    Raises:
        TokenInvalido: si el token no es válido.
    """
    try:
        respuesta = cliente_publico().auth.get_user(token)
    except Exception as error:  # Supabase lanza distintos tipos de error
        raise TokenInvalido("Token no válido") from error

    usuario = getattr(respuesta, "user", None)
    if usuario is None:
        raise TokenInvalido("Token no válido")

    return UsuarioActual(id=str(usuario.id), email=usuario.email, token=token)
