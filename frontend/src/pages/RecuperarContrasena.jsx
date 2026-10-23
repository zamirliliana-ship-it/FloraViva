
import { useEffect, useState } from "react";
import { Sprout } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import "./Acceso.css";

export default function RecuperarContrasena() {
  const { actualizarContrasena } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [enlaceValido, setEnlaceValido] = useState(false);
  const [completado, setCompletado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((evento, session) => {
      if (evento === "PASSWORD_RECOVERY" && session) {
        setEnlaceValido(true);
      }
    });

    if (window.location.hash.includes("type=recovery")) {
      setEnlaceValido(true);
    }

    return () => listener.subscription.unsubscribe();
  }, []);

  async function guardar(evento) {
    evento.preventDefault();
    setError("");
    setAviso("");

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setEnviando(true);
    try {
      await actualizarContrasena(password);

      const { error: errorSalida } = await supabase.auth.signOut({ scope: "local" });
      if (errorSalida) throw errorSalida;

      setCompletado(true);
      setAviso("Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.");
      window.history.replaceState({}, "", "/recuperar");
    } catch (fallo) {
      const texto = (fallo?.message ?? "").toLowerCase();

      if (texto.includes("session") || texto.includes("token") || texto.includes("expired")) {
        setError("El enlace venció o ya fue utilizado. Solicita uno nuevo desde Iniciar sesión.");
      } else {
        setError(fallo?.message || "No se pudo actualizar la contraseña. Solicita un enlace nuevo.");
      }
    } finally {
      setEnviando(false);
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

        <h2>{completado ? "Contraseña actualizada" : "Crear nueva contraseña"}</h2>

        {completado ? (
          <>
            <p className="acceso-mensaje acceso-aviso" role="status">{aviso}</p>
            <p className="acceso-cambio"><a href="/login">Volver a iniciar sesión</a></p>
          </>
        ) : enlaceValido ? (
          <form onSubmit={guardar} className="acceso-formulario">
            <p className="acceso-descripcion">
              Elige una contraseña nueva para tu cuenta de FloraViva.
            </p>

            <label>
              Nueva contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </label>

            <label>
              Confirmar contraseña
              <input
                type="password"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                autoComplete="new-password"
                placeholder="Repite la contraseña"
                minLength={6}
                required
              />
            </label>

            {error && <p className="acceso-mensaje acceso-error" role="alert">{error}</p>}

            <button className="primary-button acceso-boton" type="submit" disabled={enviando}>
              {enviando ? "Guardando…" : "Guardar nueva contraseña"}
            </button>
          </form>
        ) : (
          <>
            <p className="acceso-mensaje acceso-aviso" role="status">
              Abre el enlace de recuperación más reciente que enviamos a tu correo. Si no tienes uno, solicita otro desde el inicio de sesión.
            </p>
            <p className="acceso-cambio"><a href="/login">Volver a iniciar sesión</a></p>
          </>
        )}

        <p className="acceso-admin-enlace"><a href="/">Volver a la página de inicio</a></p>
      </section>
    </main>
  );
}
