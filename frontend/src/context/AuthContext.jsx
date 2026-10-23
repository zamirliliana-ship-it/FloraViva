
/** Contexto global de autenticación de Supabase. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!activo) return;
      if (error) console.error("No se pudo recuperar la sesión:", error.message);
      setSesion(data?.session ?? null);
      setCargando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_evento, nuevaSesion) => {
        setSesion(nuevaSesion);
        setCargando(false);
      }
    );

    return () => {
      activo = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const iniciarSesion = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }, []);

  const solicitarRecuperacion = useCallback(async (email) => {
    const redirectTo = `${window.location.origin}/recuperar`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw error;
  }, []);

  const actualizarContrasena = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const registrar = useCallback(async ({ nombre, email, password }) => {
    const base = (
      import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
    ).replace(/\/$/, "");

    let respuesta;
    try {
      respuesta = await fetch(`${base}/api/auth/registro`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ nombre, email, password }),
      });
    } catch {
      throw new Error("No se pudo conectar con el servidor de registro.");
    }

    const resultado = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      throw new Error(
        typeof resultado.detail === "string"
          ? resultado.detail
          : "No se pudo crear la cuenta."
      );
    }

    return {
      requiereConfirmacion: true,
      mensaje: resultado.mensaje,
    };
  }, []);

  const verificarCorreo = useCallback(async ({ email, codigo }) => {
    const base = (
      import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
    ).replace(/\/$/, "");

    let respuesta;
    try {
      respuesta = await fetch(`${base}/api/auth/verificar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, codigo }),
      });
    } catch {
      throw new Error(
        "No se pudo conectar con el servidor para confirmar el correo."
      );
    }

    const resultado = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      throw new Error(
        typeof resultado.detail === "string"
          ? resultado.detail
          : "No se pudo confirmar el correo."
      );
    }

    return resultado;
  }, []);

  const cerrarSesion = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
  }, []);

  const valor = useMemo(
    () => ({
      sesion,
      usuario: sesion?.user ?? null,
      cargando,
      iniciarSesion,
      registrar,
      verificarCorreo,
      solicitarRecuperacion,
      actualizarContrasena,
      cerrarSesion,
    }),
    [
      sesion,
      cargando,
      iniciarSesion,
      registrar,
      verificarCorreo,
      solicitarRecuperacion,
      actualizarContrasena,
      cerrarSesion,
    ]
  );

  return (
    <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return contexto;
}
