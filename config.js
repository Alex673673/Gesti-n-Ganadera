/* Configuración del cliente de Supabase.
   Supabase > Project Settings > API:
     - Project URL            -> SUPABASE_URL
     - anon / publishable key -> SUPABASE_ANON_KEY

   Estos dos valores son PÚBLICOS por diseño (acaban en el navegador): la seguridad
   la garantiza RLS en la base de datos, no ocultar la clave.
   ⚠️ NUNCA pongas aquí la clave "service_role" / "secret": se salta RLS por completo. */
window.APP_CONFIG = {
  SUPABASE_URL: 'https://zsvtdiysmliapvjaittf.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_lbn1UU5X24mKOxqmm-OLJQ_b1A5Oz9U'
};
