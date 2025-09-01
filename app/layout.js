import './globals.css';
import Topbar from './topbar';

export const metadata = {
  title: 'Reporting Assistant',
  description: 'Analiza archivos y genera insights accionables.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Topbar />
        <main style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '24px 16px',
          minHeight: 'calc(100dvh - 56px)'
        }}>
          {children}
        </main>
        <footer style={{opacity:.7, fontSize:12, textAlign:'center', padding:'16px'}}>
          © 2025 Reporting Assistant
        </footer>
      </body>
    </html>
  );
}
