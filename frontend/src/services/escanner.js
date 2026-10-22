import { supabase } from "../lib/supabase";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export async function identificarPlanta(imagen, organo = "auto") {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error("No se pudo verificar tu sesión. Inicia sesión nuevamente.");
  const token = data.session?.access_token;
  if (!token) throw new Error("Tu sesión no está activa. Inicia sesión para usar el escáner.");

  const formulario = new FormData();
  formulario.append("imagen", imagen);
  formulario.append("organo", organo);
  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}/api/escanner/identificar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      body: formulario,
    });
  } catch {
    throw new Error("No se pudo conectar con FloraViva API. Comprueba que FastAPI esté encendido.");
  }
  const json = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    let detalle = json?.detail;
    if (Array.isArray(detalle)) detalle = detalle.map((item) => item.msg).join(". ");
    throw new Error(typeof detalle === "string" ? detalle : "No se pudo analizar la imagen.");
  }
  return json;
}
