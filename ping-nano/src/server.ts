/**
 * ping-nano Resource Server
 *
 * A minimal bare Express server with an x402 402 paywall settled on Nano (XNO).
 * Requests to a protected path receive a 402 "Payment Required" envelope; when a
 * client supplies a valid Nano payment payload the resource is served.
 *
 * This is a thin reuse of the published x402 stack (no payment logic rebuilt):
 *   - @x402/core/server  exports x402ResourceServer + HTTPFacilitatorClient
 *   - @x402nano/exact    supplies the ExactNanoScheme for nano:mainnet
 *   - @x402nano/helper   drives Nano RPC communication (in the facilitator)
 */
import express from "express";
import { x402ResourceServer, HTTPFacilitatorClient, type ResourceConfig } from "@x402/core/server";
import { ExactNanoScheme } from "@x402nano/exact/server";
import "dotenv/config";

const RESOURCE_PATH = process.env.RESOURCE_PATH || "/ping";
const PAYMENT_REQUIREMENT_AMOUNT = process.env.PAYMENT_REQUIREMENT_AMOUNT || "0.001";
const PAYMENT_REQUIREMENT_PAY_TO = process.env.PAYMENT_REQUIREMENT_PAY_TO || "";
const RESOURCE_SERVER_PORT = Number(process.env.RESOURCE_SERVER_PORT) || 3100;
const FACILITATOR_PORT = Number(process.env.FACILITATOR_PORT) || 3101;

const endpointConfigs: Record<string, ResourceConfig> = {
  [`GET ${RESOURCE_PATH}`]: {
    scheme: "exact",
    network: "nano:mainnet",
    // price: a fixed Nano amount; the exact scheme parses XNO to raw units
    price: PAYMENT_REQUIREMENT_AMOUNT,
    payTo: PAYMENT_REQUIREMENT_PAY_TO,
  },
};

const facilitator = new HTTPFacilitatorClient({
  url: `http://localhost:${FACILITATOR_PORT}`,
});
const resourceServer = new x402ResourceServer(facilitator);
const exactNanoScheme = new ExactNanoScheme();
resourceServer.register("nano:mainnet", exactNanoScheme);

resourceServer
  .onBeforeVerify(async (_ctx) => console.log("Verifying payment..."))
  .onAfterVerify(async (ctx) => console.log("Verified:", ctx.result))
  .onVerifyFailure(async (ctx) => console.log("Verification failed:", ctx))
  .onBeforeSettle(async (_ctx) => console.log("Settling payment..."))
  .onAfterSettle(async (ctx) => {
    if (ctx.result.success) console.log(`Settled (hash: ${ctx.result.transaction})`);
    else console.log(`Settlement failed: ${ctx.result.errorReason}`);
  })
  .onSettleFailure(async (_ctx) => console.log("Settlement failed"));

async function resourceServerMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const endpointKey = `${req.method} ${req.path}`;
  const endpointConfig = endpointConfigs[endpointKey];
  if (!endpointConfig) return next();

  const paymentRequirements = (await resourceServer.buildPaymentRequirements(endpointConfig))[0];

  const paymentHeader =
    req.headers["payment-signature"] ||
    req.headers["PAYMENT-SIGNATURE"] ||
    req.headers["x-payment"];

  if (!paymentHeader) {
    const paymentRequired = await resourceServer.createPaymentRequiredResponse(
      [paymentRequirements],
      {
        url: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        description: "Resource to pay for",
        mimeType: "application/json",
      }
    );
    const paymentRequiredHeader = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");

    res.status(402);
    res.set("PAYMENT-REQUIRED", paymentRequiredHeader);
    res.json({ error: "Payment Required", message: "This endpoint requires payment" });
    return;
  }

  try {
    const paymentPayload = JSON.parse(Buffer.from(String(paymentHeader), "base64").toString("utf-8"));
    const verifyResult = await resourceServer.verifyPayment(paymentPayload, paymentRequirements);
    if (!verifyResult.isValid) {
      res.status(402).json({ error: "Invalid Payment", reason: verifyResult.invalidReason });
      return;
    }
    const settleResult = await resourceServer.settlePayment(paymentPayload, paymentRequirements);
    if (!settleResult.success) {
      res.status(402).json({ error: "Invalid Payment", reason: settleResult.errorReason });
      return;
    }
    res.set("PAYMENT-RESPONSE", Buffer.from(JSON.stringify(settleResult)).toString("base64"));
    next();
  } catch (error) {
    res.status(500).json({
      error: "Payment Processing Error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

const app = express();
app.use(resourceServerMiddleware);

app.get(RESOURCE_PATH, (_req, res) => {
  res.json({ message: "pong" });
});

(async function () {
  try {
    await resourceServer.initialize();
    app.listen(RESOURCE_SERVER_PORT, () => {
      console.log(`ping-nano server listening on http://localhost:${RESOURCE_SERVER_PORT}`);
    });
  } catch (error) {
    console.error(error);
  }
})();
