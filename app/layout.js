// app/layout.js
import "./globals.css";

export const metadata = {
  title: "Reporting Assistant",
  description: "Genera análisis y reportes desde tus hojas",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="app">
        <header className="navbar">
          <div className="nav-inner container">
            <a className="brand" href="/chat">Reporting Assistant</a>
            <nav className="links">
              <a href="/chat">Chat</a>
              <a href="/workspaces">Workspaces</a>
              <a href="/login">Entrar</a>
              <a href="/signup">Registro</a>
            </nav>
          </div>
        </header>

        <main className="container">
          {children}
        </main>

        <footer className="footer">
          <div className="container">
            <span>© {new Date().getFullYear()} Reporting Assistant</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
