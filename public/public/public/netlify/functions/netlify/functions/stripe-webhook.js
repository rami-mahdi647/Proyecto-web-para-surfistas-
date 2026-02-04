import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Netlify Blob (persistencia simple sin DB)
import { getStore } from "@netlify/blobs";

// Usamos una store llamada "subs"
const store = getStore("subs");

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const sig = event.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    // Necesitamos el raw body; Netlify lo deja en event.body
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    // Marcamos como activo cuando:
    // - checkout.session.completed
    // - customer.subscription.updated/created (status active/trialing)
    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;
      const email = (session.customer_details?.email || session.customer_email || "").toLowerCase();
      if (email) {
        await store.set(email, JSON.stringify({ active: true, updatedAt: Date.now() }));
      }
    }

    if (
      stripeEvent.type === "customer.subscription.created" ||
      stripeEvent.type === "customer.subscription.updated"
    ) {
      const sub = stripeEvent.data.object;
      const status = sub.status; // active, canceled, past_due, unpaid, trialing...
      const customerId = sub.customer;

      // Buscar email del customer
      const customer = await stripe.customers.retrieve(customerId);
      const email = (customer.email || "").toLowerCase();
      if (email) {
        const active = status === "active" || status === "trialing";
        await store.set(email, JSON.stringify({ active, updatedAt: Date.now(), status }));
      }
    }

    if (stripeEvent.type === "customer.subscription.deleted") {
      const sub = stripeEvent.data.object;
      const customerId = sub.customer;
      const customer = await stripe.customers.retrieve(customerId);
      const email = (customer.email || "").toLowerCase();
      if (email) {
        await store.set(email, JSON.stringify({ active: false, updatedAt: Date.now(), status: "deleted" }));
      }
    }

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
}
