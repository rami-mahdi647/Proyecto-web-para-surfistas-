import Stripe from "stripe";
import { getStore } from "@netlify/blobs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const store = getStore("subs");

export async function handler(event) {
  const sessionId = new URLSearchParams(event.queryStringParameters || {}).get("session_id");
  if (!sessionId) return { statusCode: 400, body: "Missing session_id" };

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer"]
    });

    const email =
      (session.customer_details?.email || session.customer_email || session.customer?.email || "").toLowerCase();

    if (!email) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false, email: null })
      };
    }

    const raw = await store.get(email);
    const info = raw ? JSON.parse(raw) : { active: false };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !!info.active, email })
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
}
