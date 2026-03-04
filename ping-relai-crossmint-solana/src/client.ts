/**
 * Crossmint smart wallet × RelAI x402 — Solana USDC
 *
 * Minimal client: one function call pays for API access.
 * All x402 + Crossmint logic lives in @relai-fi/x402/crossmint.
 */
import "dotenv/config";
import { Connection } from "@solana/web3.js";
import { createCrossmintX402Fetch } from "@relai-fi/x402/crossmint";

const connection = new Connection(process.env.RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");

const fetch402 = createCrossmintX402Fetch({
  apiKey: process.env.CROSSMINT_API_KEY!,
  wallet: process.env.CROSSMINT_WALLET!,
  connection,
});

const targetUrl = process.env.TARGET_URL || "http://localhost:3000/ping";

console.log(`Fetching ${targetUrl} with Crossmint smart wallet...\n`);

const resp = await fetch402(targetUrl);
const body = await resp.json();

console.log(`\nStatus: ${resp.status}`);
console.log("Response:", JSON.stringify(body, null, 2));
