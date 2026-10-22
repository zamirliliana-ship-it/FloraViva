/** Cliente centralizado para las peticiones al backend FastAPI. */
import { supabase } from "./supabase";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export class ErrorApi extends Error {
  constructor(mensaje, estado = 0) {
    super(mensaje);
    this.name = "ErrorApi";
    this.estado = estado;
  }
}

export async function api(ruta, { metodo = "GET", cuerpo, tokenAutorizacion } = {}) {
  const { data: sesionData, error: sesionError } = await supabase.auth.getSession();
  if (sesionError) throw new ErrorApi("No se pudo leer la sesión. Inicia sesión de nuevo.");
  const token = sesionData.session?.access_token;

  const headers = { Accept: "application/json" };
  if (cuerpo !== undefined) headers["Content-Type"] = "application/json";
  const tokenFinal = tokenAutorizacion || token;
  if (tokenFinal) headers.Authorization = `Bearer ${tokenFinal}`;

  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi("No se pudo conectar con FloraViva API. Comprueba que FastAPI esté encendido.");
  }

  if (respuesta.status === 204) return null;
  const json = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    let detalle = json?.detail;
    if (Array.isArray(detalle)) detalle = detalle.map((item) => item.msg).join(". ");
    if (respuesta.status === 401) detalle = "Tu sesión venció. Inicia sesión de nuevo.";
    throw new ErrorApi(typeof detalle === "string" ? detalle : "La petición no pudo completarse.", respuesta.status);
  }
  return json;
}
