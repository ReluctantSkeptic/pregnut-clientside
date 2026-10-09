// Cloudflare Pages Function: POST /api/contact
//
// Zero-cost contact form handler. Nothing here contains the site owner's
// address; delivery settings come only from Pages environment variables:
//   CONTACT_TO        destination address (encrypted Pages secret). Used
//                     server-side only, so it never reaches the browser.
//   FORMSUBMIT_ID     optional FormSubmit alias token. Once set, it is used
//                     instead of CONTACT_TO in the FormSubmit URL.
// Optional binding:
//   CONTACT_LOG       Workers Analytics Engine dataset; every accepted
//                     submission is written here first as a backup.
//
// Delivery: the function forwards each accepted submission to FormSubmit's
// free AJAX endpoint (https://formsubmit.co/ajax/<address-or-alias>), which
// emails it to the owner. FormSubmit needs a one-time "Activate Form" click
// in the destination inbox; activation is tied to the form URL, so the
// Referer below is always the production contact page, even on previews.

const FORMSUBMIT_FORM_URL = "https://pregnut.com/contact/";
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
  const target = clean(env.FORMSUBMIT_ID || env.CONTACT_TO, 200);
  if (!target) return { attempted: false };
  const subject = oneLine(`PregNut contact: ${entry.topic}${entry.name ? ` from ${entry.name}` : ""}`).slice(0, 180);

  const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(target)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      origin: new URL(FORMSUBMIT_FORM_URL).origin,
      referer: FORMSUBMIT_FORM_URL,
      "user-agent": "Mozilla/5.0 (compatible; PregNutContact/1.0; +https://pregnut.com/contact/)",
    },
    body: JSON.stringify({
      _subject: subject,
      _replyto: entry.email,
      _template: "box",
      _captcha: "false",
      Name: entry.name || "(not given)",
      Email: entry.email,
      Topic: entry.topic,
      Message: entry.message,
      Page: entry.page || "/contact/",
      Received: entry.receivedAt,
      Reference: entry.id,
    }),
  });
  let data = null;
  try { data = await response.json(); } catch (_) {}
  const ok = response.ok && data && String(data.success) === "true";
  return { attempted: true, ok, status: response.status, message: data && data.message };
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
    if (mail.attempted && !mail.ok) console.error("contact: email failed", mail.status, String(mail.message || "").slice(0, 200));
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
