// app/layout.js
import "./globals.css";
import "./topbar.css";

export const metadata = {
  title: "Reporting Assistant",
  description: "Asistente de reportes con chat y datasets.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {/* Topbar global (centrado y con separación) */}
        <header className="topbar">
          <div className="bar-inner">
            <a href="/" className="brand">Reporting Assistant</a>

            <nav className="nav">
              <a href="/chat">Chat</a>
              <a href="/workspaces">Workspaces</a>
              <a href="/login">Entrar</a>
              <a href="/signup">Registro</a>
            </nav>
          </div>
        </header>

        {/* Contenido de página */}
        <main className="page">{children}</main>

        {/* Footer simple y consistente */}
        <footer className="site-footer">
          © {new Date().getFullYear()} Reporting Assistant
        </footer>
      </body>
    </html>
  );
}
