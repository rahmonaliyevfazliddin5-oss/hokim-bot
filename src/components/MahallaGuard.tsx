import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useMahalla } from "@/contexts/MahallaContext";

export function MahallaGuard({ children }: { children: ReactNode }) {
  const { mahalla } = useMahalla();
  if (!mahalla) return <Navigate to="/mahalla/login" replace />;
  return <>{children}</>;
}
