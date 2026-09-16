"use client";

import { useEffect, useState } from "react";
import { Admin } from "./Admin";
import { Catalog } from "./Catalog";
import { PasswordRecovery } from "./PasswordRecovery";

function routeIsRecovery(): boolean {
  if (typeof window === "undefined") return false;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return (
    new URLSearchParams(window.location.search).get("admin") === "reset" ||
    hash.get("type") === "recovery" ||
    hash.has("error_code") ||
    hash.has("error")
  );
}

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
  const [isRecovery, setIsRecovery] = useState<boolean>(() => routeIsRecovery());

  useEffect(() => {
    const updateRoute = () => {
      setIsAdmin(routeIsAdmin());
      setIsRecovery(routeIsRecovery());
    };
    window.addEventListener("hashchange", updateRoute);
    window.addEventListener("popstate", updateRoute);
    return () => {
      window.removeEventListener("hashchange", updateRoute);
      window.removeEventListener("popstate", updateRoute);
    };
  }, []);

  return isRecovery ? <PasswordRecovery /> : isAdmin ? <Admin /> : <Catalog />;
}
