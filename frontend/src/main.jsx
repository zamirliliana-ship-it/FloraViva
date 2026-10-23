
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import App from "./App.jsx";
import Inicio from "./pages/Inicio.jsx";
import Acceso from "./pages/Acceso.jsx";
import AccesoAdmin from "./pages/AccesoAdmin.jsx";
import RecuperarContrasena from "./pages/RecuperarContrasena.jsx";

import { AuthProvider, useAuth } from "./context/AuthContext.jsx";

function normalizarRuta(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.length > 1
    ? pathname.replace(/\/+$/, "")
    : pathname;
}

function Raiz() {
  const { sesion, cargando } = useAuth();

  const [ruta, setRuta] = useState(() =>
    normalizarRuta(window.location.pathname)
  );

  useEffect(() => {
    const actualizarRuta = () => {
      setRuta(normalizarRuta(window.location.pathname));
    };

    window.addEventListener("popstate", actualizarRuta);

    return () => {
      window.removeEventListener("popstate", actualizarRuta);
    };
  }, []);

  useEffect(() => {
    // Permitir que el flujo de recuperación funcione
    // incluso mientras Supabase procesa el enlace enviado por correo.
    if (cargando || ruta === "/recuperar") return;

    // El panel requiere una sesión iniciada.
    if (ruta === "/app" && !sesion) {
      window.history.replaceState({}, "", "/login");
      setRuta("/login");
      return;
    }

    // Si ya inició sesión, dirigir al panel desde login o registro.
    if ((ruta === "/login" || ruta === "/registro") && sesion) {
      window.history.replaceState({}, "", "/app");
      setRuta("/app");
      return;
    }

    // Rutas públicas y rutas permitidas.
    const rutasPermitidas = [
      "/",
      "/app",
      "/login",
      "/registro",
      "/admin",
      "/recuperar",
    ];

    if (!rutasPermitidas.includes(ruta)) {
      window.history.replaceState({}, "", "/");
      setRuta("/");
    }
  }, [ruta, sesion, cargando]);

  // Pantalla de carga inicial.
  if (cargando && ruta !== "/recuperar") {
    return (
      <main className="acceso">
        <p>Preparando FloraViva…</p>
      </main>
    );
  }

  // Recuperación de contraseña: debe evaluarse antes de las demás rutas.
  if (ruta === "/recuperar") {
    return <RecuperarContrasena />;
  }

  if (ruta === "/admin") {
    return <AccesoAdmin />;
  }

  if (ruta === "/login" || ruta === "/registro") {
    return (
      <Acceso
        key={ruta}
        initialMode={ruta === "/registro" ? "registro" : "entrar"}
      />
    );
  }

  if (ruta === "/app") {
    return <App />;
  }

  return <Inicio />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <Raiz />
    </AuthProvider>
  </StrictMode>
);
