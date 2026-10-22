"""Identificación botánica mediante la API oficial de Pl@ntNet."""

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.config import obtener_configuracion
from app.dependencias import usuario_actual
from app.core.seguridad import UsuarioActual

router = APIRouter(prefix="/api/escanner", tags=["Escáner botánico"])
MAX_BYTES = 10 * 1024 * 1024
TIPOS_IMAGEN = {"image/jpeg", "image/png", "image/webp"}
PLANTNET_URL = "https://my-api.plantnet.org/v2/identify/all"


@router.post("/identificar")
async def identificar_planta(
    imagen: UploadFile = File(...),
    organo: str = Form(default="auto"),
    usuario: UsuarioActual = Depends(usuario_actual),
):
    """Recibe una imagen del usuario autenticado y devuelve las especies probables."""
    del usuario  # La sesión es obligatoria aunque el análisis no persista datos.
    configuracion = obtener_configuracion()
    api_key = configuracion.plantnet_api_key
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El escáner aún no está configurado. Añade PLANTNET_API_KEY en backend/.env y reinicia FastAPI.",
        )
    tipo = (imagen.content_type or "").lower()
    if tipo not in TIPOS_IMAGEN:
        raise HTTPException(status_code=415, detail="Usa una imagen JPG, PNG o WEBP.")
    contenido = await imagen.read(MAX_BYTES + 1)
    if not contenido:
        raise HTTPException(status_code=400, detail="La imagen está vacía.")
    if len(contenido) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="La imagen supera el límite de 10 MB.")
    if organo not in {"auto", "leaf", "flower", "fruit", "bark", "habit"}:
        organo = "auto"

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=10.0)) as cliente:
            respuesta = await cliente.post(
                PLANTNET_URL,
                params={"api-key": api_key, "lang": "es", "include-related-images": "false"},
                data={"organs": organo},
                files={"images": (imagen.filename or "planta.jpg", contenido, tipo)},
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="El análisis tardó demasiado. Intenta con otra foto o vuelve a intentarlo.")
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="No se pudo conectar con el servicio de identificación botánica.")

    if respuesta.status_code == 429:
        raise HTTPException(status_code=429, detail="Se alcanzó el límite temporal de análisis. Intenta más tarde.")
    if respuesta.status_code in (401, 403):
        raise HTTPException(status_code=503, detail="La clave de Pl@ntNet no es válida o no tiene acceso al servicio.")
    if respuesta.status_code >= 400:
        detalle = "Pl@ntNet no pudo identificar esta imagen. Prueba con una foto más clara de una sola planta."
        if respuesta.status_code in (400, 413, 415):
            raise HTTPException(status_code=422, detail=detalle)
        raise HTTPException(status_code=502, detail=detalle)

    try:
        datos = respuesta.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="El servicio botánico devolvió una respuesta no válida.")

    resultados = []
    for item in datos.get("results", [])[:5]:
        especie = item.get("species") or {}
        nombres = especie.get("commonNames") or []
        nombre_comun = next((n for n in nombres if isinstance(n, str) and n.strip()), None)
        resultados.append({
            "nombre_cientifico": especie.get("scientificNameWithoutAuthor") or especie.get("scientificName") or "Especie sin clasificar",
            "nombre_comun": nombre_comun,
            "familia": (especie.get("family") or {}).get("scientificNameWithoutAuthor") or (especie.get("family") or {}).get("scientificName"),
            "confianza": round(float(item.get("score") or 0) * 100, 1),
        })
    return {"proveedor": "Pl@ntNet", "identificada": bool(resultados), "resultados": resultados, "mensaje": None if resultados else "No se encontraron coincidencias claras. Prueba con una foto más nítida."}
