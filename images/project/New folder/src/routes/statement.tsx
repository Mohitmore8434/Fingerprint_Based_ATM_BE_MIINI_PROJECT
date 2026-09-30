import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { onValue, ref, get, push, serverTimestamp } from "firebase/database";
import { jsPDF } from "jspdf";
import emailjs from "@emailjs/browser";
import { toast } from "sonner";

const EMAILJS_SERVICE_ID = "service_f2bhe3t";
const EMAILJS_TEMPLATE_ID = "template_z25vi1i";
const EMAILJS_PUBLIC_KEY = "fjrYe0iTnfPOCaeSI";
import {
  ArrowLeft,
  FileText,
  Mail,
  Printer,
  Search,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useATM } from "@/store/atm";
import { useSessionGuard } from "@/components/atm/SessionGuard";

export const Route = createFileRoute("/statement")({
  ssr: false,
  component: Statement,
});

interface Row {
  id: string;
  type: "deposit" | "withdrawal" | "balance_check";
  amount: number;
  balance: number;
  time: string;
  userID: number;
}

function inr(n: number) {
  return "₹ " + n.toLocaleString("en-IN");
}

const ATM_ID = "SECATM-001";
const COOLDOWN_SECONDS = 30;

function Statement() {
  const currentUser = useSessionGuard();
  const userData = useATM((s) => s.userData);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;

  const [showDelivery, setShowDelivery] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const sessionIdRef = useRef<string>(
    `SID-${Date.now().toString(36).toUpperCase()}`,
  );

  // Email flow state
  const [emailStatus, setEmailStatus] = useState<
    "idle" | "generating" | "sending" | "success" | "error"
  >("idle");
  const [emailMessage, setEmailMessage] = useState<string>("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!currentUser) return;
    const u = onValue(ref(db, "receipts"), (s) => {
      const v = s.val() ?? {};
      const list: Row[] = Object.entries(v)
        .map(([id, r]: [string, any]) => ({ id, ...r }))
        .filter((r) => Number(r.userID) === currentUser)
        .sort((a, b) => (a.time < b.time ? 1 : -1));
      setRows(list);
    });
    return () => u();
  }, [currentUser]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.type.toLowerCase().includes(term) ||
        new Date(r.time).toLocaleString("en-IN").toLowerCase().includes(term),
    );
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  // ---------- PDF builder (reused for email) ----------
  const buildPdf = (): jsPDF | null => {
    if (!userData || !currentUser) return null;
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("SecureATM — Bank Statement", 14, 16);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Account: ${userData.name} (#${currentUser})`, 14, 24);
    doc.text(`ATM ID: ${ATM_ID}  •  Session: ${sessionIdRef.current}`, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 36);
    doc.text(`Current Balance: ${inr(userData.balance)}`, 14, 42);

    let y = 54;
    doc.setFont("helvetica", "bold");
    doc.text("Date", 14, y);
    doc.text("Type", 70, y);
    doc.text("Amount", 120, y, { align: "right" });
    doc.text("Balance", 180, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 4;
    doc.line(14, y, 196, y);
    y += 6;

    filtered.forEach((r) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(new Date(r.time).toLocaleString("en-IN"), 14, y);
      doc.text(r.type, 70, y);
      doc.text(
        r.type === "balance_check" ? "—" : inr(Number(r.amount)),
        120,
        y,
        { align: "right" },
      );
      doc.text(inr(Number(r.balance)), 180, y, { align: "right" });
      y += 7;
    });

    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    y += 10;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      "This is a system-generated document from SecureATM. Keep it confidential.",
      14,
      y,
    );
    return doc;
  };

  // ---------- Print Receipt Locally (PDF in new tab + print dialog) ----------
  const handlePrint = () => {
    setShowDelivery(false);
    try {
      const doc = buildPdf();
      if (!doc) {
        toast.error("Unable to build statement — no data.");
        return;
      }
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (w) {
        w.onload = () => {
          try {
            w.focus();
            w.print();
          } catch (e) {
            console.error("[Print] print() failed", e);
          }
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        };
      } else {
        // Popup blocked — fall back to download
        const fname = `statement_${currentUser}_${Date.now()}.pdf`;
        doc.save(fname);
        toast.message("Popup blocked — PDF downloaded instead.");
      }
      toast.success("Statement ready to print");
    } catch (e: any) {
      console.error("[Print] failed", e);
      toast.error("Print failed: " + (e?.message ?? "unknown"));
    }
  };

  // ---------- Send to Registered Email (EmailJS) ----------
  const handleEmail = async () => {
    if (cooldown > 0) return;
    if (!currentUser || !userData) return;
    setEmailStatus("generating");
    setEmailMessage("Generating PDF...");
    try {
      // STEP 1: Fetch registered email from Firebase users/{userId}/email
      const snap = await get(ref(db, `users/${currentUser}/email`));
      const email = snap.val() as string | null;
      console.log("[Email] Recipient (from Firebase):", email);
      if (!email || typeof email !== "string" || !email.includes("@")) {
        setEmailStatus("error");
        setEmailMessage(
          "No valid registered email found for this account. Please add an email at users/" +
            currentUser +
            "/email in Firebase.",
        );
        return;
      }

      // STEP 2: Build PDF
      const doc = buildPdf();
      if (!doc) {
        setEmailStatus("error");
        setEmailMessage("Unable to build statement — no data.");
        return;
      }

      // STEP 3: Convert PDF to base64 (without data-URI prefix) for EmailJS attachment
      const pdfBase64 = doc.output("datauristring").split(",")[1];
      console.log("[Email] PDF generated. base64 length:", pdfBase64?.length);

      const fname = `statement_${currentUser}_${Date.now()}.pdf`;

      // Also save a local copy for the user
      doc.save(fname);

      setEmailStatus("sending");
      setEmailMessage("Sending Email...");

      // STEP 4 + 5: Send REAL email via EmailJS with pdf_attachment variable
      const templateParams: Record<string, string> = {
        // Recipient — multiple aliases so the EmailJS template "To Email"
        // setting can use whichever variable name was configured.
        to_email: email,
        email: email,
        recipient: email,
        user_email: email,
        reply_to: email,

        to_name: userData.name,
        user_id: String(currentUser),
        balance: inr(userData.balance),
        transaction_count: String(filtered.length),
        generated_at: new Date().toLocaleString("en-IN"),
        subject: "Your SecureATM Bank Statement",
        message:
          "Please find your SecureATM bank statement attached.\n" +
          "Use your ATM PIN to verify statement if required.\n\n" +
          "Do not share this document. If you did not request this statement, contact support immediately.",

        // Attachment — variable name MUST match EmailJS template config
        pdf_attachment: pdfBase64,
        attachment_name: fname,
      };

      console.log("[Email] Sending via EmailJS to:", email);
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        { publicKey: EMAILJS_PUBLIC_KEY },
      );
      console.log("[Email] EmailJS response:", response);

      // Audit log
      await push(ref(db, `statementLog/${currentUser}`), {
        method: "email",
        email,
        at: serverTimestamp(),
        sessionId: sessionIdRef.current,
        emailjsStatus: response.status,
      });

      setEmailStatus("success");
      setEmailMessage(
        `Email Sent Successfully to ${maskEmail(email)}. A copy was downloaded to your device.`,
      );
      toast.success("Statement emailed successfully");
      setCooldown(COOLDOWN_SECONDS);
    } catch (e: any) {
      console.error("[Email] Send failed:", e);
      const detail =
        e?.text ||
        e?.message ||
        (typeof e === "string" ? e : "Unknown error");
      setEmailStatus("error");
      setEmailMessage(`Email Failed: ${detail}`);
      toast.error("Email failed: " + detail);
    }
  };

  if (!currentUser || !userData) return null;

  return (
    <main className="relative min-h-screen p-6 grid-bg fade-in no-print">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-mono uppercase tracking-widest hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Dashboard
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest hover:border-[var(--teal)]"
            >
              <Printer className="h-3 w-3" /> Print Statement
            </button>
            <button
              onClick={handleEmail}
              disabled={emailStatus === "generating" || emailStatus === "sending" || cooldown > 0}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-60"
              style={{ background: "var(--teal)", boxShadow: "0 0 18px var(--teal-glow)" }}
            >
              {emailStatus === "generating" || emailStatus === "sending" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Mail className="h-3 w-3" />
              )}
              {cooldown > 0 ? `Wait ${cooldown}s` : "Send to Registered Email"}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl glass p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-mono text-xl font-bold">Bank Statement</div>
              <div className="text-xs text-muted-foreground">
                {filtered.length} transactions
              </div>
            </div>
            <div className="flex items-center rounded-md border border-border bg-input px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search by type or date..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent px-2 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No transactions found.
                    </td>
                  </tr>
                )}
                {pageRows.map((r, i) => (
                  <tr key={r.id} className={i % 2 ? "bg-secondary/20" : ""}>
                    <td className="px-4 py-3 font-mono text-xs">
                      {new Date(r.time).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={r.type} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.type === "balance_check" ? "—" : inr(Number(r.amount))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{inr(Number(r.balance))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-border px-3 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-border px-3 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery method modal */}
      {showDelivery && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 fade-in no-print">
          <div className="relative w-full max-w-md rounded-2xl glass neon-border p-6">
            <button
              onClick={() => setShowDelivery(false)}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="text-center">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Choose Statement Delivery Method
              </div>
              <div className="mt-1 font-mono text-lg font-bold neon-text">
                Bank Statement
              </div>
            </div>

            {emailStatus !== "idle" && (
              <div
                className={`mt-4 flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                  emailStatus === "error"
                    ? "border-destructive/40 text-destructive"
                    : emailStatus === "success"
                    ? "border-primary/40 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {emailStatus === "generating" || emailStatus === "sending" ? (
                  <Loader2 className="mt-0.5 h-3 w-3 animate-spin" />
                ) : emailStatus === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-3 w-3" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-3 w-3" />
                )}
                <div>{emailMessage}</div>
              </div>
            )}

            <div className="mt-5 grid gap-3">
              <button
                onClick={handlePrint}
                className="group flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-4 text-left transition hover:border-[var(--teal)]"
              >
                <div
                  className="grid h-10 w-10 place-items-center rounded-lg"
                  style={{ background: "var(--teal)", color: "var(--primary-foreground)" }}
                >
                  <Printer className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-mono text-sm font-bold uppercase tracking-widest">
                    Print Receipt Locally
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Open browser print dialog · Save as PDF supported
                  </div>
                </div>
              </button>

              <button
                onClick={handleEmail}
                disabled={
                  emailStatus === "generating" ||
                  emailStatus === "sending" ||
                  cooldown > 0
                }
                className="group flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-4 text-left transition hover:border-[var(--teal)] disabled:opacity-60"
              >
                <div
                  className="grid h-10 w-10 place-items-center rounded-lg"
                  style={{
                    background: "color-mix(in oklab, var(--teal) 30%, transparent)",
                    color: "var(--teal)",
                  }}
                >
                  {emailStatus === "generating" || emailStatus === "sending" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Mail className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-mono text-sm font-bold uppercase tracking-widest">
                    Send to Registered Email
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {cooldown > 0
                      ? `Please wait ${cooldown}s before requesting again`
                      : "Secure delivery to your registered address"}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print area — shown only when printing */}
      {showPrintView && (
        <div className="print-area">
          <PrintReceipt
            userId={currentUser}
            name={userData.name}
            balance={userData.balance}
            rows={filtered.slice(0, 20)}
            atmId={ATM_ID}
            sessionId={sessionIdRef.current}
            total={filtered.length}
          />
        </div>
      )}
    </main>
  );
}

function maskEmail(e: string) {
  const [u, d] = e.split("@");
  if (!d) return e;
  const head = u.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, u.length - 2))}@${d}`;
}

function PrintReceipt({
  userId,
  name,
  balance,
  rows,
  atmId,
  sessionId,
  total,
}: {
  userId: number;
  name: string;
  balance: number;
  rows: Row[];
  atmId: string;
  sessionId: string;
  total: number;
}) {
  const now = new Date().toLocaleString("en-IN");
  return (
    <div
      style={{
        fontFamily: "'Courier New', ui-monospace, monospace",
        color: "#000",
        background: "#fff",
        padding: "16px",
        maxWidth: "360px",
        margin: "0 auto",
        fontSize: "12px",
        lineHeight: 1.45,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2 }}>
          SECUREATM
        </div>
        <div>IoT Biometric Banking</div>
        <div>--------------------------------</div>
      </div>
      <div>ATM ID    : {atmId}</div>
      <div>Session   : {sessionId}</div>
      <div>Date/Time : {now}</div>
      <div>--------------------------------</div>
      <div>Account   : {name}</div>
      <div>User ID   : #{userId}</div>
      <div>Balance   : ₹ {balance.toLocaleString("en-IN")}</div>
      <div>Txns      : {total}</div>
      <div>--------------------------------</div>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>MINI STATEMENT</div>
      {rows.length === 0 && <div>No transactions on record.</div>}
      {rows.map((r) => (
        <div key={r.id} style={{ marginBottom: 4 }}>
          <div>{new Date(r.time).toLocaleString("en-IN")}</div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{r.type.toUpperCase()}</span>
            <span>
              {r.type === "balance_check"
                ? "—"
                : "₹ " + Number(r.amount).toLocaleString("en-IN")}
            </span>
          </div>
          <div style={{ textAlign: "right" }}>
            Bal: ₹ {Number(r.balance).toLocaleString("en-IN")}
          </div>
        </div>
      ))}
      <div>--------------------------------</div>
      <div style={{ textAlign: "center", marginTop: 8 }}>
        Thank you for using SecureATM
      </div>
      <div style={{ textAlign: "center", fontSize: 10, marginTop: 4 }}>
        Keep this receipt for your records
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: Row["type"] }) {
  const map: Record<Row["type"], { label: string; color: string; bg: string }> = {
    deposit: { label: "Deposit", color: "oklch(0.9 0.2 160)", bg: "oklch(0.3 0.1 160 / 0.3)" },
    withdrawal: {
      label: "Withdrawal",
      color: "oklch(0.85 0.18 20)",
      bg: "oklch(0.3 0.15 20 / 0.3)",
    },
    balance_check: {
      label: "Balance",
      color: "oklch(0.85 0.15 240)",
      bg: "oklch(0.3 0.1 240 / 0.3)",
    },
  };
  const s = map[type];
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
      style={{ color: s.color, background: s.bg }}
    >
      {s.label}
    </span>
  );
}
