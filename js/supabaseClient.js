// Cliente Supabase (URL del proyecto, sin /rest/v1)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const supabaseUrl = 'https://voumbawzjuakmifavivx.supabase.co';
const supabaseKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvdW1iYXd6anVha21pZmF2aXZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDcyMjcsImV4cCI6MjA5NDI4MzIyN30.sGhL-mZiUO-6RSAxLIQlg7M1L-HHL_nMc1IbnhTdm0k';

export const supabase = createClient(supabaseUrl, supabaseKey);
