/** Operaciones de cultivos: todas pasan por el backend FastAPI. */
import { api } from "../lib/api";

export function listarCultivos() {
  return api("/api/cultivos");
}

export function crearCultivo(datos) {
  return api("/api/cultivos", { metodo: "POST", cuerpo: datos });
}
