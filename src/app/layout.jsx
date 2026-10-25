import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'

export const metadata = {
  title: 'HCM Lite — HR Management',
  description: 'Lightweight HRMS: attendance, leave, payroll, employees & AI assistant',
}

/**
 * Applies the saved theme before first paint — no light-flash on reload.
 * Kept tiny and dependency-free; ThemeProvider adopts this state on mount.
 */
const themeInit = `(function(){try{var t=localStorage.getItem('hcm-theme');if(t!=='light'&&t!=='dark'&&t!=='system')t='system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';r.dataset.theme=d?'dark':'light';}catch(e){}})();`

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>
          {children}
          <Toaster richColors position="top-right" closeButton />
        </Providers>
      </body>
    </html>
  )
}
