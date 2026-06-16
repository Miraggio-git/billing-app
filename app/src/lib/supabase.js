import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ydoitzgqavfmbyrirxxe.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkb2l0emdxYXZmbWJ5cmlyeHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDUyNTYsImV4cCI6MjA5MjU4MTI1Nn0.U4VWiiR4kBc_hfM2EpFJCGZf5JATeW32-9isb_NSi3M'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
