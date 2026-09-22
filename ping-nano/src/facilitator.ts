/**
 * ping-nano Facilitator
 *
 * A Nano x402 facilitator: verifies and settles payment payloads on the Nano
 * network. The Resource Server calls its /verify and /settle endpoints; the
 * facilitator confirms the Nano send block against the network and processes
 * settlement.
 *
 * Reuse, not rebuild: @x402/core/facilitator + @x402nano/exact/facilitator +
 * @x402nano/helper (Nano RPC).
 */
import express from "express";
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactNanoScheme } from "@x402nano/exact/facilitator";
import { Helper } from "@x402nano/helper";
import "dotenv/config";

if (!process.env.NANO_RPC_URL) {
  throw new Error("NANO_RPC_URL environment variable not set in .env file");
}

const app = express();
app.use(express.json());

const facilitator = new x402Facilitator();
const helper = new Helper({ NANO_RPC_URL: process.env.NANO_RPC_URL });
const exactNanoScheme = new ExactNanoScheme(helper);
facilitator.register("nano:mainnet", exactNanoScheme);

facilitator
  .onBeforeVerify(async (_ctx) => console.log("Verifying payment..."))
  .onAfterVerify(async (ctx) => {
    if (ctx.result.isValid) console.log("Payment verified successfully");
    else console.log(`Verification failed: ${ctx.result.invalidReason}`);
  })
  .onBeforeSettle(async (_ctx) => console.log("Settling payment..."))
  .onAfterSettle(async (ctx) => {
    if (ctx.result.success) console.log(`Settled (hash: ${ctx.result.transaction})`);
    else console.log(`Settlement failed: ${ctx.result.errorReason}`);
  });

app.post("/verify", async (req, res) => {
  const { paymentPayload, paymentRequirements } = req.body;
  const verifyResult = await facilitator.verify(paymentPayload, paymentRequirements);
  res.json(verifyResult);
});

app.post("/settle", async (req, res) => {
  const { paymentPayload, paymentRequirements } = req.body;
  const settleResult = await facilitator.settle(paymentPayload, paymentRequirements);
  res.json(settleResult);
});

app.get("/supported", (_req, res) => {
  try {
    res.json(facilitator.getSupported());
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

const facilitatorPort = Number(process.env.FACILITATOR_PORT) || 3101;
app.listen(facilitatorPort, () => {
  console.log(`ping-nano facilitator listening on http://localhost:${facilitatorPort}`);
});
