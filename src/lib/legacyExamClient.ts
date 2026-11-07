import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// The historical exam screens refer to a schema not present in the current
// Cloud database. Keep their requests explicit rather than editing generated
// database types; the server still rejects unavailable tables/functions.
export const legacyExamClient = supabase as unknown as SupabaseClient;