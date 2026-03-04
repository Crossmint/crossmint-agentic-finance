# ping-relai-crossmint-solana

Solana x402 paywall using [RelAI](https://relai.fi) facilitator + [Crossmint](https://crossmint.com) smart wallet.

**Server** protects `/ping` with a $0.01 USDC paywall on Solana mainnet via `@relai-fi/x402`.
**Client** uses a Crossmint smart wallet (API-key, server-side) to pay and access the endpoint.

## How It Works

```
Client                          Server                     RelAI Facilitator
  │                               │                              │
  │  GET /ping                    │                              │
  │──────────────────────────────>│                              │
  │  402 Payment Required         │                              │
  │<──────────────────────────────│                              │
  │                               │                              │
  │  Build USDC transfer tx       │                              │
  │  Send to Crossmint API ───> Crossmint signs + broadcasts    │
  │  Extract on-chain signature   │                              │
  │                               │                              │
  │  GET /ping + X-PAYMENT(txId)  │                              │
  │──────────────────────────────>│  POST /settle {txId}         │
  │                               │─────────────────────────────>│
  │                               │  Verify on-chain transfer    │
  │                               │  (amount, payTo, asset)      │
  │                               │<─────────────────────────────│
  │  200 { message: "pong" }      │                              │
  │<──────────────────────────────│                              │
```

### Key Points

- **Crossmint smart wallet** handles signing and broadcasting — no private key needed on your side
- **Crossmint sponsors gas** (SOL) — wallet only needs USDC
- **RelAI facilitator** verifies the on-chain transfer matches payment requirements (amount, payTo, asset)
- **Zero gas for the user** — Crossmint pays SOL fees, RelAI verifies the proof

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Description |
|----------|-------------|
| `PAY_TO` | Solana wallet address to receive payments |
| `CROSSMINT_API_KEY` | Crossmint server API key ([get one](https://www.crossmint.com/console)) |
| `CROSSMINT_WALLET` | Crossmint smart wallet address (Solana) |
| `RPC_URL` | Solana RPC URL (mainnet) |

### 3. Start the server

```bash
npm run dev:server
```

### 4. Test with curl (expect 402)

```bash
curl -i http://localhost:3000/ping
# HTTP/1.1 402 Payment Required
# {"x402Version":2,"accepts":[{"scheme":"exact","network":"solana:5eykt4...","amount":"10000","asset":"EPjFWdd5...","payTo":"..."}]}
```

### 5. Run the client (pays with Crossmint)

```bash
npm run dev:client
```

Expected output:

```
╔══════════════════════════════════════════════════════╗
║  Crossmint Smart Wallet × RelAI x402 — Solana USDC  ║
╚══════════════════════════════════════════════════════╝

Step 1: GET http://localhost:3000/ping
  → 402 Payment Required
    Network : solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp
    Asset   : EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
    Amount  : 10000 (atomic)

Step 2: Building USDC transfer instruction...
Step 3: Sending tx to Crossmint smart wallet...
Step 4: Polling for on-chain confirmation...
  ✅ On-chain signature: 2pmcV8XG...
Step 5: Building X-PAYMENT header...
Step 6: Retrying GET with X-PAYMENT...
  → 200 OK
  Response: { "message": "pong", "paidAt": "2025-..." }

🎉 Success! Crossmint smart wallet paid for API access via RelAI x402.
```

## Prerequisites

- **Node.js 18+**
- **Crossmint API key** with a funded smart wallet (needs USDC on Solana mainnet)
- **Solana RPC** access (public or private like Helius/QuickNode)

> **Note:** Crossmint charges a small service fee (~0.001 USDC) per transaction on top of the payment amount.

## Stack

| Component | Role |
|-----------|------|
| [`@relai-fi/x402`](https://www.npmjs.com/package/@relai-fi/x402) | Server-side x402 paywall + facilitator integration |
| [`@crossmint/wallets-sdk`](https://www.npmjs.com/package/@crossmint/wallets-sdk) | Smart wallet (API-key, signs + broadcasts) |
| [`@solana/web3.js`](https://www.npmjs.com/package/@solana/web3.js) | Solana transaction building |
| [`@solana/spl-token`](https://www.npmjs.com/package/@solana/spl-token) | USDC SPL token instructions |
| [Express 5](https://expressjs.com/) | HTTP server |
