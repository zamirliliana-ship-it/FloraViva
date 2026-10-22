import { useState } from "react";
import { ArrowLeft, LockKeyhole, MailCheck, ShieldCheck, Sprout } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { solicitarCodigoAdmin, verificarCodigoAdmin } from "../services/admin";
import "./Acceso.css";
import "./AccesoAdmin.css";

function textoError(error) {
  const mensaje = (error?.message || "").toLowerCase();
  if (mensaje.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (mensaje.includes("email not confirmed")) return "Primero confirma tu correo en Supabase.";
  if (mensaje.includes("no autorizado") || mensaje.includes("no autorizada")) return "Esta cuenta no está autorizada como administradora.";
  if (mensaje.includes("smtp") || mensaje.includes("correo de verificación")) return "No se pudo enviar el código. Revisa la configuración SMTP del backend.";
  if (mensaje.includes("demasiadas solicitudes") || mensaje.includes("rate limit")) return "Espera un minuto antes de solicitar otro código.";
  if (mensaje.includes("código") && (mensaje.includes("incorrecto") || mensaje.includes("expiró"))) return error.message;
  return error?.message || "No se pudo completar el acceso administrativo.";
}

export default function AccesoAdmin() {
  const { iniciarSesion, cerrarSesion } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [paso, setPaso] = useState("credenciales");
  const [tokenAdmin, setTokenAdmin] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  async function enviarCredenciales(evento) {
    evento.preventDefault();
    setError("");
    setAviso("");
    setEnviando(true);
    try {
      await iniciarSesion(email.trim(), password);
      await solicitarCodigoAdmin();
      setPaso("codigo");
      setAviso("Enviamos un código de seguridad a tu correo autorizado. Revisa también la carpeta de spam.");
    } catch (fallo) {
      // Si no se completa el primer paso, no dejamos una sesión parcial abierta.
      try { await cerrarSesion(); } catch { /* El error principal se muestra abajo. */ }
      setError(textoError(fallo));
    } finally {
      setEnviando(false);
    }
  }

  async function enviarCodigo(evento) {
    evento.preventDefault();
    setError("");
    setAviso("");
    setEnviando(true);
    try {
      const resultado = await verificarCodigoAdmin(codigo.trim());
      setTokenAdmin(resultado.token_admin);
      setPaso("autorizado");
      setAviso("Verificación completada correctamente.");
    } catch (fallo) {
      setError(textoError(fallo));
    } finally {
      setEnviando(false);
    }
  }

  async function salir() {
    setTokenAdmin("");
    try { await cerrarSesion(); } finally { window.location.href = "/"; }
  }

  return (
    <main className="acceso">
      <section className="acceso-tarjeta admin-tarjeta">
        <a className="admin-volver" href="/"><ArrowLeft size={16} /> Volver a FloraViva</a>
        <div className="acceso-marca">
          <div className="acceso-icono"><Sprout size={27} /></div>
          <h1>FloraViva</h1>
          <p>Área administrativa protegida</p>
        </div>

        {paso === "credenciales" && <>
          <div className="admin-titulo-icono"><LockKeyhole size={20} /></div>
          <h2>Acceso de administrador</h2>
          <p className="admin-descripcion">Primero verifica tu contraseña. Después te enviaremos un código de un solo uso al correo autorizado.</p>
          <form onSubmit={enviarCredenciales} className="acceso-formulario">
            <label>Correo autorizado
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="Correo de administrador" required />
            </label>
            <label>Contraseña
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" minLength={6} required />
            </label>
            {error && <p className="acceso-mensaje acceso-error" role="alert">{error}</p>}
            {aviso && <p className="acceso-mensaje acceso-aviso" role="status">{aviso}</p>}
            <button className="primary-button acceso-boton" type="submit" disabled={enviando}>{enviando ? "Verificando…" : "Verificar contraseña"}</button>
          </form>
        </>}

        {paso === "codigo" && <>
          <div className="admin-titulo-icono"><MailCheck size={21} /></div>
          <h2>Verifica tu correo</h2>
          <p className="admin-descripcion">Introduce el código de seis dígitos que enviamos a tu dirección autorizada. Caduca en cinco minutos.</p>
          <form onSubmit={enviarCodigo} className="acceso-formulario">
            <label>Código de verificación
              <input className="admin-codigo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required />
            </label>
            {error && <p className="acceso-mensaje acceso-error" role="alert">{error}</p>}
            {aviso && <p className="acceso-mensaje acceso-aviso" role="status">{aviso}</p>}
            <button className="primary-button acceso-boton" type="submit" disabled={enviando || codigo.length !== 6}>{enviando ? "Comprobando…" : "Confirmar código"}</button>
          </form>
          <button className="admin-texto-boton" type="button" onClick={async () => { await salir(); }}>Cancelar y cerrar sesión</button>
        </>}

        {paso === "autorizado" && <>
          <div className="admin-titulo-icono admin-verificado"><ShieldCheck size={24} /></div>
          <h2>Acceso verificado</h2>
          <p className="admin-descripcion">La contraseña y el código fueron aceptados. Tu sesión administrativa temporal está activa en esta pestaña.</p>
          <p className="acceso-mensaje acceso-aviso">Los módulos de administración se conectarán aquí en la siguiente fase. La API emitió un token administrativo con vencimiento.</p>
          <button className="primary-button acceso-boton" type="button" onClick={salir}>Cerrar sesión</button>
          <span className="admin-token-nota">Token en memoria: {tokenAdmin ? "activo" : "no disponible"}. Al recargar la página deberás verificarte de nuevo.</span>
        </>}
      </section>
    </main>
  );
}
