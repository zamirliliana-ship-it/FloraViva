"""
Dependencias reutilizables de FastAPI.

Se usan en las rutas con Depends(...):

    usuario_actual   Exige sesión y devuelve quién es el usuario.
    base_de_datos    Cliente de Supabase que actúa como ese usuario.

Ejemplo:
    @router.get("")
    def listar(db: Client = Depends(base_de_datos)):
        return db.table("cultivos").select("*").execute().data
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client

from app.core.seguridad import TokenInvalido, UsuarioActual, verificar_token
from app.core.supabase_client import cliente_de_usuario

_esquema_bearer = HTTPBearer(auto_error=False)


def usuario_actual(
    credenciales: HTTPAuthorizationCredentials | None = Depends(_esquema_bearer),
) -> UsuarioActual:
    """Devuelve el usuario de la sesión o responde 401 si no hay sesión válida."""
    if credenciales is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta el token de sesión",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return verificar_token(credenciales.credentials)
    except TokenInvalido:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión no válida o expirada",
            headers={"WWW-Authenticate": "Bearer"},
        )


def base_de_datos(usuario: UsuarioActual = Depends(usuario_actual)) -> Client:
    """Cliente de Supabase con los permisos (RLS) del usuario de la sesión."""
    return cliente_de_usuario(usuario.token)
