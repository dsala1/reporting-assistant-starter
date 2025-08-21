import './globals.css';

export const metadata = {
  title: 'Reporting Assistant Starter',
  description: 'Auth + Workspaces con Supabase',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <div className="container">
          <div className="nav">
            <div><a href="/">Inicio</a></div>
            <div style={{display:'flex', gap:12}}>
              <a href="/workspaces">Workspaces</a>
              <a href="/login">Entrar</a>
              <a href="/signup">Registro</a>
            </div>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
