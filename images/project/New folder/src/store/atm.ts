import { create } from "zustand";

export interface UserData {
  name: string;
  balance: number;
  pin: string;
  verified: boolean;
}

interface ATMState {
  currentUser: number | null;
  userData: UserData | null;
  loginType: "fingerprint" | "pin" | "";
  setSession: (
    userId: number,
    userData: UserData,
    loginType: "fingerprint" | "pin",
  ) => void;
  updateBalance: (balance: number) => void;
  clearSession: () => void;
}

export const useATM = create<ATMState>((set) => ({
  currentUser: null,
  userData: null,
  loginType: "",
  setSession: (userId, userData, loginType) =>
    set({ currentUser: userId, userData, loginType }),
  updateBalance: (balance) =>
    set((s) => ({
      userData: s.userData ? { ...s.userData, balance } : s.userData,
    })),
  clearSession: () =>
    set({ currentUser: null, userData: null, loginType: "" }),
}));
