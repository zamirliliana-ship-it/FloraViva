/** Acceso administrativo: el backend controla la autorización y el OTP. */
import { api } from "../lib/api";

export function solicitarCodigoAdmin() {
  return api("/api/admin/solicitar-codigo", { metodo: "POST" });
}

export function verificarCodigoAdmin(codigo) {
  return api("/api/admin/verificar-codigo", {
    metodo: "POST",
    cuerpo: { codigo },
  });
}
