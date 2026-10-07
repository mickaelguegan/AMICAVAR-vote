import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { ConvexError } from "convex/values";
import { euros, SEASON_LABEL, SEASONS, type Season } from "../convex/rules";

/* ---------- Messages ---------- */

type Toast = { text: string; kind: "ok" | "error" };
const ToastCtx = createContext<(t: Toast) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((t: Toast) => {
    setToast(t);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), t.kind === "error" ? 6000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-zone" aria-live="polite">
        {toast && (
          <div className={`toast ${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
            {toast.text}
            <button className="toast-x" onClick={() => setToast(null)} aria-label="Fermer">
              ×
            </button>
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

export function errorText(e: unknown): string {
  if (e instanceof ConvexError) return typeof e.data === "string" ? e.data : "Action refusée.";
  return "Une erreur est survenue. Vérifiez votre connexion et réessayez.";
}

/** Lance une action serveur ; affiche le message d'erreur ou de succès. Renvoie true si réussi. */
export function useRun() {
  const show = useContext(ToastCtx);
  return useCallback(
    async (fn: () => Promise<unknown>, success?: string): Promise<boolean> => {
      try {
        await fn();
        if (success) show({ text: success, kind: "ok" });
        return true;
      } catch (e) {
        show({ text: errorText(e), kind: "error" });
        return false;
      }
    },
    [show],
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

/* ---------- Petits éléments ---------- */

export function Cost({ cost, suggested }: { cost: number | null; suggested?: number }) {
  if (cost == null)
    return (
      <span className="pending">
        Coût à valider{suggested ? ` · suggéré ${euros(suggested)}` : ""}
      </span>
    );
  return (
    <span className="cost" title={`Niveau de coût ${cost} sur 3`}>
      {euros(cost)}
      <span className="off">{euros(3 - cost)}</span>
    </span>
  );
}

export function Chips({ seasons }: { seasons: Season[] }) {
  return (
    <>
      {SEASONS.filter((s) => seasons.includes(s)).map((s) => (
        <span key={s} className={`chip s-${s}`}>
          {SEASON_LABEL[s]}
        </span>
      ))}
    </>
  );
}

export function initials(name: string): string {
  return name
    .split(/[\s.-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Copie dans le presse-papiers ; renvoie false si le navigateur refuse. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Bouton qui demande une confirmation sur place avant d'agir. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = "btn ghost danger",
  disabled,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button className={className} onClick={() => setAsking(true)} disabled={disabled}>
        {label}
      </button>
    );
  return (
    <span className="confirm">
      <button
        className="btn danger"
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button className="btn ghost" onClick={() => setAsking(false)}>
        Annuler
      </button>
    </span>
  );
}
