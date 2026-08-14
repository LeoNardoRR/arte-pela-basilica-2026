import React from "react";
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import "../app/globals.css";

document.documentElement.style.setProperty(
  "--hero-image-url",
  `url("${import.meta.env.BASE_URL}hero-basilica-v3.jpeg")`,
);

const root = document.getElementById("root");
if (!root) throw new Error("Elemento principal não encontrado.");

createRoot(root).render(
  <React.StrictMode>
    <Home />
  </React.StrictMode>,
);

