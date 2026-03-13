# x402 Payment PoC: Crossmint + Faremeter on Solana Mainnet

End-to-end proof of concept demonstrating [x402](https://www.x402.org/) payments on **Solana mainnet** using a **Crossmint smart wallet with external signer** and the **Corbits perftest facilitator**.

## What is x402?

[x402](https://www.x402.org/) is a blockchain-agnostic payment protocol based on the HTTP 402 (Payment Required) status code. It enables machine-to-machine and human-to-service payments natively over HTTP:

1. Client sends a request to a protected endpoint
2. Server responds with **402** + payment requirements (accepted tokens, amounts, networks)
3. Client constructs and signs a payment proof using their wallet
4. Client retries the request with the payment proof in the `X-PAYMENT` header
5. Server verifies the proof via a **facilitator** service and settles the payment on-chain

This is particularly powerful for **AI agents** making autonomous API calls: they can pay for services programmatically without human intervention.

## Architecture

```
Client           Protected Resource        Facilitator
(this PoC)       (Corbits perftest)        (Corbits hosted)

  GET ----------> perftest.api.corbits.dev
  <--- 402 -----  (payment requirements)

  Signs payment proof using wallet

  GET + X-PAY -> Verifies via facilitator -> Settles on Solana
  <--- 200 ----  Returns content           mainnet

                 Crossmint Smart Wallet
                 (holds USDC, signed via external keypair)
```

### Key Components

| Component | Description |
|-----------|-------------|
| **[Faremeter](https://github.com/faremeter/faremeter)** | Open-source x402 protocol implementation (client + server + middleware) |
| **[Corbits](https://docs.corbits.dev/)** | Hosted facilitator service that verifies payments and settles on-chain |
| **Crossmint Smart Wallet** | Non-custodial Solana smart wallet with delegated signing via external keypair |
| **Perftest Endpoint** | `https://perftest.api.corbits.dev/protected` requires 0.005 USDC |

### Faremeter Packages Used

- `@faremeter/payment-solana/exact` - client-side Solana payment handler
- `@faremeter/fetch` - wraps `fetch()` to automatically handle 402 responses
- `@faremeter/info/solana` - token/network metadata lookup (USDC mint, decimals, etc.)
- `@faremeter/middleware` - Express middleware for protecting endpoints with x402 (local server only)

## Wallet Approaches

This PoC includes two wallet implementations:

### 1. Crossmint Delegated Wallet (recommended)

Uses Crossmint's smart wallet infrastructure with an **external keypair as signer**:
- Cryptographic control over transaction approvals
- Smart wallet features (gas sponsorship, batching)
- Audit trail of all approvals
- Production-ready security model

**How it works:**
1. A Solana keypair is generated locally (the "external signer")
2. A Crossmint smart wallet is created with this keypair registered as the admin signer
3. When a transaction needs signing, Crossmint returns a pending approval with a message
4. The local keypair signs the approval message (Ed25519)
5. The signed approval is submitted back to Crossmint, which executes the transaction on-chain

### 2. Keypair Wallet (simpler alternative)

Uses a standard Solana keypair directly for signing. Simpler but less suitable for production:
- Direct control over the private key
- No smart wallet features
- Good for local development and testing

### Comparison

| Feature | Crossmint Delegated | Keypair |
|---------|-------------------|---------|
| **Key Management** | External key approves; funds in smart wallet | Key holds funds directly |
| **Security** | Self-custodial approval + smart wallet | Full self-custody |
| **Gas Sponsorship** | Yes (via Crossmint) | No |
| **Production Ready** | Yes | No (dev only) |
| **Setup Complexity** | Moderate | Simple |

> **Note:** There is also a `@faremeter/wallet-crossmint` package that uses Crossmint's API key signer (custodial). This approach is being deprecated in favor of the external signer pattern shown here. See `src/index.ts` for a legacy example.

## Prerequisites

- **Node.js** >= 18
- **npm**
- **Crossmint production API key** with `wallets.create`, `wallets.read`, `wallets.update` scopes
- **Solana RPC endpoint** (e.g., [Helius](https://helius.dev/), [Alchemy](https://www.alchemy.com/))
- **Funded wallet** with USDC and SOL on Solana mainnet

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Generate a keypair

```bash
mkdir -p keypairs
solana-keygen new --no-bip39-passphrase -o keypairs/payer.json
```

### 3. Create a Crossmint smart wallet

```bash
# Set up your .env first (see next step), then:
npm run build
npm run create:wallet
```

This creates a Solana smart wallet on Crossmint with your keypair as the external admin signer. Copy the wallet address to your `.env`.

Alternatively, create the wallet via the [Crossmint Console](https://www.crossmint.com/console):
1. Go to Wallets > Create Wallet
2. Select Solana chain type
3. Set admin signer to "External Wallet" with your keypair's public key
4. Copy the wallet address

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
PAYER_KEYPAIR_PATH=./keypairs/payer.json
NETWORK=mainnet-beta
CROSSMINT_API_KEY=sk_production_...
CROSSMINT_WALLET=<your-smart-wallet-address>
CROSSMINT_ENVIRONMENT=production
RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY
CROSSMINT_RESOURCE_URL=https://perftest.api.corbits.dev/protected
```

### 5. Fund the wallet

The Crossmint smart wallet needs real funds on Solana mainnet:

- **USDC**: At least **0.005 USDC** per test request (mainnet mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)
- **SOL**: A small amount for transaction fees (~0.01 SOL is plenty)

Send USDC and SOL to the `CROSSMINT_WALLET` address from any Solana wallet (Phantom, Solflare, etc.) or fund via the [Crossmint Console](https://www.crossmint.com/console).

Check balances: `npm run check:balances`

### 6. Build

```bash
npm run build
```

## Running the Examples

### Crossmint Delegated Wallet (recommended)

```bash
npm run start:delegated
```

This will:
1. Load the external signer keypair and initialize the Crossmint delegated wallet adapter
2. Check wallet balances (SOL + USDC)
3. Send a GET request to `https://perftest.api.corbits.dev/protected`
4. Receive a 402 response with payment requirements
5. Construct and sign a USDC payment proof (0.005 USDC)
6. Retry the request with the `X-PAYMENT` header
7. Receive a 200 response with the protected content

### Keypair Wallet

```bash
npm run start:keypair
```

Same flow but uses a direct Solana keypair instead of Crossmint's smart wallet.

### Legacy Crossmint Custodial (deprecated)

```bash
npm run start:test
```

Uses `@faremeter/wallet-crossmint` with API key signer. This approach is being deprecated.

### Verify wallet setup

```bash
npm run check:wallet     # Check Crossmint wallet configuration
npm run check:balances   # Check SOL + USDC balances
npm run keypair:base58   # Convert keypair to base58
```

## File Structure

```
src/
  wallets/
    crossmintExternalDelegatedWallet.ts  # Crossmint delegated wallet adapter
    keypairWallet.ts                     # Simple keypair wallet adapter
  examples/
    useCrossmintDelegatedWallet.ts       # Main example: delegated wallet + perftest
    useKeypairWallet.ts                  # Alternative: keypair wallet + perftest
  scripts/
    createDelegatedWallet.ts             # Create Crossmint wallet via API
    setupDelegatedWallet.ts              # Add external signer to existing wallet
    checkCrossmintWallet.ts              # Inspect wallet configuration
    check-balances.ts                    # Check SOL + USDC balances
    fundWallet.ts                        # Funding helper
    keypairToBase58.ts                   # Convert keypair JSON to base58
  utils/
    checkWalletSetup.ts                  # Wallet readiness checker
  index.ts                               # Legacy custodial wallet example
  server.ts                              # Local test server (optional)
```

## Local Server (Optional)

For local development/testing without the Corbits perftest endpoint:

1. Generate a payto keypair: `solana-keygen new --no-bip39-passphrase -o keypairs/payto.json`
2. Run a local facilitator (see [Faremeter quickstart](https://github.com/faremeter/faremeter/blob/main/QUICKSTART.md))
3. Update `.env`:
   ```bash
   CROSSMINT_RESOURCE_URL=http://127.0.0.1:3000/protected
   FACILITATOR_URL=http://localhost:4000
   ```
4. Start the server: `npm run start:server`
5. Run an example: `npm run start:delegated`

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Wallet has no SOL for transaction fees" | Fund smart wallet with SOL on mainnet (~0.01 SOL) |
| "Token account does not exist" | Send at least 0.005 USDC to smart wallet (auto-creates token account) |
| "No pending approval returned" | Wallet may have API-key signer instead of external-wallet signer. Run `npm run check:wallet` |
| "Crossmint API error 401" | Verify key starts with `sk_production_` and has wallet scopes |
| "Transaction timeout" | Check [Crossmint status](https://status.crossmint.com) or Solana network congestion |

### 402 Response Details

`https://perftest.api.corbits.dev/protected` returns:
- `maxAmountRequired`: 5000 (6 decimals = **0.005 USDC**)
- `feePayer`: Corbits sponsors transaction fees
- `network`: `solana-mainnet-beta`
- `asset`: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (USDC)

## Future Work

### $CASH Token Support
Once Corbits adds support for the $CASH token, update the token mint address in the payment configuration. The x402 protocol and Faremeter libraries are token-agnostic.

### SDK-Native x402 Support
[PR #1636 on crossmint-sdk](https://github.com/Crossmint/crossmint-sdk/pull/1636) adds `experimental_payX402` directly to the Crossmint wallets SDK. Once merged, the delegated wallet adapter can be replaced with:

```typescript
import { CrossmintWallets } from "@crossmint/wallets-sdk";
const wallets = CrossmintWallets.from(apiClient);
const wallet = await wallets.getOrCreateWallet("solana", { signer });
const response = await wallet.experimental_payX402("https://api.example.com/protected");
```

## References

- [x402 Protocol](https://www.x402.org/)
- [Faremeter (x402 implementation)](https://github.com/faremeter/faremeter)
- [Corbits Facilitator Docs](https://docs.corbits.dev/)
- [Crossmint Wallets SDK](https://docs.crossmint.com/wallets/overview)
- [Crossmint SDK PR #1636](https://github.com/Crossmint/crossmint-sdk/pull/1636)
