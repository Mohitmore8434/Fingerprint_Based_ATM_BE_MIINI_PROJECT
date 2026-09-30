// ============================================================
// useFirebaseATM — Real-time Firebase hook for SecureATM
// ============================================================
import { useEffect, useState } from "react";
import { ref, onValue, set } from "firebase/database";
import { db } from "@/lib/firebase";

export interface ATMState {
  authenticated: boolean;
  currentUser: number;
  loginType: string;
}

export interface ESP32State {
  online: boolean;
  lastSeen: string;
}

export interface UserData {
  name: string;
  accountNumber: string;
  balance: number;
  pin: string;
  fingerprintId: number;
  registered: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: number;
  type: "withdrawal" | "deposit" | "balance_check";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  timestamp: string;
  status: "success" | "failed";
}

export function useATMState() {
  const [atm, setAtm] = useState<ATMState>({
    authenticated: false,
    currentUser: 0,
    loginType: "",
  });

  useEffect(() => {
    const atmRef = ref(db, "atm");
    const unsub = onValue(atmRef, (snap) => {
      if (snap.exists()) setAtm(snap.val() as ATMState);
    });
    return () => unsub();
  }, []);

  return atm;
}

export function useESP32State() {
  const [esp32, setEsp32] = useState<ESP32State>({
    online: false,
    lastSeen: "OFFLINE",
  });

  useEffect(() => {
    const espRef = ref(db, "esp32");
    const unsub = onValue(espRef, (snap) => {
      if (snap.exists()) setEsp32(snap.val() as ESP32State);
    });
    return () => unsub();
  }, []);

  return esp32;
}

export function useUsers() {
  const [users, setUsers] = useState<Record<string, UserData>>({});

  useEffect(() => {
    const usersRef = ref(db, "users");
    const unsub = onValue(usersRef, (snap) => {
      if (snap.exists()) setUsers(snap.val() as Record<string, UserData>);
      else setUsers({});
    });
    return () => unsub();
  }, []);

  return users;
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const txRef = ref(db, "transactions");
    const unsub = onValue(txRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val() as Record<string, Omit<Transaction, "id">>;
        const list = Object.entries(data)
          .filter(([key]) => key !== "_comment")
          .map(([id, tx]) => ({ id, ...tx }))
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        setTransactions(list);
      } else {
        setTransactions([]);
      }
    });
    return () => unsub();
  }, []);

  return transactions;
}

export async function updateUserBalance(
  userId: string,
  newBalance: number
): Promise<void> {
  await set(ref(db, `users/${userId}/balance`), newBalance);
}

export async function addTransaction(tx: Omit<Transaction, "id">): Promise<void> {
  const key = `txn_${Date.now()}`;
  await set(ref(db, `transactions/${key}`), tx);
}

export async function forceLogout(): Promise<void> {
  await set(ref(db, "atm/authenticated"), false);
  await set(ref(db, "atm/currentUser"), 0);
  await set(ref(db, "atm/loginType"), "");
}
