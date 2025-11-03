import { Hono } from "hono";
import { useFacilitator } from "x402";

export interface Env { NETWORK: string }

const app = new Hono<{ Bindings: Env }>();

app.use("/*", async (c, next) => {
  c.res.headers.set("Access-Control-Allow-Origin", "*");
  c.res.headers.set("Access-Control-Allow-Headers", "Content-Type, X-PAYMENT");
  c.res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  await next();
});

function readVar(c: any, key: string, fallback?: string) {
  return (c.env as any)?.[key] ?? (globalThis as any)?.[key] ?? fallback;
}

function getEnvVars(c: any) {
  const PLATFORM_WALLET = String(readVar(c, "PLATFORM_WALLET", ""));
  const NETWORK = String(readVar(c, "NETWORK", "solana-devnet"));
  const USDC_MINT = String(readVar(c, "USDC_MINT", "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"));
  const AMOUNT = String(readVar(c, "PING_PRICE_USDC", "0.01")); // Default 0.01 USDC (in decimal)
  const FACILITATOR_URL = String(readVar(c, "FACILITATOR_URL", "https://x402.org/facilitator"));
  const FACILITATOR_AUTH = String(readVar(c, "FACILITATOR_AUTH", ""));
  const FEE_PAYER_PUBKEY = String(readVar(c, "FEE_PAYER_PUBKEY", ""));
  return { PLATFORM_WALLET, NETWORK, USDC_MINT, AMOUNT, FACILITATOR_URL, FACILITATOR_AUTH, FEE_PAYER_PUBKEY };
}

function paymentRequired(requirements: any) {
  return new Response(
    JSON.stringify({ x402Version: 1, accepts: [requirements] }),
    { status: 402, headers: { "Content-Type": "application/json", "Accept-Payment": "x402" } },
  );
}

// helper: convert decimal string to atomic units string (safe, no float)
function toAtomicUnits(amount: string, decimals = 6): string {
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const normalized = `${whole || "0"}${fracPadded}`.replace(/^0+/, "") || "0";
  // ensure integer characters only
  if (!/^\d+$/.test(normalized)) throw new Error("Invalid amount format");
  return normalized;
}

app.post("/api/ping", async (c) => {
  const { PLATFORM_WALLET, NETWORK, USDC_MINT, AMOUNT, FACILITATOR_URL, FACILITATOR_AUTH, FEE_PAYER_PUBKEY } = getEnvVars(c);
  if (!PLATFORM_WALLET || !USDC_MINT || !FEE_PAYER_PUBKEY) {
    return c.json(
      {
        error: "server_misconfigured",
        missing: {
          PLATFORM_WALLET: !PLATFORM_WALLET,
          USDC_MINT: !USDC_MINT,
          FEE_PAYER_PUBKEY: !FEE_PAYER_PUBKEY,
        },
        message: "Set PLATFORM_WALLET, USDC_MINT, and FEE_PAYER_PUBKEY environment variables on the worker.",
      },
      500,
    );
  }
  const net = (NETWORK.split("-")[1] || "devnet") as "devnet" | "testnet" | "mainnet-beta";
  // Convert decimal amount to atomic units if needed, or use as-is if already atomic
  // Check if AMOUNT contains a decimal point to determine if conversion is needed
  const amountAtomic = AMOUNT.includes(".") ? toAtomicUnits(AMOUNT, 6) : AMOUNT;
  const baseReq = {
    scheme: "exact",
    network: `solana-${net}`,
    maxAmountRequired: amountAtomic,
    asset: USDC_MINT,
    payTo: PLATFORM_WALLET,
    maxTimeoutSeconds: 300,
    resource: `x402://ping`,
    description: "Ping",
    mimeType: "application/json",
    extra: { feePayer: FEE_PAYER_PUBKEY },
  };

  const xpay = c.req.header("X-PAYMENT");
  if (!xpay) return paymentRequired(baseReq);

  let payload: any;
  try {
    payload = JSON.parse(atob(xpay));
  } catch {
    return paymentRequired(baseReq);
  }

  try {
    // @ts-ignore - TypeScript incorrectly infers the type but the runtime is correct
    const facilitator = useFacilitator({
      url: FACILITATOR_URL as `${string}://${string}`,
      createAuthHeaders: async () => {
        const auth = FACILITATOR_AUTH ? { Authorization: `Bearer ${FACILITATOR_AUTH}` } : {};
        return { verify: auth, settle: auth, supported: {} };
      },
    });
    const valid = await facilitator.verify(payload, baseReq as any);
    if (!valid?.isValid) return paymentRequired(baseReq);
    const settled = await facilitator.settle(payload, baseReq as any);
    if (!settled?.success) return paymentRequired(baseReq);
    return c.json({ pong: true });
  } catch {
    return paymentRequired(baseReq);
  }
});

export default { fetch: app.fetch };
