"use client";

import { useEffect, useState } from "react";
import { Admin } from "./Admin";
import { Catalog } from "./Catalog";

export default function Home() {
  const routeIsAdmin = () => {
    if (typeof window === "undefined") return false;
    return window.location.hash.startsWith("#admin") ||
      new URLSearchParams(window.location.search).get("admin") === "1" ||
      window.location.hash.includes("access_token=");
  };

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const updateRoute = () => setIsAdmin(routeIsAdmin());
    updateRoute();
    window.addEventListener("hashchange", updateRoute);
    window.addEventListener("popstate", updateRoute);
    return () => {
      window.removeEventListener("hashchange", updateRoute);
      window.removeEventListener("popstate", updateRoute);
    };
  }, []);

  return isAdmin ? <Admin /> : <Catalog />;
}
