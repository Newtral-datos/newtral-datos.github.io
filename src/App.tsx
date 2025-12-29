import { MonitoreoTable } from "./components/MonitoreoTable";
import icamLogo from "./assets/icam_logo.png";
import newtralLogo from "./assets/powered_by_newtral.png";

const LOGO_LEFT_SIZE = "65px";
const LOGO_RIGHT_SIZE = "40px";

export default function App() {
  return (
    <>
      <div className="page">
        {/* Cabecera con logos */}
        <header className="app-header">
          <img
            src={icamLogo}
            alt="ICAM"
            className="logo left"
            style={{ height: LOGO_LEFT_SIZE }}
          />
          <img
            src={newtralLogo}
            alt="Newtral"
            className="logo right"
            style={{ height: LOGO_RIGHT_SIZE }}
          />
        </header>

        {/* Contenido principal */}
        <main className="app-root">
          <MonitoreoTable />
        </main>

        {/* Footer */}
        <footer
          className="footer-logo"
          style={{ marginTop: "40px", textAlign: "center", opacity: 0.85 }}
        >
          <img
            src={newtralLogo}
            alt="Newtral footer"
            style={{ width: "120px", height: "auto" }}
          />
        </footer>
      </div>
    </>
  );
}