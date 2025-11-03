import React, { useEffect, useMemo, useState } from "react";
import { useAuth, useCrossmint } from "@crossmint/client-sdk-react-ui";
import { createCrossmint, WalletsApiClient } from "@crossmint/wallets-sdk";
import { Connection, LAMPORTS_PER_SOL, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { wrapFetchWithPayment } from "x402-fetch";
import { VersionedTransaction } from "@solana/web3.js";
import type { TransactionSigner, Transaction, SignatureDictionary } from "@solana/kit";
import { getTransactionEncoder, getTransactionDecoder, address as toAddress } from "@solana/kit";

const BASE = (import.meta as any).env?.VITE_WORKER_BASE_URL || "http://127.0.0.1:8787";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function createCrossmintTransactionSigner(payerAddress: string): TransactionSigner<string> {
  const signerAddress = toAddress(payerAddress);
  const encoder = getTransactionEncoder();
  const decoder = getTransactionDecoder();

  return {
    address: signerAddress,
    async signTransactions(transactions: Transaction[]): Promise<SignatureDictionary[]> {
      const signatures: SignatureDictionary[] = [];
      const wallet = (window as any).__crossmintSolanaWallet as {
        signTransaction?: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
      } | undefined;

      if (!wallet?.signTransaction) {
        throw new Error("Crossmint wallet signTransaction not available");
      }

      for (const transaction of transactions) {
        // Convert TransactionMessage from @solana/kit to VersionedTransaction for Crossmint
        const serialized = new Uint8Array(encoder.encode(transaction));
        const versionedTx = VersionedTransaction.deserialize(serialized);

        // Sign with Crossmint wallet
        const signedVersionedTx = await wallet.signTransaction(versionedTx);

        // Convert back to TransactionMessage format and extract signature
        const signedBytes = signedVersionedTx.serialize();
        const decodedTransaction = decoder.decode(new Uint8Array(signedBytes));
        const signature = decodedTransaction.signatures[signerAddress];

        if (!signature) {
          throw new Error("Wallet did not return a signature for the selected account.");
        }

        signatures.push(
          Object.freeze({
            [signerAddress]: signature,
          }) as SignatureDictionary,
        );
      }

      return signatures;
    },
  };
}

async function waitForSignatureOutput(
  apiClient: WalletsApiClient,
  walletLocator: string,
  signatureId: string,
  opts?: { intervalMs?: number; timeoutMs?: number }
): Promise<string> {
  const intervalMs = opts?.intervalMs ?? 1200;
  const timeoutMs = opts?.timeoutMs ?? 60_000;
  const start = Date.now();

  // poll until the signature is ready or fails
  while (true) {
    const res = await apiClient.getSignature(walletLocator as any, signatureId) as {
      status: "awaiting-approval" | "pending" | "failed" | "success";
      outputSignature?: string;
    };

    if (res.status !== "pending") {
      if (res.status === "success" && res.outputSignature) {
        return res.outputSignature;
      }
      throw new Error(`Signature ${signatureId} failed or missing outputSignature`);
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for signature ${signatureId}`);
    }

    await sleep(intervalMs);
  }
}

async function createSignatureAndWait(
  apiClient: WalletsApiClient,
  walletLocator: string,
  params: Parameters<WalletsApiClient["createSignature"]>[1],
  opts?: { intervalMs?: number; timeoutMs?: number }
): Promise<{ id: string; outputSignature: string }> {
  const created = await apiClient.createSignature(walletLocator as any, params) as { id: string };
  const outputSignature = await waitForSignatureOutput(apiClient, walletLocator, created.id, opts);
  return { id: created.id, outputSignature };
}

export function App() {
  const { login, jwt, logout } = useAuth();
  const { crossmint } = useCrossmint();
  const [address, setAddress] = useState<string>(localStorage.getItem("crossmintPayer") || "");
  const [connected, setConnected] = useState(false);
  const [sol, setSol] = useState<number | undefined>(undefined);
  const [usdc, setUsdc] = useState<number | undefined>(undefined);
  const [usdcMint, setUsdcMint] = useState<string | undefined>(undefined);
  const network = (((import.meta as any).env?.VITE_NETWORK as string | undefined) || "devnet") as "devnet" | "testnet" | "mainnet-beta";

  // Fetch USDC mint from server price-quote replacement (static for devnet)
  useEffect(() => {
    // Known devnet USDC if not provided
    setUsdcMint(((import.meta as any).env?.VITE_USDC_MINT as string | undefined) || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
  }, []);

  // Crossmint wallet setup when JWT available
  useEffect(() => {
    console.log({jwt, connected, crossmint})
    if (!jwt || connected) return;

    (async () => {
      try {
        const cm = createCrossmint({ apiKey: (import.meta as any).env?.VITE_CROSSMINT_API_KEY ?? "", experimental_customAuth: { jwt } });
        const apiClient = new WalletsApiClient(cm);
        const wallet = await apiClient.createWallet({
          chainType: "solana",
          type: "mpc",
        });
        console.log({ wallet });
        setAddress((wallet as any).address);
        setConnected(true);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [jwt, connected]);

  // test function
  const onTestCreateSignature = async () => {
    console.log("starting test create signature")
    const apiClient = new WalletsApiClient(crossmint);
    // If you sometimes already have an ID and just need to poll, call waitForSignatureOutput(apiClient, locator, id) directly.
    const { outputSignature } = await createSignatureAndWait(apiClient, `me:solana:mpc`, {
      type: "message",
      params: { message: "namaste" },
    });
    console.log({ outputSignature });
}

  // Balances
  useEffect(() => {
    if (!address) {
      setSol(undefined);
      setUsdc(undefined);
      return;
    }
    const conn = new Connection(clusterApiUrl(network));
    const pk = new PublicKey(address);
    let cancelled = false;
    const fetchBalances = async () => {
      try {
        const lamports = await conn.getBalance(pk);
        const solVal = lamports / LAMPORTS_PER_SOL;
        let usdcVal: number | undefined = undefined;
        if (usdcMint) {
          const mintPk = new PublicKey(usdcMint);
          const parsed = await conn.getParsedTokenAccountsByOwner(pk, { mint: mintPk });
          let total = 0;
          for (const a of parsed.value) {
            const info = (a.account.data as any).parsed?.info;
            total += Number(info?.tokenAmount?.uiAmount ?? 0);
          }
          usdcVal = total;
        }
        if (!cancelled) {
          setSol(solVal);
          setUsdc(usdcVal);
        }
      } catch (error) {
        console.error("Error fetching balances:", error);
        if (!cancelled) {
          setSol(undefined);
          setUsdc(undefined);
        }
      }
    };
    void fetchBalances();
    const id = setInterval(fetchBalances, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address, usdcMint, network]);

  const fetchWithPayment = useMemo(() => {
    if (!address) return fetch;
    const signer = createCrossmintTransactionSigner(address);
    return wrapFetchWithPayment(fetch, signer);
  }, [address]);

  async function onLogin() {
    if (!jwt) await login();
  }

  async function checkUSDCBalance(): Promise<{ hasAccount: boolean; balance: number; error?: string }> {
    if (!address || !usdcMint) {
      return { hasAccount: false, balance: 0, error: "Address or USDC mint not set" };
    }
    try {
      const conn = new Connection(clusterApiUrl(network));
      const pk = new PublicKey(address);
      const mintPk = new PublicKey(usdcMint);
      const parsed = await conn.getParsedTokenAccountsByOwner(pk, { mint: mintPk });
      let total = 0;
      for (const a of parsed.value) {
        const info = (a.account.data as any).parsed?.info;
        total += Number(info?.tokenAmount?.uiAmount ?? 0);
      }
      return { hasAccount: parsed.value.length > 0, balance: total };
    } catch (error: any) {
      return { hasAccount: false, balance: 0, error: error?.message || error?.toString() };
    }
  }

  async function onPing() {
    if (!address || !usdcMint) {
      alert("Please wait for wallet to be set up");
      return;
    }

    // Check balance before attempting payment
    const balanceCheck = await checkUSDCBalance();
    if (!balanceCheck.hasAccount) {
      alert(
        `No USDC token account found.\n\n` +
        `Your wallet address: ${address}\n` +
        `USDC Mint: ${usdcMint}\n\n` +
        `Please ensure:\n` +
        `1. You have received USDC to this address\n` +
        `2. The token account (ATA) has been created\n` +
        `3. You have sufficient balance for the payment`
      );
      return;
    }

    if (balanceCheck.balance === 0 || balanceCheck.balance < 0.01) {
      const msg = balanceCheck.balance === 0
        ? "Your USDC balance is 0"
        : `Your USDC balance (${balanceCheck.balance.toFixed(6)}) may be too low`;
      alert(`${msg}.\n\nPlease fund your wallet with USDC before attempting payment.`);
      return;
    }

    try {
      const r = await fetchWithPayment(`${BASE}/api/ping`, { method: "POST" });
      const t = await r.text();
      if (r.ok) {
        alert(t);
      } else {
        alert(`Server error (${r.status}): ${t}`);
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      const errorMsg = error?.message || error?.toString() || "Unknown error";
      const errorDetails = error?.cause ? `\n\nDetails: ${JSON.stringify(error.cause, null, 2)}` : "";
      alert(
        `Payment failed: ${errorMsg}${errorDetails}\n\n` +
        `Your USDC balance: ${balanceCheck.balance.toFixed(6)}\n` +
        `Common causes:\n` +
        `- Insufficient USDC balance (need at least 0.01 USDC)\n` +
        `- Missing or invalid token account\n` +
        `- Network/RPC connection issues\n` +
        `- Transaction simulation failure`
      );
    }
  }

  const title = useMemo(() => "pingpong-solana-x402", []);

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", padding: 16 }}>
      <h1>{title}</h1>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <button onClick={() => void onLogin()}>Login (Crossmint email)</button>
        <button disabled={!connected || !usdcMint} onClick={() => void onPing()}>Ping</button>
        <button disabled={!connected} onClick={() => void onTestCreateSignature()}>Test createSignature</button>
      </div>
      <div style={{ marginTop: 12, color: "#333" }}>
        <div><strong>Address</strong>: {address || "-"}</div>
        <div><strong>SOL</strong>: {sol === undefined ? "…" : sol.toFixed(6)}</div>
        <div><strong>USDC</strong>: {usdc === undefined ? "…" : usdc.toFixed(6)}</div>
      </div>
    </div>
  );
}


