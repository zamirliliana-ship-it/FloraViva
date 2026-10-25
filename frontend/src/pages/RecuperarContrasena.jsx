/**
 * Pantalla para crear una nueva contraseña.
 *
 * Se abre desde el enlace que Supabase envía al correo (ruta /recuperar).
 * Acepta los dos formatos de enlace de Supabase:
 *   - flujo implícito: tokens en el hash de la URL (#access_token=...)
 *   - flujo PKCE: parámetro ?code=...
 *
 * No usa react-router-dom: el enrutamiento de la app está en main.jsx.
 */
import { useEffect, useState } from "react";
import { Sprout } from "lucide-react";
import { supabase } from "../lib/supabase";
import "./Acceso.css";

function traducirError(error) {
  const texto = (error?.message ?? "").toLowerCase();

  if (texto.includes("same password") || texto.includes("different from the old")) {
    return "La nueva contraseña debe ser distinta de la anterior.";
  }
  if (texto.includes("weak") || texto.includes("at least")) {
    return "La contraseña es muy débil. Usa al menos 8 caracteres.";
  }
  if (texto.includes("expired") || texto.includes("invalid") || texto.includes("code verifier")) {
    return "El enlace no es válido o ya venció. Solicita uno nuevo e ábrelo en el mismo navegador.";
  }
  if (texto.includes("rate limit")) {
    return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  }
  if (texto.includes("fetch")) {
    return "No hay conexión con el servicio de acceso.";
  }
  return error?.message || "No se pudo completar la operación. Inténtalo de nuevo.";
}

export default function RecuperarContrasena() {
  const [nuevaContrasena, setNuevaContrasena] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [sesionValida, setSesionValida] = useState(false);
  const [terminado, setTerminado] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let activo = true;

    async function verificarEnlace() {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

        // Supabase informa los errores del enlace en el hash o en la consulta.
        const errorUrl =
          hash.get("error_description") || url.searchParams.get("error_description");
        if (errorUrl) {
          throw new Error("expired: el enlace de recuperación no es válido o ya venció");
        }

        // Flujo PKCE: se canjea el código por una sesión.
        const code = url.searchParams.get("code");
        if (code) {
          const { error: errorCodigo } = await supabase.auth.exchangeCodeForSession(code);
          if (errorCodigo) throw errorCodigo;
          window.history.replaceState({}, document.title, url.pathname);
        }

        const { data, error: errorSesion } = await supabase.auth.getSession();
        if (errorSesion) throw errorSesion;

        if (activo) setSesionValida(Boolean(data.session));
      } catch (e) {
        if (activo) {
          setSesionValida(false);
          setError(traducirError(e));
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    verificarEnlace();

    // Supabase avisa con PASSWORD_RECOVERY cuando procesa el enlace del correo.
    const { data: escucha } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (!activo) return;
      if (evento === "PASSWORD_RECOVERY" || evento === "SIGNED_IN") {
        setSesionValida(Boolean(sesion));
        if (sesion) {
          setError("");
          setCargando(false);
        }
      }
    });

    return () => {
      activo = false;
      escucha.subscription.unsubscribe();
    };
  }, []);

  async function cambiarContrasena(evento) {
    evento.preventDefault();
    setError("");
    setAviso("");

    if (nuevaContrasena.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (nuevaContrasena !== confirmarContrasena) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setActualizando(true);
    try {
      const { error: errorActualizar } = await supabase.auth.updateUser({
        password: nuevaContrasena,
      });
      if (errorActualizar) throw errorActualizar;

      setNuevaContrasena("");
      setConfirmarContrasena("");
      setAviso("¡Contraseña actualizada! Ya puedes iniciar sesión con la nueva.");
      setTerminado(true);

      // Cierra la sesión temporal de recuperación para que el enlace no se reutilice.
      await supabase.auth.signOut({ scope: "local" });
      setSesionValida(false);
    } catch (e) {
      setError(traducirError(e));
    } finally {
      setActualizando(false);
    }
  }

  return (
    <main className="acceso">
      <section className="acceso-tarjeta">
        <div className="acceso-marca">
          <div className="acceso-icono"><Sprout size={27} /></div>
          <h1>FloraViva</h1>
          <p>Cultiva, identifica y descubre la naturaleza</p>
        </div>

        <h2>Crear nueva contraseña</h2>

        {cargando ? (
          <p className="acceso-descripcion" role="status">
            Verificando el enlace de recuperación…
          </p>
        ) : sesionValida ? (
          <form onSubmit={cambiarContrasena} className="acceso-formulario">
            <label>
              Nueva contraseña
              <input
                type="password"
                value={nuevaContrasena}
                onChange={(e) => setNuevaContrasena(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </label>

            <label>
              Confirmar contraseña
              <input
                type="password"
                value={confirmarContrasena}
                onChange={(e) => setConfirmarContrasena(e.target.value)}
                placeholder="Repite tu contraseña"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </label>

            {error && <p className="acceso-mensaje acceso-error" role="alert">{error}</p>}

            <button className="primary-button acceso-boton" type="submit" disabled={actualizando}>
              {actualizando ? "Actualizando…" : "Cambiar contraseña"}
            </button>
          </form>
        ) : (
          <div className="acceso-formulario">
            {error && <p className="acceso-mensaje acceso-error" role="alert">{error}</p>}
            {aviso && <p className="acceso-mensaje acceso-aviso" role="status">{aviso}</p>}
            {!error && !aviso && (
              <p className="acceso-descripcion">
                Abre el enlace de recuperación más reciente que enviamos a tu correo.
              </p>
            )}
            <a className="primary-button acceso-boton" href="/login" style={{ textAlign: "center", textDecoration: "none" }}>
              {terminado ? "Iniciar sesión" : "Volver a iniciar sesión"}
            </a>
          </div>
        )}

        <p className="acceso-cambio">
          <a href="/">Volver a la página de inicio</a>
        </p>
      </section>
    </main>
  );
}
