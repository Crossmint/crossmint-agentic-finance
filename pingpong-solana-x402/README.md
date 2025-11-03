# x402 Ping/Pong — Solana + Crossmint

Minimal, educational demo showing how to require and verify an x402 payment on Solana, paid via a Crossmint smart wallet.

## What you'll build
- Frontend: React + Vite app that sends a POST to `/api/ping`. If the server responds with HTTP 402 + x402 requirements, the client pays (USDC on Solana devnet) and retries.
- Backend: Cloudflare Worker that returns HTTP 402 with x402 "exact" requirements, and then verifies the on-chain payment before responding with `{ pong: true }`.

## Structure
- `web/` React + Vite frontend
- `worker/` Cloudflare Worker backend (no Durable Objects)

## Prerequisites
- Crossmint API key (for `@crossmint/client-sdk-react-ui` and `@crossmint/wallets-sdk`)
- A Crossmint smart wallet (created automatically on first login)
- Solana devnet USDC in your wallet (token mint defaults to devnet USDC)

## Setup
1) Install deps
```
cd pingpong-solana-x402/web && npm i && cd ../worker && npm i
```

2) Configure the worker (facilitator flow)
Set the following vars (e.g., via Wrangler dashboard or `wrangler.toml [vars]`):
- `PLATFORM_WALLET`: Solana address to receive USDC
- `USDC_MINT`: USDC mint address for the selected network (defaults to devnet USDC)
- `NETWORK`: `solana-devnet` | `solana-testnet` | `solana-mainnet` (defaults to `solana-devnet`)
- `PING_PRICE_USDC`: price to require for the ping (default `0.000001`)
- `FACILITATOR_URL`: facilitator base URL (default `https://x402.org/facilitator`)
- `FEE_PAYER_PUBKEY`: facilitator Solana public key (used as `extra.feePayer`)
- `FACILITATOR_AUTH`: optional bearer token for facilitator requests

3) Dev servers
- Worker: `npm run dev` in `pingpong-solana-x402/worker`
- Web: `npm run dev` in `pingpong-solana-x402/web`

4) Environment for the web app
Create `.env` in `pingpong-solana-x402/` (project root used by Vite):
```
VITE_WORKER_BASE_URL=http://127.0.0.1:8787
VITE_CROSSMINT_API_KEY=your_crossmint_api_key
VITE_NETWORK=devnet
VITE_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

## How it works (x402 exact on Solana, facilitator mode)
1) Client calls `/api/ping`
2) Server responds 402 with x402 `exact` requirements (USDC amount, `payTo`, network, and `extra.feePayer`)
3) Client builds a transfer transaction, sets `feePayer` to the facilitator, and signs locally with Crossmint (partial)
4) Client encodes the transaction into an SVM x402 payment payload and retries with `X-PAYMENT`
5) Server calls the facilitator to verify and then settle (facilitator signs & submits)
6) On success, server returns `{ pong: true }`

## Troubleshooting
- 402 loop: ensure the transaction actually transferred the required USDC amount to `PLATFORM_WALLET`, and that the client re-sent the request with the `X-PAYMENT` header.
- Missing env vars: the worker returns a structured 500 with which vars are missing.
- No USDC ATA: the client auto-creates associated token accounts (source/destination) if missing.

## Notes
- This demo uses on-chain verification for transparency. A facilitator flow can be added separately if desired.
