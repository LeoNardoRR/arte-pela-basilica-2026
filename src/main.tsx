import React from "react";
import ReactDOM from "react-dom/client";
import { Catalog } from "./Catalog";
import { Admin } from "../app/Admin";
import "./globals.css";

const ADMIN_PATH = "#admin";

function App() {
  const [page, setPage] = React.useState<"catalog" | "admin">(
    window.location.hash === ADMIN_PATH ? "admin" : "catalog"
  );

  React.useEffect(() => {
    const onHashChange = () => {
      setPage(window.location.hash === ADMIN_PATH ? "admin" : "catalog");
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (page === "admin") return <Admin />;
  return <Catalog onAdmin={() => { window.location.hash = "admin"; setPage("admin"); }} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
