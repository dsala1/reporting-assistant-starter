// app/layout.js
import './globals.css';
import Topbar from './components/Topbar';

export const metadata = {
  title: 'Reporting Assistant',
  description: 'Asistente de reportes',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Topbar />
        <main className="ra-main">
          {children}
        </main>
        <footer className="ra-footer">© 2025 Reporting Assistant</footer>
      </body>
    </html>
  );
}
