import { useNavigate } from "@tanstack/react-router";
import { jsPDF } from "jspdf";
import { Download, Home, Printer, ShieldCheck } from "lucide-react";

export interface ReceiptData {
  id: string;
  type: "deposit" | "withdrawal" | "balance_check";
  amount: number;
  balance: number;
  time: string;
  name: string;
  userID: number;
}

const TYPE_LABEL: Record<ReceiptData["type"], string> = {
  deposit: "DEPOSIT",
  withdrawal: "WITHDRAWAL",
  balance_check: "BALANCE INQUIRY",
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function inr(n: number) {
  return "₹ " + n.toLocaleString("en-IN");
}

interface ReceiptModalProps {
  receipt: ReceiptData | null;
  onClose?: () => void;
}

export function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  const navigate = useNavigate();
  if (!receipt) return null;

  const downloadPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: [320, 520] });
    doc.setFont("courier", "bold");
    doc.setFontSize(16);
    doc.text("SecureATM", 160, 40, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("courier", "normal");
    doc.text("TRANSACTION RECEIPT", 160, 58, { align: "center" });
    doc.line(20, 70, 300, 70);
    const lines: [string, string][] = [
      ["Txn ID", receipt.id.slice(0, 18)],
      ["Date", formatDateTime(receipt.time)],
      ["Account", receipt.name],
      ["User ID", String(receipt.userID)],
      ["Type", TYPE_LABEL[receipt.type]],
      ["Amount", receipt.type === "balance_check" ? "—" : inr(receipt.amount)],
      ["Balance", inr(receipt.balance)],
      ["Status", "SUCCESS"],
    ];
    let y = 90;
    lines.forEach(([k, v]) => {
      doc.setFont("courier", "bold");
      doc.text(k, 24, y);
      doc.setFont("courier", "normal");
      doc.text(v, 296, y, { align: "right" });
      y += 20;
    });
    doc.line(20, y, 300, y);
    doc.setFontSize(8);
    doc.text("Thank you for banking with SecureATM", 160, y + 18, { align: "center" });
    doc.save(`receipt_${receipt.id.slice(0, 8)}.pdf`);
  };

  const goHome = () => {
    onClose?.();
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/85 backdrop-blur-md p-4 fade-in">
      <div className="print-area w-full max-w-md rounded-2xl bg-white text-slate-900 shadow-2xl">
        <div className="border-b border-dashed border-slate-300 p-6 text-center">
          <div className="font-mono text-2xl font-bold tracking-tight">SecureATM</div>
          <div className="mt-1 text-xs uppercase tracking-[0.3em] text-slate-500">
            Transaction Receipt
          </div>
        </div>
        <div className="space-y-2 p-6 font-mono text-sm">
          <Row k="Txn ID" v={receipt.id.slice(0, 18)} />
          <Row k="Date" v={formatDateTime(receipt.time)} />
          <Row k="Account" v={receipt.name} />
          <Row k="User ID" v={String(receipt.userID)} />
          <Row k="Type" v={TYPE_LABEL[receipt.type]} />
          {receipt.type !== "balance_check" && <Row k="Amount" v={inr(receipt.amount)} bold />}
          <Row k="Balance After" v={inr(receipt.balance)} bold />
          <div className="my-3 border-t border-dashed border-slate-300" />
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Status</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
              <ShieldCheck className="h-3 w-3" /> SUCCESS
            </span>
          </div>
          <div className="mt-4 flex items-center justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded border border-dashed border-slate-300 text-[10px] text-slate-400">
              QR — Coming Soon
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-200 p-4 print:hidden">
          <button
            onClick={downloadPdf}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700"
          >
            <Download className="h-4 w-4" /> PDF
          </button>
          <button
            onClick={() => typeof window !== "undefined" && window.print()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-slate-100"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            onClick={goHome}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-bold text-white"
            style={{ background: "var(--teal)", color: "var(--primary-foreground)" }}
          >
            <Home className="h-4 w-4" /> Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{k}</span>
      <span className={bold ? "font-bold" : ""}>{v}</span>
    </div>
  );
}
