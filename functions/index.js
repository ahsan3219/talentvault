/* TalentVault Cloud Functions
   — createCheckoutSession: opens Stripe Checkout for a tier
   — stripeWebhook: grants plan + credits after payment (source of truth)
   — unlockCandidate: server-enforced unlock; decrements Starter credits in a transaction
   Secrets (set with `firebase functions:secrets:set`):
   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_STARTER, STRIPE_PRICE_GROWTH */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();
const db = admin.firestore();

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const STRIPE_PRICE_STARTER = defineSecret("STRIPE_PRICE_STARTER");
const STRIPE_PRICE_GROWTH = defineSecret("STRIPE_PRICE_GROWTH");

exports.createCheckoutSession = onCall(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_PRICE_STARTER, STRIPE_PRICE_GROWTH] },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first");

    const tier = req.data?.tier;
    const prices = {
      starter: STRIPE_PRICE_STARTER.value(),
      growth: STRIPE_PRICE_GROWTH.value(),
    };
    if (!prices[tier]) throw new HttpsError("invalid-argument", "Unknown tier");

    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: prices[tier], quantity: 1 }],
      success_url: req.data.successUrl || "https://example.com/?paid=1",
      cancel_url: req.data.cancelUrl || "https://example.com/",
      metadata: { uid, tier },
    });
    return { url: session.url };
  }
);

exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        req.headers["stripe-signature"],
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (e) {
      res.status(400).send(`Webhook error: ${e.message}`);
      return;
    }

    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      const { uid, tier } = s.metadata || {};
      if (uid && tier) {
        await db.doc(`users/${uid}`).set(
          {
            plan: tier,
            credits: tier === "starter" ? 20 : null,
            stripeCustomerId: s.customer || null,
            planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const q = await db.collection("users").where("stripeCustomerId", "==", sub.customer).get();
      for (const d of q.docs) {
        await d.ref.set({ plan: null, credits: 0 }, { merge: true });
      }
    }

    res.json({ received: true });
  }
);

exports.unlockCandidate = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first");
  const candidateId = req.data?.candidateId;
  if (!candidateId) throw new HttpsError("invalid-argument", "candidateId required");

  const userRef = db.doc(`users/${uid}`);
  await db.runTransaction(async (tx) => {
    const u = await tx.get(userRef);
    const plan = u.get("plan");
    if (!plan) throw new HttpsError("failed-precondition", "Subscribe first");

    const already = await tx.get(db.doc(`users/${uid}/unlocks/${candidateId}`));
    if (already.exists) return; // idempotent — never double-charge a credit

    if (plan === "starter") {
      const credits = u.get("credits") || 0;
      if (credits <= 0) throw new HttpsError("resource-exhausted", "No credits left — upgrade to Growth");
      tx.update(userRef, { credits: credits - 1 });
    }
    tx.set(db.doc(`users/${uid}/unlocks/${candidateId}`), {
      at: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});
