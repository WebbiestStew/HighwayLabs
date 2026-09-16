"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const hasProject = !!localStorage.getItem("highwaylab.project") || !!localStorage.getItem("highwaylab.corridor");
    router.replace(hasProject ? "/overview" : "/start");
  }, [router]);

  return null;
}
