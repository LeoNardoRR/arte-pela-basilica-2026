import React from "react";
import ReactDOM from "react-dom/client";
import { useEffect, useState } from "react";
import { Catalog } from "./Catalog";
import { Admin } from "./Admin";
import "./globals.css";

function App() {
  const [isAdmin, setIsAdmin] = useState(() => window.location.hash.startsWith("#admin"));
  useEffect(() => {
    const updateRoute = () => setIsAdmin(window.location.hash.startsWith("#admin"));
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);
  return isAdmin ? <Admin /> : <Catalog />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
