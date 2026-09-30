import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useATM } from "@/store/atm";

/** Redirects to /home if there is no active session. */
export function useSessionGuard() {
  const navigate = useNavigate();
  const currentUser = useATM((s) => s.currentUser);

  useEffect(() => {
    if (!currentUser) {
      navigate({ to: "/home" });
    }
  }, [currentUser, navigate]);

  return currentUser;
}
