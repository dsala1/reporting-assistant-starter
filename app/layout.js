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
        <main>
          {children}
        </main>
        <footer style={{textAlign:'center', opacity:.7, fontSize:12, padding:'16px'}}>
          © 2025 Reporting Assistant
        </footer>
      </body>
    </html>
  );
}
