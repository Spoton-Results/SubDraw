import { getUncachableStripeClient } from "./stripeClient.js";

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();
    console.log("Connected to Stripe...");

    const existing = await stripe.products.search({
      query: "name:'SubTracker Pro' AND active:'true'",
    });

    if (existing.data.length > 0) {
      console.log("SubTracker Pro product already exists:", existing.data[0].id);
      const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
      console.log("Existing prices:", prices.data.map(p => `${p.id} — $${(p.unit_amount ?? 0) / 100}/${(p.recurring as any)?.interval}`).join(", "));
      return;
    }

    const product = await stripe.products.create({
      name: "SubTracker Pro",
      description: "Unlimited projects, subcontractors, and full invoice management for General Contractors.",
    });
    console.log("Created product:", product.id);

    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 4900,
      currency: "usd",
      recurring: { interval: "month" },
    });
    console.log("Created monthly price:", monthlyPrice.id, "— $49.00/month");

    console.log("\n✓ Done! SubTracker Pro is ready in Stripe.");
  } catch (err: any) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

createProducts();
