/**
 * Cliente de Supabase para el navegador.
 *
 * Se usa para iniciar sesión, registrarse y obtener el token del usuario,
 * que luego se envía al backend en cada petición.
 *
 * Variables requeridas en frontend/.env.local (deben empezar con VITE_):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * Importante: aquí solo va la clave "publishable". Nunca pongas la clave
 * secreta (service role) en el frontend.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY en frontend/.env.local"
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);