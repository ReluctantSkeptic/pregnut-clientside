// Cloudflare Pages Function: POST /api/contact
//
// Zero-cost contact form handler. Nothing here contains the site owner's
// address; delivery settings come only from Pages environment secrets:
//   CONTACT_TO        destination address (must be a verified Email Routing
//                     destination, which keeps sending free on Workers Free)
//   CONTACT_FROM      sender on an onboarded domain, e.g. contact@pregnut.com
//   CF_ACCOUNT_ID     Cloudflare account id
//   CF_EMAIL_TOKEN    API token limited to Email Sending
// Optional binding:
//   CONTACT_LOG       Workers Analytics Engine dataset; every accepted
//                     submission is written here first so none are lost
//                     while email delivery is being set up.

const LIMITS = { name: 100, email: 200, topic: 60, message: 3000 };
const RATE_WINDOW_SECONDS = 3600;
const RATE_MAX = 5;
const MIN_FILL_MS = 3000;
const TOPICS = new Set(["General question", "Correction or source issue", "Privacy request", "Other"]);
const memoryHits = new Map();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

function clean(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function oneLine(value) {
  return value.replace(/[\r\n]+/g, " ");
}

function truncateBytes(value, maxBytes) {
  const encoder = new TextEncoder();
  if (encoder.encode(value).length <= maxBytes) return value;
  let out = value;
  while (out.length && encoder.encode(out).length > maxBytes) out = out.slice(0, -50);
  return out;
}

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function rateLimited(ip) {
  const key = await sha256(`pregnut-contact:${ip}`);
  const now = Date.now();

  // Per-isolate memory (always available).
  const recent = (memoryHits.get(key) || []).filter((t) => now - t < RATE_WINDOW_SECONDS * 1000);
  recent.push(now);
  memoryHits.set(key, recent);
  if (memoryHits.size > 5000) memoryHits.clear();
  if (recent.length > RATE_MAX) return true;

  // Per-data-center counter in the free Cache API (best effort).
  try {
    const cache = caches.default;
    const cacheKey = new Request(`https://pregnut-contact-rate.invalid/${key}`);
    const hit = await cache.match(cacheKey);
    const count = hit ? Number(await hit.text()) || 0 : 0;
    if (count >= RATE_MAX) return true;
    await cache.put(
      cacheKey,
      new Response(String(count + 1), { headers: { "cache-control": `max-age=${RATE_WINDOW_SECONDS}` } }),
    );
  } catch (_) {
    // Cache API unavailable here; the memory counter still applies.
  }
  return false;
}

async function readBody(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return await request.json();
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

async function sendEmail(env, entry) {
  if (!env.CF_EMAIL_TOKEN || !env.CONTACT_TO || !env.CONTACT_FROM || !env.CF_ACCOUNT_ID) {
    return { attempted: false };
  }
  const subject = oneLine(`PregNut contact: ${entry.topic}${entry.name ? ` from ${entry.name}` : ""}`).slice(0, 180);
  const text = [
    `New message from the PregNut contact form (${entry.id})`,
    "",
    `Name: ${entry.name || "(not given)"}`,
    `Email: ${entry.email}`,
    `Topic: ${entry.topic}`,
    `Page: ${entry.page || "/contact/"}`,
    `Received: ${entry.receivedAt}`,
    "",
    entry.message,
    "",
    "Reply to this email to answer the sender directly.",
  ].join("\n");

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${env.CF_EMAIL_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({
        to: env.CONTACT_TO,
        from: env.CONTACT_FROM,
        reply_to: entry.email,
        subject,
        text,
        headers: { "X-PregNut-Contact-Id": entry.id },
      }),
    },
  );
  let data = null;
  try { data = await response.json(); } catch (_) {}
  const ok = response.ok && data && data.success !== false;
  return { attempted: true, ok, status: response.status, errors: data && data.errors };
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== url.host) {
    return json({ ok: false, error: "Please send the form from the PregNut contact page." }, 403);
  }

  let body;
  try {
    body = await readBody(request);
  } catch (_) {
    return json({ ok: false, error: "The form could not be read. Please try again." }, 400);
  }

  // Honeypot and timing checks: quietly accept and drop obvious bots.
  const startedAt = Number(body.started_at);
  if (clean(body.website, 200) || !Number.isFinite(startedAt) || Date.now() - startedAt < MIN_FILL_MS) {
    return json({ ok: true });
  }

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (await rateLimited(ip)) {
    return json({ ok: false, error: "Too many messages from this connection. Please try again in an hour." }, 429);
  }

  const name = oneLine(clean(body.name, LIMITS.name));
  const email = oneLine(clean(body.email, LIMITS.email));
  const topicRaw = oneLine(clean(body.topic, LIMITS.topic));
  const topic = TOPICS.has(topicRaw) ? topicRaw : "General question";
  const message = clean(body.message, LIMITS.message);
  const page = oneLine(clean(body.page, 200));

  const problems = [];
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[A-Za-z]{2,}$/.test(email)) problems.push("Enter a valid email address so we can reply.");
  if (message.length < 10) problems.push("Write a message of at least 10 characters.");
  if (problems.length) return json({ ok: false, error: problems.join(" ") }, 400);

  const entry = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    name,
    email,
    topic,
    message,
    page,
    country: (request.cf && request.cf.country) || "",
    host: url.host,
  };

  let stored = false;
  if (env.CONTACT_LOG && typeof env.CONTACT_LOG.writeDataPoint === "function") {
    try {
      env.CONTACT_LOG.writeDataPoint({
        indexes: [entry.id],
        blobs: [
          entry.receivedAt,
          entry.host,
          entry.topic,
          entry.name,
          entry.email,
          entry.page,
          entry.country,
          truncateBytes(entry.message, 12000),
        ],
        doubles: [1],
      });
      stored = true;
    } catch (error) {
      console.error("contact: store failed", error && error.message);
    }
  }

  let mail = { attempted: false };
  try {
    mail = await sendEmail(env, entry);
    if (mail.attempted && !mail.ok) console.error("contact: email failed", mail.status, JSON.stringify(mail.errors || []));
  } catch (error) {
    mail = { attempted: true, ok: false };
    console.error("contact: email error", error && error.message);
  }

  if (!stored && !(mail.attempted && mail.ok)) {
    return json({ ok: false, error: "Sorry, the message could not be delivered right now. Please try again later." }, 503);
  }
  console.log("contact: accepted", entry.id, `stored=${stored}`, `emailed=${Boolean(mail.ok)}`);
  return json({ ok: true, id: entry.id });
}

export function onRequest() {
  return json({ ok: false, error: "Use POST." }, 405);
}
