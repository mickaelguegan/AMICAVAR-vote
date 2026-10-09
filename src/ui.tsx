import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ConvexError } from "convex/values";
import { jetons, SEASON_LABEL, SEASONS, type Season } from "../convex/rules";

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

/** Le jeton de vote, dessiné pour s'afficher pareil sur tous les appareils. */
export function Jeton({ size = 22, faded = false }: { size?: number; faded?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={`jeton ${faded ? "faded" : ""}`}>
      <circle cx="12" cy="12" r="11" fill="#eab53c" stroke="#a9781a" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="#a9781a" strokeWidth="0.9" />
      <text x="12" y="16.3" textAnchor="middle" fontSize="11.5" fontWeight="700" fontFamily="Barlow Condensed, sans-serif" fill="#7a5410">
        A
      </text>
    </svg>
  );
}

/** Rangée de n jetons, lisible par les lecteurs d'écran. */
export function Jetons({ n, size = 20 }: { n: number; size?: number }) {
  return (
    <span className="jetons" role="img" aria-label={jetons(n)} title={jetons(n)}>
      {Array.from({ length: n }, (_, i) => (
        <Jeton key={i} size={size} />
      ))}
    </span>
  );
}

export function Cost({ cost, suggested }: { cost: number | null; suggested?: number }) {
  if (cost == null)
    return (
      <span className="pending">
        Coût à valider{suggested ? ` · suggéré ${jetons(suggested)}` : ""}
      </span>
    );
  return <Jetons n={cost} />;
}

/** Bandeau illustré d'une saison, façon carte postale. */
export function SeasonBand({ season, right }: { season: Season; right?: React.ReactNode }) {
  return (
    <div className={`band band-${season}`}>
      <svg className="band-art" viewBox="0 0 390 64" preserveAspectRatio="none" aria-hidden="true">
        {season === "P" && (
          <>
            <path d="M0 44 Q60 24 130 38 T260 32 T390 36 V64 H0Z" fill="#9bc23c" />
            <path d="M0 54 Q90 40 190 52 T390 48 V64 H0Z" fill="#5f9e3f" />
            <circle cx="60" cy="38" r="3.5" fill="#fff" />
            <circle cx="72" cy="41" r="3.5" fill="#f4a7c0" />
            <circle cx="84" cy="37" r="3.5" fill="#fff" />
          </>
        )}
        {season === "E" && (
          <>
            <path d="M0 42 Q24 34 48 42 T96 42 T144 42 T192 42 T240 42 T288 42 T336 42 T390 42 V64 H0Z" fill="#6bb3d1" />
            <path d="M0 52 Q24 44 48 52 T96 52 T144 52 T192 52 T240 52 T288 52 T336 52 T390 52 V64 H0Z" fill="#2c7da0" />
          </>
        )}
        {season === "A" && (
          <>
            <path d="M0 40 Q80 26 170 36 T390 30 V64 H0Z" fill="#d9a066" />
            <path d="M0 50 Q100 40 210 48 T390 44 V64 H0Z" fill="#a8562b" />
            <path d="M196 30 l5 -5 l5 5 l-5 5z M232 34 l4 -4 l4 4 l-4 4z" fill="#c9792f" />
          </>
        )}
      </svg>
      {season === "P" && <span className="band-sun" style={{ background: "#fbe7a1" }} />}
      {season === "E" && <span className="band-sun" style={{ background: "#ffd166", width: 28, height: 28 }} />}
      <span className="band-title">{SEASON_LABEL[season]}</span>
      {right && <span className="band-right">{right}</span>}
    </div>
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

/* ---------- Icônes (trait, couleur du texte) ---------- */

const ICONS: Record<string, React.ReactNode> = {
  pencil: <path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16v4zM13.5 6.5l4 4" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  merge: <path d="M6 3v3a6 6 0 0 0 6 6M18 3v3a6 6 0 0 1-6 6v9M8.5 17.5L12 21l3.5-3.5" />,
  hourglass: <path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  review: <path d="M9 4h6v3H9zM7 5.5H5.5V21h13V5.5H17M12 11v4M12 18h.01" />,
  chevron: <path d="M7 10l5 5 5-5" />,
};

export function Icon({ name, size = 20 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/** Petit menu déroulant ancré sous un bouton ; se ferme au clic extérieur ou avec Échap. */
export function Popover({
  trigger,
  label,
  className = "iconbtn",
  disabled,
  children,
}: {
  trigger: React.ReactNode;
  label: string;
  className?: string;
  disabled?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <span className="pop" ref={ref}>
      <button
        type="button"
        className={className}
        aria-label={label}
        title={label}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>
      {open && <div className="pop-panel" role="menu">{children(() => setOpen(false))}</div>}
    </span>
  );
}
