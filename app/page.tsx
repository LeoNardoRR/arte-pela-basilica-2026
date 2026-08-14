"use client";

import { useEffect, useState } from "react";
import { Admin } from "./Admin";
import { Catalog } from "./Catalog";

function routeIsAdmin(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.hash.startsWith("#admin") ||
    new URLSearchParams(window.location.search).get("admin") === "1" ||
    window.location.hash.includes("access_token=")
  );
}

export default function Home() {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => routeIsAdmin());

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
