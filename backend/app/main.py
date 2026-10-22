"""
Punto de entrada del backend de FloraViva (FastAPI).

Ejecutar desde la carpeta backend/ (con el entorno virtual activo):
    uvicorn app.main:app --reload

Documentación interactiva de la API:  http://127.0.0.1:8000/docs
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError

from app.config import obtener_configuracion
from app.routers import admin, autenticacion, cosechas, cultivos, estadisticas, plantas, escanner

# Se lee al iniciar: si falta algo en el .env, el servidor falla enseguida
# con un mensaje claro en lugar de fallar en la primera petición.
configuracion = obtener_configuracion()

app = FastAPI(
    title="FloraViva API",
    description="API para gestionar cultivos, plantas y cosechas.",
    version="0.2.0",
)

# CORS: permite que el frontend (otro puerto) llame a esta API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=configuracion.origenes_permitidos,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rutas de la aplicación
app.include_router(cultivos.router)
app.include_router(plantas.router)
app.include_router(cosechas.router)
app.include_router(estadisticas.router)
app.include_router(admin.router)
app.include_router(autenticacion.router)
app.include_router(escanner.router)


# Traduce los errores de la base de datos a mensajes comprensibles, sin
# exponer detalles internos del esquema.
_MENSAJES_POSTGRES = {
    "23503": ("La referencia no existe o no te pertenece", 400),  # clave foránea
    "23505": ("Ya existe un registro igual", 409),                # duplicado
    "23514": ("Los datos no cumplen las reglas de validación", 400),
    "23502": ("Falta un dato obligatorio", 400),
}


@app.exception_handler(APIError)
async def manejar_error_de_base_de_datos(_: Request, error: APIError):
    codigo = str(getattr(error, "code", "") or "")
    mensaje, estado = _MENSAJES_POSTGRES.get(
        codigo, ("No se pudo completar la operación", 400)
    )
    return JSONResponse(status_code=estado, content={"detail": mensaje, "codigo": codigo})


@app.get("/", tags=["Inicio"])
def inicio():
    """Comprueba que el backend está encendido."""
    return {"proyecto": "FloraViva", "mensaje": "Backend funcionando correctamente"}


@app.get("/api/health", tags=["Salud"])
def health():
    """Estado del servicio (útil para monitoreo)."""
    return {"estado": "correcto", "servicio": "FloraViva API"}
