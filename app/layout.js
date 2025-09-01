// app/layout.js
import './globals.css';
import Topbar from './topbar';

export const metadata = {
  title: 'Reporting Assistant',
  description: 'Reportes y análisis con tu Playbook y datos MCP',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{
        backgroundColor: '#0b1220',
        color: '#e5e7eb',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Topbar />
        <main style={{ flex: 1, padding: '24px 16px', maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </main>
        <footer style={{
          borderTop: '1px solid rgba(148,163,184,.12)',
          color: '#9ca3af',
          fontSize: 13,
          padding: '16px',
          textAlign: 'center'
        }}>
          © {new Date().getFullYear()} Reporting Assistant
        </footer>
      </body>
    </html>
  );
}
