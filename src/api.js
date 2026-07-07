/* TalentVault data layer.
   Every function works in two modes:
   — REAL: Firebase Auth + Firestore + Storage + Cloud Functions (Stripe, unlocks)
   — DEMO: in-memory, so `npm run dev` works before you add any keys.  */

import { DEMO, auth, db, storage, functions } from "./firebase";
import {
  GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut as fbSignOut,
  onAuthStateChanged, RecaptchaVerifier, linkWithPhoneNumber,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, collection, onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { SEED_PUBLIC, SEED_CONTACTS } from "./seed";

/* ── DEMO store ─────────────────────────────── */
const demo = {
  user: null,
  userDoc: { plan: null, credits: 0 },
  unlocks: {},
  profiles: [...SEED_PUBLIC],
  contacts: { ...SEED_CONTACTS },
  listeners: { auth: [], userDoc: [], unlocks: [], profiles: [] },
};
const emit = (k) => demo.listeners[k].forEach((cb) => cb());

/* ── Auth ───────────────────────────────────── */
export function onAuth(cb) {
  if (DEMO) {
    const fn = () => cb(demo.user);
    demo.listeners.auth.push(fn);
    cb(demo.user);
    return () => (demo.listeners.auth = demo.listeners.auth.filter((f) => f !== fn));
  }
  return onAuthStateChanged(auth, cb);
}

export async function signInGoogle() {
  if (DEMO) { demo.user = { uid: "demo-uid", displayName: "Demo User", isDemo: true }; emit("auth"); return demo.user; }
  const res = await signInWithPopup(auth, new GoogleAuthProvider());
  await ensureUserDoc(res.user.uid);
  return res.user;
}

export async function signInGuest() {
  if (DEMO) { demo.user = { uid: "demo-uid", displayName: "Guest", isDemo: true }; emit("auth"); return demo.user; }
  const res = await signInAnonymously(auth);
  await ensureUserDoc(res.user.uid);
  return res.user;
}

export async function signOut() {
  if (DEMO) { demo.user = null; emit("auth"); return; }
  await fbSignOut(auth);
}

async function ensureUserDoc(uid) {
  const r = doc(db, "users", uid);
  const snap = await getDoc(r);
  if (!snap.exists()) await setDoc(r, { createdAt: serverTimestamp() });
}

/* ── User doc (plan / credits) + unlocks ───── */
export function onUserDoc(uid, cb) {
  if (DEMO) {
    const fn = () => cb(demo.userDoc);
    demo.listeners.userDoc.push(fn);
    cb(demo.userDoc);
    return () => (demo.listeners.userDoc = demo.listeners.userDoc.filter((f) => f !== fn));
  }
  return onSnapshot(doc(db, "users", uid), (s) => cb(s.data() || {}));
}

export function onUnlocks(uid, cb) {
  if (DEMO) {
    const fn = () => cb({ ...demo.unlocks });
    demo.listeners.unlocks.push(fn);
    cb({ ...demo.unlocks });
    return () => (demo.listeners.unlocks = demo.listeners.unlocks.filter((f) => f !== fn));
  }
  return onSnapshot(collection(db, "users", uid, "unlocks"), (qs) => {
    const out = {};
    qs.forEach((d) => (out[d.id] = true));
    cb(out);
  });
}

/* ── Profiles ───────────────────────────────── */
export function onProfiles(cb) {
  if (DEMO) {
    const fn = () => cb([...demo.profiles]);
    demo.listeners.profiles.push(fn);
    cb([...demo.profiles]);
    return () => (demo.listeners.profiles = demo.listeners.profiles.filter((f) => f !== fn));
  }
  return onSnapshot(collection(db, "profiles"), (qs) => {
    const out = [];
    qs.forEach((d) => out.push({ id: d.id, ...d.data() }));
    cb(out);
  });
}

/** Upload a media blob (voice/video/resume/portfolio) → download URL. */
export async function uploadMedia(uid, kind, blob) {
  if (DEMO) return URL.createObjectURL(blob);
  const ext = kind === "resume" || kind === "portfolio" ? "" : ".webm";
  const r = ref(storage, `media/${uid}/${kind}${ext ? ext : "-" + (blob.name || "file")}`);
  await uploadBytes(r, blob);
  return getDownloadURL(r);
}

/** Publish: public profile (anonymous) + private contact doc. */
export async function publishProfile(uid, publicData, contact) {
  if (DEMO) {
    demo.profiles = demo.profiles.filter((p) => p.id !== uid);
    demo.profiles.unshift({ id: uid, mine: true, ...publicData });
    demo.contacts[uid] = contact;
    emit("profiles");
    return;
  }
  await setDoc(doc(db, "profiles", uid), { ...publicData, updatedAt: serverTimestamp() });
  await setDoc(doc(db, "profiles", uid, "private", "contact"), contact);
}

/** Read a candidate's private contact — Firestore rules only allow this
    for the owner, or an employer with an unlock, or a growth/enterprise plan. */
export async function getContact(pid) {
  if (DEMO) return demo.contacts[pid] || null;
  const s = await getDoc(doc(db, "profiles", pid, "private", "contact"));
  return s.exists() ? s.data() : null;
}

/* ── Billing + unlocks (server-enforced) ───── */
export async function startCheckout(tier) {
  if (DEMO) {
    demo.userDoc = { plan: tier, credits: tier === "starter" ? 20 : null };
    emit("userDoc");
    return { demo: true };
  }
  const fn = httpsCallable(functions, "createCheckoutSession");
  const res = await fn({ tier, successUrl: window.location.origin + "/?paid=1", cancelUrl: window.location.origin });
  window.location.href = res.data.url; // → Stripe Checkout
  return res.data;
}

export async function unlockCandidate(pid) {
  if (DEMO) {
    const d = demo.userDoc;
    if (!d.plan) throw new Error("Subscribe first");
    if (d.plan === "starter") {
      if ((d.credits || 0) <= 0) throw new Error("No credits left — upgrade to Growth");
      d.credits -= 1;
    }
    demo.unlocks[pid] = true;
    emit("userDoc"); emit("unlocks");
    return;
  }
  const fn = httpsCallable(functions, "unlockCandidate");
  await fn({ candidateId: pid });
}

/* ── Phone verification (Firebase Phone Auth) ── */
export async function startPhoneVerify(phone) {
  if (DEMO) return { confirm: async () => true, demo: true };
  if (!window.__tvRecaptcha) {
    window.__tvRecaptcha = new RecaptchaVerifier(auth, "recaptcha-anchor", { size: "invisible" });
  }
  const confirmation = await linkWithPhoneNumber(auth.currentUser, phone, window.__tvRecaptcha);
  return { confirm: async (code) => { await confirmation.confirm(code); return true; } };
}
