/** Acceso administrativo: el backend controla la autorización y el OTP. */
import { api } from "../lib/api";

/** Paso 1: el correo autorizado recibe un código de un solo uso. */
export function solicitarCodigoAdminPorCorreo(email) {
  return api("/api/admin/acceso/solicitar", { metodo: "POST", cuerpo: { email } });
}

/** Paso 2: valida el código y devuelve el token administrativo temporal. */
export function verificarCodigoAdminPorCorreo(email, codigo) {
  return api("/api/admin/acceso/verificar", { metodo: "POST", cuerpo: { email, codigo } });
}

// Flujo anterior (contraseña + código). Se conserva por compatibilidad.
export function solicitarCodigoAdmin() {
  return api("/api/admin/solicitar-codigo", { metodo: "POST" });
}

export function verificarCodigoAdmin(codigo) {
  return api("/api/admin/verificar-codigo", { metodo: "POST", cuerpo: { codigo } });
}
