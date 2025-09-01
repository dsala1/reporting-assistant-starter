export const metadata = {
  title: 'Reporting Assistant',
  description: 'Asistente de reporting con chat y playbook',
};

import './globals.css';
import Topbar from './Topbar';

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="site">
        <Topbar />
        <main className="container">{children}</main>
        <footer className="site__footer">© 2025 Reporting Assistant</footer>
      </body>
    </html>
  );
}
