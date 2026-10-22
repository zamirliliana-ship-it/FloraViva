/** Pantalla de inicio de sesión y registro de FloraViva. */
import { useState } from "react";
import { Sprout } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./Acceso.css";

function mensajeError(error) {
  const texto = (error?.message ?? "").toLowerCase();
  if (texto.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (texto.includes("email not confirmed")) return "Confirma tu correo desde el mensaje que te enviamos.";
  if (texto.includes("already registered")) return "Ya existe una cuenta con ese correo.";
  if (texto.includes("password") && (texto.includes("characters") || texto.includes("length"))) return "La contraseña debe tener al menos 6 caracteres.";
  if (texto.includes("rate limit")) return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  if (texto.includes("fetch")) return "No hay conexión con el servicio de acceso. Revisa la URL y la clave pública de Supabase.";
  return error?.message || "No se pudo completar la operación. Inténtalo de nuevo.";
}

export default function Acceso({ initialMode = "entrar" }) {
  const { iniciarSesion, registrar, verificarCorreo } = useAuth();
  const [modo, setModo] = useState(initialMode);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [esperandoCodigo, setEsperandoCodigo] = useState(false);
  const [codigo, setCodigo] = useState("");
  const esRegistro = modo === "registro";

  function cambiarModo() {
    setModo(esRegistro ? "entrar" : "registro");
    setError("");
    setAviso("");
    setEsperandoCodigo(false);
    setCodigo("");
  }

  async function enviar(evento) {
    evento.preventDefault();
    setError("");
    setAviso("");
    setEnviando(true);
    try {
      if (esperandoCodigo) {
        const resultado = await verificarCorreo({ email: email.trim(), codigo: codigo.trim() });
        setAviso(resultado.mensaje || "Correo confirmado. Ya puedes iniciar sesión.");
        setEsperandoCodigo(false);
        setModo("entrar");
        setPassword("");
        setCodigo("");
      } else if (esRegistro) {
        const resultado = await registrar({ nombre: nombre.trim(), email: email.trim(), password });
        setAviso(resultado.mensaje || "Te enviamos un código de confirmación.");
        setEsperandoCodigo(true);
        setPassword("");
      } else {
        await iniciarSesion(email.trim(), password);
      }
    } catch (fallo) {
      setError(mensajeError(fallo));
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
        <h2>{esRegistro ? "Crea tu cuenta" : "Bienvenido de nuevo"}</h2>
        <form onSubmit={enviar} className="acceso-formulario">
          {!esperandoCodigo && esRegistro && <label>Nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" autoComplete="name" maxLength={100} required />
          </label>}
          <label>Correo electrónico
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" required readOnly={esperandoCodigo} />
          </label>
          {esperandoCodigo ? <label>Código de confirmación
            <input inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Código de 6 dígitos" pattern="[0-9]{6}" minLength={6} maxLength={6} required />
          </label> : <label>Contraseña
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete={esRegistro ? "new-password" : "current-password"} minLength={6} required />
          </label>}
          {error && <p className="acceso-mensaje acceso-error" role="alert">{error}</p>}
          {aviso && <p className="acceso-mensaje acceso-aviso" role="status">{aviso}</p>}
          <button className="primary-button acceso-boton" type="submit" disabled={enviando}>
            {enviando ? "Un momento…" : esperandoCodigo ? "Confirmar correo" : esRegistro ? "Crear cuenta" : "Iniciar sesión"}
          </button>
        </form>
        {!esperandoCodigo && <p className="acceso-cambio">
          {esRegistro ? "¿Ya tienes cuenta?" : "¿Aún no tienes cuenta?"}{" "}
          <button type="button" onClick={cambiarModo}>{esRegistro ? "Inicia sesión" : "Regístrate"}</button>
        </p>}
        {esperandoCodigo && <p className="acceso-cambio"><button type="button" onClick={() => { setEsperandoCodigo(false); setModo("registro"); setAviso(""); setError(""); }}>Volver al registro</button></p>}
        <p className="acceso-admin-enlace">
          <a href="/">Volver a la página de inicio</a>
          <span aria-hidden="true"> · </span>
          <a href="/admin">Acceso de administrador</a>
        </p>
      </section>
    </main>
  );
}
