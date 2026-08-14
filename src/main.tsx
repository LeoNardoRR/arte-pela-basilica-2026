import React from "react";
import ReactDOM from "react-dom/client";
import { Catalog } from "./Catalog";
import Admin from "./Admin";
import "./globals.css";

const ADMIN_PATH = "#admin";

function App() {
  const [page, setPage] = React.useState<"catalog" | "admin">(
    window.location.hash === ADMIN_PATH ? "admin" : "catalog"
  );

  function goAdmin() {
    window.location.hash = "admin";
    setPage("admin");
  }
  function goCatalog() {
    window.location.hash = "";
    setPage("catalog");
  }

  if (page === "admin") return <Admin onBack={goCatalog} />;
  return <Catalog onAdmin={goAdmin} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
