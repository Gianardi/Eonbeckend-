// ============================================================
// Verifica che il token mandato dall'app appartenga a un utente
// vero e loggato su Supabase. Usata da ogni endpoint protetto.
// ============================================================
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // chiave segreta, mai nel frontend
);

export async function verifyUser(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
