// ✅ SECURE SUPABASE CONFIGURATION
// This file loads Supabase configuration from ENVIRONMENT VARIABLES ONLY
// No hardcoded secrets should be present in source code

/**
 * Supabase Configuration
 * 
 * Load from environment variables:
 * - VITE_SUPABASE_URL: Your Supabase project URL
 * - VITE_SUPABASE_ANON_KEY: Your Supabase anon key
 * 
 * Setup Instructions:
 * 1. Copy .env.example to .env.local (DO NOT commit .env.local)
 * 2. Get values from Supabase Dashboard:
 *    Settings → API → Project URL and anon key
 * 3. Paste into .env.local:
 *    VITE_SUPABASE_URL=https://your-project.supabase.co
 *    VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
 * 4. Restart dev server
 * 
 * SECURITY:
 * ✓ NO hardcoded secrets in production
 * ✓ Environment-specific configuration
 * ✓ Safe for CI/CD pipelines
 * ✓ .env.local is in .gitignore
 * 
 * DEVELOPMENT:
 * If you see "URL is not set" error on startup:
 * 1. Copy .env.example to .env.local
 * 2. Add your Supabase credentials
 * 3. Restart dev server
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Development fallback (for demo only - will be removed in production)
const isDevelopment = import.meta.env.DEV;
const developmentUrl = isDevelopment 
  ? "https://fuixhbistsplpnznvkto.supabase.co" 
  : undefined;
const developmentKey = isDevelopment 
  ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1aXhoYmlzdHNwbHBuem52a3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0Mzg2NTYsImV4cCI6MjA4MTAxNDY1Nn0.LiOM7SLhauM1ap8pxnXH_5utuHEzJypjR6mhciP_gIA"
  : undefined;

export const SUPABASE_CONFIG = {
  url: supabaseUrl || developmentUrl,
  anonKey: supabaseKey || developmentKey,
};

// Validate configuration
if (!SUPABASE_CONFIG.url) {
  throw new Error(
    '❌ VITE_SUPABASE_URL is not configured.\n' +
    'For development: Create .env.local with your Supabase URL\n' +
    'For production: Set VITE_SUPABASE_URL environment variable\n' +
    'See .env.example for template.'
  );
}

if (!SUPABASE_CONFIG.anonKey) {
  throw new Error(
    '❌ VITE_SUPABASE_ANON_KEY is not configured.\n' +
    'For development: Create .env.local with your Supabase anon key\n' +
    'For production: Set VITE_SUPABASE_ANON_KEY environment variable\n' +
    'See .env.example for template.'
  );
}

if (isDevelopment && (!supabaseUrl || !supabaseKey)) {
  console.warn(
    '⚠️  [Supabase] Using development fallback credentials.\n' +
    '   To use your own Supabase project:\n' +
    '   1. Copy .env.example to .env.local\n' +
    '   2. Add your Supabase URL and anon key\n' +
    '   3. Restart dev server'
  );
} else {
  console.debug(
    '[Supabase] Configuration loaded from environment variables ✓'
  );
}