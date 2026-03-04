import express from "express";
import cors from "cors";
import Relai from "@relai-fi/x402/server";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const payTo = process.env.PAY_TO!;

if (!payTo) {
  console.error("PAY_TO must be set in .env (Solana wallet address to receive payments)");
  process.exit(1);
}

const facilitatorUrl = process.env.FACILITATOR_URL || undefined; // default: RelAI production
const relai = new Relai({ network: "solana", ...(facilitatorUrl ? { facilitatorUrl } : {}) });

app.use(cors());

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    network: "solana",
    payTo: payTo.slice(0, 8) + "...",
    endpoints: { "/ping": "$0.01 USDC" },
  });
});

// Protected endpoint — requires $0.01 USDC on Solana via RelAI facilitator
app.get(
  "/ping",
  relai.protect({
    price: 0.01,
    payTo,
    description: "Ping endpoint — Solana USDC via RelAI + Crossmint smart wallet",
  }),
  (_req, res) => {
    res.json({ message: "pong", paidAt: new Date().toISOString() });
  }
);

app.listen(port, () => {
  console.log(`\n🚀 ping-relai-crossmint-solana server listening on http://localhost:${port}`);
  console.log(`   Network : Solana mainnet`);
  console.log(`   PayTo   : ${payTo}`);
  console.log(`   Price   : $0.01 USDC per /ping\n`);
  console.log(`Test: curl -i http://localhost:${port}/ping`);
  console.log(`      → should return 402 Payment Required\n`);
});
