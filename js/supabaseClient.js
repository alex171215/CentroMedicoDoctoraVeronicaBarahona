// Cliente Supabase (URL del proyecto, sin /rest/v1)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const supabaseUrl = 'https://voumbawzjuakmifavivx.supabase.co';
const supabaseKey =
    'sb_publishable_JkkFUH42L4ltridLKOO5yA_d-ieCbQj';

export const supabase = createClient(supabaseUrl, supabaseKey);
