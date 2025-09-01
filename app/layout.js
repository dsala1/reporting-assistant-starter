import './globals.css';
import './topbar.css';
import Topbar from './components/Topbar';

export const metadata = {
  title: 'Reporting Assistant',
  description: 'Asistente de análisis y reporting',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Topbar />
        <main style={{ maxWidth: 1100, margin: '28px auto', padding: '0 20px' }}>
          {children}
        </main>
        <footer style={{
          maxWidth: 1100, margin: '40px auto 24px', padding: '0 20px',
          opacity: .6, fontSize: 13
        }}>
          © 2025 Reporting Assistant
        </footer>
      </body>
    </html>
  );
}
