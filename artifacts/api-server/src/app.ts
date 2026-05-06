import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import router from "./routes/index.js";
import { WebhookHandlers } from "./lib/webhookHandlers.js";
import stripeConnectWebhookRouter from "./routes/stripe-connect-webhook.js";

const app: Express = express();
const publicDir = path.resolve(process.cwd(), "artifacts/subtracker/dist/public");

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("[stripe-webhook] Error:", error.message);
      res.status(400).json({ error: "Webhook processing error" });
    }
  }
);

app.use("/api/webhooks/stripe-connect", stripeConnectWebhookRouter);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use(express.static(publicDir));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

export default app;
