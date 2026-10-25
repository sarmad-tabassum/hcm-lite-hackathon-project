/** @type {import('next').NextConfig} */

/**
 * Security headers — professional hardening applied to EVERY response:
 *  - X-Frame-Options DENY + frame-ancestors 'none' → clickjacking-proof
 *  - nosniff, strict referrer, locked-down permissions, HSTS
 *  - CSP: Next.js dev needs 'unsafe-inline'/'unsafe-eval' for its runtime &
 *    HMR; Supabase (REST + realtime websocket) is the only external origin
 *    the browser talks to — AI providers are called server-side only.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co'
const supabaseOrigin = (() => {
  try { return new URL(SUPABASE_URL).origin } catch { return 'https://*.supabase.co' }
})()
const wsOrigin = supabaseOrigin.replace('https://', 'wss://')

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()',
  },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src 'self' ${supabaseOrigin} ${wsOrigin}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  },
]

const nextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  // Serve pages for both /path and /path/ — prevents redirect loops when a
  // proxy/edge in front of the app adds or caches trailing-slash 301s.
  skipTrailingSlashRedirect: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
