# Despliegue de FloraViva: Vercel + Render

## Antes de desplegar
1. Sube este proyecto a un repositorio privado de GitHub. No subas archivos `.env`.
2. En Supabase, ejecuta una sola vez en **SQL Editor** los archivos, en este orden:
   - `database/20261020_admin_login_challenges.sql`
   - `database/20261021_user_email_challenges.sql`
3. En Apps Script, crea las propiedades `FLORAVIVA_SHARED_SECRET` (debe coincidir exactamente con `GOOGLE_APPS_SCRIPT_SECRET`) y `FLORAVIVA_ADMIN_EMAIL`. Implementa como aplicación web ejecutada por ti y accesible para solicitudes externas, según los controles de tu organización; copia la URL `/exec`.

## Render (backend)
1. Crea un Web Service desde el repositorio. Puedes usar el `render.yaml` incluido.
2. Configura las variables de entorno indicadas en `render.yaml` con valores reales de Supabase, Apps Script y secretos aleatorios. No reutilices un secreto para `ADMIN_OTP_SECRET`, `ADMIN_SESSION_SECRET` y `USER_EMAIL_OTP_SECRET`.
3. Tras desplegar, comprueba `https://TU-SERVICIO.onrender.com/api/health`.

## Vercel (frontend)
1. Importa el mismo repositorio en Vercel y establece **Root Directory** en `frontend`.
2. Framework: Vite; Build Command: `npm run build`; Output Directory: `dist`.
3. Define estas variables de entorno en Vercel:
   - `VITE_SUPABASE_URL`: URL pública de tu proyecto Supabase.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: clave publishable de Supabase (nunca la secret).
   - `VITE_API_URL`: URL HTTPS del backend Render, sin barra final.
4. Despliega y copia el dominio asignado por Vercel.
5. En Render, ajusta `FRONTEND_ORIGINS` a los orígenes exactos permitidos, separados por coma, por ejemplo `https://tu-app.vercel.app`. Añade el dominio de producción y el dominio de vista previa solo si realmente los usarás. Guarda para que Render redepliegue.
6. En Supabase Auth, configura los Site URL y Redirect URLs que correspondan a tu dominio de Vercel.

## Desarrollo local
- Backend: copia `backend/.env.example` como `backend/.env`, completa los valores y ejecuta desde `backend/`: `uvicorn app.main:app --reload`.
- Frontend: copia `frontend/.env.example` como `frontend/.env.local`, completa las variables y ejecuta desde `frontend/`: `npm install` y `npm run dev`.

## Pruebas posteriores
- `GET /api/health` devuelve `{"estado":"correcto","servicio":"FloraViva API"}`.
- Crea una cuenta nueva, comprueba que llegue el código, introduce un código erróneo y luego uno válido, y verifica que la cuenta pueda iniciar sesión después de confirmarla.
- Prueba el acceso administrativo y los flujos de plantas/cultivos.

## Limitaciones que requieren configuración real
- No se pueden verificar correos ni credenciales de producción desde este ZIP: debes introducir tus propias variables, ejecutar las migraciones y desplegar Apps Script.
- Para recuperación de contraseña, usa una URL HTTPS pública de Vercel como `FLORAVIVA_APP_URL`; no uses `localhost` en producción.
- El envío OTP de usuario crea primero la cuenta Supabase sin confirmar. Si falla el envío, la cuenta queda sin confirmar y requiere una acción administrativa para resolver/reintentar; el endpoint no revela detalles de proveedores.
