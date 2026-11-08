import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Null when env vars are missing — the app then runs on local demo data. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

export const PHOTO_BUCKET = "report-photos";
