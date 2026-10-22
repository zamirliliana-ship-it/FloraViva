"""
Fábrica de clientes de Supabase.

Hay tres tipos de cliente, según quién hace la consulta:

    cliente_publico()      Sin sesión. Solo para verificar tokens.
    cliente_de_usuario()   Actúa COMO el usuario: la base aplica el RLS y
                           cada persona ve únicamente sus propios datos.
                           Es el que usan casi todas las rutas.
    cliente_admin()        Usa la clave secreta y se salta el RLS. Solo para
                           tareas del servidor (catálogo botánico). Nunca
                           debe usarse con datos que lleguen sin validar.
"""

from supabase import Client, create_client

from app.config import obtener_configuracion


def cliente_publico() -> Client:
    """Cliente con la clave publishable y sin sesión de usuario."""
    cfg = obtener_configuracion()
    return create_client(cfg.supabase_url, cfg.supabase_key)


def cliente_de_usuario(token: str) -> Client:
    """
    Cliente que envía el token del usuario a la base de datos.

    Args:
        token: JWT de la sesión, ya validado por core.seguridad.
    """
    cliente = cliente_publico()
    cliente.postgrest.auth(token)
    return cliente


def cliente_admin() -> Client:
    """Cliente con la clave secreta (ignora el RLS). Uso restringido."""
    cfg = obtener_configuracion()
    if not cfg.supabase_secret_key:
        raise RuntimeError("Falta SUPABASE_SECRET_KEY en el archivo .env")
    return create_client(cfg.supabase_url, cfg.supabase_secret_key)