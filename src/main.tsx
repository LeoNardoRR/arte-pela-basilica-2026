import React from "react";
import ReactDOM from "react-dom/client";
import { Catalog } from "./Catalog";
import "./globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Catalog />
  </React.StrictMode>,
);
