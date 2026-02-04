import { getStore } from "@netlify/blobs";

const store = getStore("subs");

export async function handler(event) {
  const email = (event.queryStringParameters?.email || "").toLowerCase().trim();
  if (!email) return { statusCode: 400, body: "Missing email" };

  try {
    const raw = await store.get(email);
    const info = raw ? JSON.parse(raw) : { active: false };
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !!info.active, ...info })
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
}
