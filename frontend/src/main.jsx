import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import Inicio from "./pages/Inicio.jsx";
import Acceso from "./pages/Acceso.jsx";
import AccesoAdmin from "./pages/AccesoAdmin.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";

function normalizarRuta(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function Raiz() {
  const { sesion, cargando } = useAuth();
  const [ruta, setRuta] = useState(() => normalizarRuta(window.location.pathname));

  useEffect(() => {
    const actualizarRuta = () => setRuta(normalizarRuta(window.location.pathname));
    window.addEventListener("popstate", actualizarRuta);
    return () => window.removeEventListener("popstate", actualizarRuta);
  }, []);

  // La portada pública es siempre la primera pantalla, incluso si hay una sesión activa.
  // El panel solo se abre cuando el usuario elige entrar a /app.
  useEffect(() => {
    if (cargando) return;
    if (ruta === "/app" && !sesion) {
      window.history.replaceState({}, "", "/login");
      setRuta("/login");
      return;
    }
    if ((ruta === "/login" || ruta === "/registro") && sesion) {
      window.history.replaceState({}, "", "/app");
      setRuta("/app");
      return;
    }
    if (!["/", "/app", "/login", "/registro", "/admin"].includes(ruta)) {
      window.history.replaceState({}, "", "/");
      setRuta("/");
    }
  }, [ruta, sesion, cargando]);

  if (cargando) return <main className="acceso"><p>Preparando FloraViva…</p></main>;
  if (ruta === "/admin") return <AccesoAdmin />;
  if (ruta === "/login" || ruta === "/registro") {
    return <Acceso key={ruta} initialMode={ruta === "/registro" ? "registro" : "entrar"} />;
  }
  if (ruta === "/app") return <App />;
  return <Inicio />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <Raiz />
    </AuthProvider>
  </StrictMode>,
);
