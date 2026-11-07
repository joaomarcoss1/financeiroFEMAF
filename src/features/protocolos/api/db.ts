import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// Tabelas e RPCs da F6/F7 (migrations 20261105*) ainda não estão nos tipos gerados do Cloud.
// Quando o Lovable regenerar src/integrations/supabase/types.ts, trocar por `supabase`.
export const academicoDb = supabase as unknown as SupabaseClient;

/** Chama uma RPC e lança Error com a mensagem do banco (já em português). */
export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await academicoDb.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
