"""
Configuración central del backend de FloraViva.

Lee las variables de entorno (archivo backend/.env) una sola vez y las
expone como un objeto tipado. Ningún otro archivo debe leer os.environ
directamente: todos piden la configuración con obtener_configuracion().

Variables:
    SUPABASE_URL         URL del proyecto de Supabase (obligatoria).
    SUPABASE_KEY         Clave "publishable" (obligatoria). Respeta el RLS.
    SUPABASE_SECRET_KEY  Clave secreta (opcional). Solo para tareas del
                         servidor, como llenar el catálogo botánico.
    PLANTNET_API_KEY     Clave privada de Pl@ntNet para el escáner botánico.
    FRONTEND_ORIGINS     Orígenes permitidos por CORS, separados por coma.

Nota: el archivo .env se busca en la carpeta desde donde se ejecuta
uvicorn, por eso el servidor debe iniciarse desde backend/.
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Configuracion(BaseSettings):
    """Valores de configuración validados al iniciar el servidor."""

    supabase_url: str
    supabase_key: str
    supabase_secret_key: str | None = None
    plantnet_api_key: str | None = None
    floraviva_admin_email: str | None = None
    admin_otp_secret: str | None = None
    admin_session_secret: str | None = None
    admin_session_ttl_minutes: int = Field(default=30, ge=5, le=120)
    frontend_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    google_apps_script_url: str | None = None
    google_apps_script_secret: str | None = None
    user_email_otp_secret: str | None = None
    floraviva_app_url: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8-sig",  # tolera archivos guardados con BOM
        extra="ignore",
    )

    @property
    def origenes_permitidos(self) -> list[str]:
        """Lista de orígenes CORS a partir del texto separado por comas."""
        return [o.strip() for o in self.frontend_origins.split(",") if o.strip()]


@lru_cache
def obtener_configuracion() -> Configuracion:
    """Devuelve la configuración (se crea una sola vez y se reutiliza)."""
    return Configuracion()
