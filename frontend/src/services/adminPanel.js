/** Llamadas del panel administrativo. Todas exigen el token administrativo temporal. */
import { api } from "../lib/api";

export function obtenerMetricas(token) {
  return api("/api/admin/panel/metricas", { tokenAutorizacion: token });
}

export function listarForo(token) {
  return api("/api/admin/panel/foro", { tokenAutorizacion: token });
}

export function eliminarPublicacion(token, id) {
  return api(`/api/admin/panel/foro/${id}`, { metodo: "DELETE", tokenAutorizacion: token });
}
