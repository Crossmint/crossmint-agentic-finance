# ping-nano

Minimal bare Express server with an x402 402 paywall settled on **Nano (XNO)** —
the feeless, sub-second, self-custodial rail. It is the `ping` demo's
counterpart: same shape, a settlement option that costs **$0 per transfer** and
settles in well under a second, directly on-ledger — no L2, no gas token, no
channel or liquidity management.

- **Network:** `nano:mainnet` (both Resource Server and Facilitator run against
  the real Nano network once `NANO_RPC_URL` is set).
- Reuses the published x402 stack: `@x402/core`, `@x402nano/exact`,
  `@x402nano/helper`. No payment logic is rebuilt.

## Setup

```bash
cd ping-nano
cp .env.example .env
# edit the Nano address the merchant receives payment to (PAYMENT_REQUIREMENT_PAY_TO)
npm install
```

## Run

Start the **Facilitator** (verifies & settles Nano blocks; needs `NANO_RPC_URL`):

```bash
npm run facilitator
```

In a second terminal, start the **Resource Server** (the 402 paywall):

```bash
npm run server
```

## Test the paywall

Request without payment — you get `402 Payment Required` with the exact-scheme
payment requirements for `nano:mainnet`:

```bash
curl -i -H "Accept: application/json" http://localhost:3100/ping
```

An x402 client that can sign Nano blocks (e.g. `@x402nano/exact`'s Client) reads
the returned `PAYMENT-REQUIRED` envelope, signs a Nano send to
`PAYMENT_REQUIREMENT_PAY_TO`, and retries with the payment header. On a valid
payment the response is `{ "message": "pong" }` with a `PAYMENT-RESPONSE`
header carrying the settled block hash.

## Honest scope

- This demo reuses the exact-scheme Nano x402 implementations unchanged; it is a
  thin wiring, not a payment-logic rewrite.
- The Nano exact scheme is **network-extensible** in the x402 protocol. Its
  per-network docs currently cover Solana, Stellar, SUI, TON and Starknet;
  `nano:mainnet` is supported by these implementations but is not yet listed in
  the upstream scheme's per-network docs. Test with small amounts.
- Settlement happens on the real Nano network only when `NANO_RPC_URL` points to
  an RPC that accepts send blocks. Verified the paywall shape you can reach for
  free: the `402 + payment requirements` step runs with no RPC and no keys.

## Files

```
src/server.ts        # x402 Resource Server (the 402 paywall) on port 3100
src/facilitator.ts   # x402 Facilitator (Nano verify/settle) on port 3101
.env.example
```
