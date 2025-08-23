// app/layout.js
import "./globals.css";
import "./topbar.css"; // si no lo tienes, borra esta línea

export const metadata = {
  title: "Reporting Assistant",
  description: "Asistente de reportes con chat, playbook y alertas.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <header className="topbar">
          <div className="bar-inner">
            <a href="/" className="brand">Reporting Assistant</a>
            <nav className="nav">
              <a href="/chat">Chat</a>
              <a href="/playbook">Playbook</a>
              <a href="/workspaces">Workspaces</a>
              {/* <a href="/alerts">Alertas</a>  // lo activaremos cuando hagamos la lista */}
              <a href="/login">Entrar</a>
              <a href="/signup">Registro</a>
            </nav>
          </div>
        </header>

        <main className="page">{children}</main>

        <footer className="site-footer">
          © {new Date().getFullYear()} Reporting Assistant
        </footer>
      </body>
    </html>
  );
}
