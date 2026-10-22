"""Ayudas para trabajar con las respuestas de Supabase en las rutas."""

from fastapi import HTTPException, status


def primero_o_404(respuesta, mensaje: str) -> dict:
    """
    Devuelve la primera fila de una respuesta de Supabase.

    Si no hay filas (no existe, o pertenece a otro usuario y el RLS la
    oculta) responde 404 con el mensaje indicado.
    """
    if not respuesta.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=mensaje)
    return respuesta.data[0]
