
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function RecuperarContrasena() {
  const navigate = useNavigate();

  const [nuevaContrasena, setNuevaContrasena] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [sesionValida, setSesionValida] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("info");

  useEffect(() => {
    let activo = true;

    async function verificarSesionRecuperacion() {
      try {
        // Supabase puede enviar el token en el hash de la URL
        // o utilizar PKCE mediante un parámetro code.
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(
          url.hash.replace(/^#/, "")
        );

        const errorUrl =
          hash.get("error_description") ||
          url.searchParams.get("error_description");

        if (errorUrl) {
          throw new Error(
            "El enlace de recuperación no es válido o ha expirado."
          );
        }

        const code = url.searchParams.get("code");

        if (code) {
          const { error } =
            await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }

          // Evita procesar el mismo código otra vez.
          window.history.replaceState(
            {},
            document.title,
            url.pathname
          );
        }

        const { data, error } =
          await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (activo) {
          setSesionValida(Boolean(data.session));
        }
      } catch (error) {
        if (activo) {
          setSesionValida(false);
          setMensaje(
            error.message ||
              "No se pudo validar el enlace de recuperación."
          );
          setTipoMensaje("error");
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    verificarSesionRecuperacion();

    // También escucha cuando Supabase establece la sesión
    // de recuperación mediante el enlace enviado al correo.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (evento, sesion) => {
        if (!activo) return;

        if (
          evento === "PASSWORD_RECOVERY" ||
          evento === "SIGNED_IN"
        ) {
          setSesionValida(Boolean(sesion));
        }
      }
    );

    return () => {
      activo = false;
      subscription.unsubscribe();
    };
  }, []);

  async function cambiarContrasena(evento) {
    evento.preventDefault();

    setMensaje("");
    setTipoMensaje("info");

    if (nuevaContrasena.length < 8) {
      setMensaje(
        "La contraseña debe tener al menos 8 caracteres."
      );
      setTipoMensaje("error");
      return;
    }

    if (nuevaContrasena !== confirmarContrasena) {
      setMensaje("Las contraseñas no coinciden.");
      setTipoMensaje("error");
      return;
    }

    setActualizando(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: nuevaContrasena,
      });

      if (error) {
        throw error;
      }

      setMensaje(
        "¡Contraseña actualizada correctamente! Ya puedes iniciar sesión."
      );
      setTipoMensaje("success");

      setNuevaContrasena("");
      setConfirmarContrasena("");

      // Cierra la sesión de recuperación para evitar
      // que se vuelva a utilizar el mismo enlace.
      await supabase.auth.signOut({ scope: "local" });

      setSesionValida(false);
    } catch (error) {
      setMensaje(
        error.message ||
          "No se pudo actualizar la contraseña. Solicita un nuevo enlace."
      );
      setTipoMensaje("error");
    } finally {
      setActualizando(false);
    }
  }

  if (cargando) {
    return (
      <div className="recuperar-contenedor">
        <div className="recuperar-tarjeta">
          <h2>FloraViva</h2>
          <p>Verificando enlace de recuperación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="recuperar-contenedor">
      <div className="recuperar-tarjeta">
        <div className="recuperar-logo">
          <span>🌱</span>
        </div>

        <h1>FloraViva</h1>
        <p className="recuperar-subtitulo">
          Cultiva, identifica y descubre la naturaleza
        </p>

        <h2>Crear nueva contraseña</h2>

        {mensaje && (
          <div
            className={`recuperar-mensaje ${tipoMensaje}`}
            role="alert"
          >
            {mensaje}
          </div>
        )}

        {sesionValida ? (
          <form onSubmit={cambiarContrasena}>
            <div className="recuperar-campo">
              <label htmlFor="nuevaContrasena">
                Nueva contraseña
              </label>

              <input
                id="nuevaContrasena"
                type="password"
                value={nuevaContrasena}
                onChange={(e) =>
                  setNuevaContrasena(e.target.value)
                }
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="recuperar-campo">
              <label htmlFor="confirmarContrasena">
                Confirmar contraseña
              </label>

              <input
                id="confirmarContrasena"
                type="password"
                value={confirmarContrasena}
                onChange={(e) =>
                  setConfirmarContrasena(e.target.value)
                }
                placeholder="Repite tu contraseña"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={actualizando}
              className="recuperar-boton"
            >
              {actualizando
                ? "Actualizando..."
                : "Cambiar contraseña"}
            </button>
          </form>
        ) : (
          <div>
            {!mensaje && (
              <div className="recuperar-mensaje info">
                Abre el enlace de recuperación más reciente
                que enviamos a tu correo.
              </div>
            )}

            <button
              type="button"
              className="recuperar-boton"
              onClick={() => navigate("/login")}
            >
              Volver a iniciar sesión
            </button>
          </div>
        )}

        <a href="/login" className="recuperar-enlace">
          Volver a iniciar sesión
        </a>

        <a href="/" className="recuperar-enlace">
          Volver a la página de inicio
        </a>
      </div>
    </div>
  );
}
