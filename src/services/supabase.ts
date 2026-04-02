import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://gzskuhbanboxdhwbayxz.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6c2t1aGJhbmJveGRod2JheXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMDYxNzAsImV4cCI6MjA5MDU4MjE3MH0.nslwaLp4mYUo4X_ssYJottF96mRuUGuICrVz-K9kxtU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
