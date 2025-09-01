// app/layout.js
import './globals.css';
import Topbar from './components/Topbar';

export const metadata = {
  title: 'Reporting Assistant',
  description: 'Asistente de reporting con chat, playbook y análisis de archivos',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Topbar />
        <main className="shell">
          {children}
        </main>
        <footer className="footer container">
          © 2025 Reporting Assistant
        </footer>
      </body>
    </html>
  );
}
