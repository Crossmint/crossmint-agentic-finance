// Import polyfills FIRST - must be before any other imports
import "./polyfills";

import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { CrossmintProvider, CrossmintAuthProvider, CrossmintWalletProvider } from "@crossmint/client-sdk-react-ui";

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <CrossmintProvider apiKey={(import.meta as any).env?.VITE_CROSSMINT_API_KEY ?? ""}>
      <CrossmintAuthProvider>
        <CrossmintWalletProvider createOnLogin={{ chain: "solana", signer: { type: "email" } }}>
          <App />
        </CrossmintWalletProvider>
      </CrossmintAuthProvider>
    </CrossmintProvider>
  </React.StrictMode>
);
