import React from "react";
import ReactDOM from "react-dom/client";
import { useEffect, useState } from "react";
import { Catalog } from "./Catalog";
import { Admin } from "./Admin";
import "./globals.css";

function App() {
  const routeIsAdmin = () =>
    window.location.hash.startsWith("#admin") ||
    new URLSearchParams(window.location.search).get("admin") === "1" ||
    window.location.hash.includes("access_token=");

  const [isAdmin, setIsAdmin] = useState(routeIsAdmin);

  useEffect(() => {
    const updateRoute = () => setIsAdmin(routeIsAdmin());
    window.addEventListener("hashchange", updateRoute);
    window.addEventListener("popstate", updateRoute);
    return () => {
      window.removeEventListener("hashchange", updateRoute);
      window.removeEventListener("popstate", updateRoute);
    };
  }, []);

  return isAdmin ? <Admin /> : <Catalog />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
