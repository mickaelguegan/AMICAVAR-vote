import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import { ToastProvider } from "./ui";
import "./styles.css";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
const root = createRoot(document.getElementById("root")!);

if (!url) {
  root.render(
    <div className="wrap">
      <div className="gate">
        <h1>Configuration incomplète</h1>
        <p className="muted">
          L'adresse de la base Convex n'a pas été fournie lors de la construction du site. Vérifiez le
          secret CONVEX_DEPLOY_KEY du dépôt GitHub puis relancez le déploiement.
        </p>
      </div>
    </div>,
  );
} else {
  const client = new ConvexReactClient(url);
  root.render(
    <React.StrictMode>
      <ConvexProvider client={client}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ConvexProvider>
    </React.StrictMode>,
  );
}
