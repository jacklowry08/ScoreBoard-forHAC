import { createClient } from '@supabase/supabase-js';

// TODO: Replace with your Supabase project credentials
// Get these from: https://app.supabase.com → Settings → API
const SUPABASE_URL = 'https://ijjokrejtrscpgtrsufh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqam9rcmVqdHJzY3BndHJzdWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNzgyMzIsImV4cCI6MjA4Njg1NDIzMn0.tgyu6Y8bNGpma-u9L4V9w2cCgBg4KsWdkQCSTyXpwUM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
