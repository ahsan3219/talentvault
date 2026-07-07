import { useState, useEffect } from "react";
import {
  T, font, Slate, Btn, Field, RecDot, Verified, Recorder, MonitorCard, Pricing,
  BANDS, bandOf, PIPELINE, anon, validEmail,
} from "./components.jsx";
import {
  DEMOFLAG, onAuth, signInGoogle, signInGuest, signOut, onUserDoc, onUnlocks,
  onProfiles, uploadMedia, publishProfile, getContact, startCheckout,
  unlockCandidate, startPhoneVerify,
} from "./api-facade.js";

export default function App() {
  const [view, setView] = useState("landing");
  const [authFor, setAuthFor] = useState("candidate");
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState({});
  const [unlocks, setUnlocks] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [contacts, setContacts] = useState({});
  const [showPricing, setShowPricing] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [shortlist, setShortlist] = useState({});
  const [stages, setStages] = useState({});
  const [playing, setPlaying] = useState(null);
  const [toast, setToast] = useState(null);
  const [publishing, setPublishing] = useState(false);

  const [step, setStep] = useState(0);
  const [p, setP] = useState({
    name: "", email: "", phone: "", headline: "", skills: "", salary: "", availability: "", languages: "",
    neighbourhood: "", city: "", province: "", country: "",
    resumeFile: null, portfolioFile: null, portfolioLink: "",
    voice: null, video: null,      // { url, blob }
    consent: false, verified: false, published: false,
  });
  const set = (k) => (v) => setP((prev) => ({ ...prev, [k]: v }));

  const [q, setQ] = useState("");
  const [fCountry, setFCountry] = useState("All");
  const [fBand, setFBand] = useState("All");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyShort, setOnlyShort] = useState(false);

  const pop = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  /* subscriptions */
  useEffect(() => onAuth(setUser), []);
  useEffect(() => { if (!user) return; return onUserDoc(user.uid, setUserDoc); }, [user]);
  useEffect(() => { if (!user) return; return onUnlocks(user.uid, setUnlocks); }, [user]);
  useEffect(() => onProfiles(setProfiles), []);

  /* fetch contacts lazily whenever a new unlock appears */
  useEffect(() => {
    Object.keys(unlocks).forEach(async (pid) => {
      if (!contacts[pid]) {
        try {
          const c = await getContact(pid);
          if (c) setContacts((prev) => ({ ...prev, [pid]: c }));
        } catch { /* rules denied — ignore */ }
      }
    });
  }, [unlocks]); // eslint-disable-line

  const plan = userDoc.plan || null;
  const credits = userDoc.credits ?? 0;

  const completeness = (() => {
    const checks = [p.name, validEmail(p.email), p.phone, p.headline, p.neighbourhood, p.city, p.country, p.resumeFile, p.voice, p.video];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  })();

  const publishBlockers = [];
  if (!p.name) publishBlockers.push("name");
  if (!validEmail(p.email)) publishBlockers.push("valid email");
  if (!p.phone) publishBlockers.push("phone");
  if (!p.city || !p.country) publishBlockers.push("city & country");
  if (!p.resumeFile) publishBlockers.push("resume");
  if (!p.voice && !p.video) publishBlockers.push("voice or video");
  if (!p.consent) publishBlockers.push("privacy consent");

  const doPublish = async () => {
    if (!user) { setAuthFor("candidate"); setView("auth"); return; }
    setPublishing(true);
    try {
      const [voiceUrl, videoUrl, resumeUrl] = await Promise.all([
        p.voice?.blob ? uploadMedia(user.uid, "voice", p.voice.blob) : Promise.resolve(p.voice?.url || null),
        p.video?.blob ? uploadMedia(user.uid, "video", p.video.blob) : Promise.resolve(p.video?.url || null),
        p.resumeFile ? uploadMedia(user.uid, "resume", p.resumeFile) : Promise.resolve(null),
      ]);
      const pub = {
        anonName: anon(p.name), verified: p.verified, headline: p.headline,
        skills: p.skills.split(",").map((s) => s.trim()).filter(Boolean),
        neighbourhood: p.neighbourhood, city: p.city, province: p.province, country: p.country,
        usd: parseInt(String(p.salary).replace(/[^0-9]/g, ""), 10) || 0,
        availability: p.availability, languages: p.languages.split(",").map((s) => s.trim()).filter(Boolean),
        voiceUrl, videoUrl, exp: "",
      };
      const contact = {
        fullName: p.name, email: p.email, phone: p.phone,
        portfolio: p.portfolioLink || (p.portfolioFile ? "portfolio file on record" : ""),
        resumeUrl,
      };
      await publishProfile(user.uid, pub, contact);
      set("published")(true);
      pop("Profile published — visible to employers");
    } catch (e) {
      pop("Publish failed: " + (e.message || "try again"));
    } finally {
      setPublishing(false);
    }
  };

  const doVerifyPhone = async () => {
    try {
      const v = await startPhoneVerify(p.phone);
      if (v.demo) { set("verified")(true); pop("Phone verified — badge added (demo)"); return; }
      const code = window.prompt("Enter the SMS code we sent to " + p.phone);
      if (code) { await v.confirm(code); set("verified")(true); pop("Phone verified — badge added"); }
    } catch (e) { pop("Verification failed: " + (e.message || "try again")); }
  };

  const tryUnlock = async (pid) => {
    if (!user) { setAuthFor("employer"); setView("auth"); return; }
    if (!plan) { setShowPricing(true); return; }
    try {
      await unlockCandidate(pid);
      pop(plan === "starter" ? "Unlocked — 1 credit used" : "Unlocked — full identity revealed");
    } catch (e) { pop(e.message || "Unlock failed"); if (String(e.message).includes("credit")) setShowPricing(true); }
  };

  const subscribe = async (tier) => {
    if (!user) { setShowPricing(false); setAuthFor("employer"); setView("auth"); return; }
    if (tier === "enterprise") { pop("Enterprise — email sales@talentvault.app"); return; }
    setCheckoutBusy(true);
    try {
      const res = await startCheckout(tier);
      if (res?.demo) { setShowPricing(false); pop(tier === "starter" ? "Starter active — 20 unlock credits (demo)" : "Growth active — unlimited unlocks (demo)"); }
      /* real mode: browser redirects to Stripe Checkout */
    } catch (e) { pop("Checkout failed: " + (e.message || "try again")); }
    finally { setCheckoutBusy(false); }
  };

  /* employer list: verified first, mine pinned */
  const mineFirst = (a, b) => (b.mine === true) - (a.mine === true) || (b.verified === true) - (a.verified === true);
  const withMine = profiles.map((c) => ({ ...c, mine: user && c.id === user.uid }));
  const countries = ["All", ...new Set(withMine.map((c) => c.country).filter(Boolean))];
  const filtered = withMine.sort(mineFirst).filter((c) => {
    const hay = `${c.anonName} ${c.headline} ${(c.skills || []).join(" ")} ${c.city} ${c.neighbourhood} ${c.country}`.toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (fCountry !== "All" && c.country !== fCountry) return false;
    if (fBand !== "All" && bandOf(c.usd || 0) !== fBand) return false;
    if (onlyVerified && !c.verified) return false;
    if (onlyShort && !shortlist[c.id]) return false;
    return true;
  });

  const steps = ["Details", "Location", "Media", "Review"];

  return (
    <div style={{ minHeight: "100vh", background: T.paper, fontFamily: font.body, color: T.ink }}>
      <style>{`
        @keyframes tvPulse { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes tvProgress { from{width:0} to{width:100%} }
        * { box-sizing: border-box; }
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${T.amber}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>
      <div id="recaptcha-anchor" />

      {/* nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1.5px solid ${T.line}`, background: T.white, position: "sticky", top: 0, zIndex: 20, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setView("landing")}>
          <div style={{ width: 26, height: 26, background: T.monitor, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.rec }} />
          </div>
          <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 19 }}>TalentVault</span>
          {DEMOFLAG && <Slate style={{ color: T.amberDark }}>DEMO MODE</Slate>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {user && (
            <>
              <Btn small kind={view === "candidate" ? "dark" : "ghost"} onClick={() => setView("candidate")}>Candidate</Btn>
              <Btn small kind={view === "employer" ? "dark" : "ghost"} onClick={() => setView("employer")}>Employer</Btn>
            </>
          )}
          {plan === "starter" && <Slate style={{ color: T.amberDark }}>STARTER · {credits} CREDITS</Slate>}
          {(plan === "growth" || plan === "enterprise") && <Slate style={{ color: T.ok }}>● {plan.toUpperCase()}</Slate>}
          {user && <Btn small kind="ghost" onClick={() => { signOut(); setView("landing"); }}>Sign out</Btn>}
        </div>
      </div>

      {/* LANDING */}
      {view === "landing" && (
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "56px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 40, alignItems: "center" }}>
          <div>
            <Slate style={{ color: T.amberDark }}>THE AUDITION-FIRST TALENT MARKET</Slate>
            <h1 style={{ fontFamily: font.display, fontWeight: 800, fontSize: "clamp(34px, 6vw, 56px)", lineHeight: 1.05, margin: "14px 0 16px" }}>
              Hear them.<br />See them.<br /><span style={{ color: T.amberDark }}>Then hire them.</span>
            </h1>
            <p style={{ fontSize: 16.5, color: T.inkSoft, lineHeight: 1.6, maxWidth: 440 }}>
              Every candidate arrives with a voice intro and a video presentation — anonymous until you subscribe, searchable down to the neighbourhood, anywhere in the world.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
              <Btn onClick={() => { setAuthFor("candidate"); user ? setView("candidate") : setView("auth"); }}>I'm a candidate</Btn>
              <Btn kind="dark" onClick={() => { setAuthFor("employer"); user ? setView("employer") : setView("auth"); }}>I'm hiring</Btn>
            </div>
          </div>
          <div style={{ background: T.monitor, borderRadius: 18, border: `1px solid ${T.monitorEdge}`, aspectRatio: "4/3", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 24px 60px rgba(14,17,22,.28)" }}>
            <div style={{ fontFamily: font.display, fontWeight: 800, fontSize: 64, color: "#2C3540" }}>A—</div>
            <div style={{ position: "absolute", top: 14, left: 16 }}><Slate style={{ color: T.rec }}><RecDot live />REC · AUDITION 0142</Slate></div>
            <div style={{ position: "absolute", bottom: 14, left: 16, right: 16, display: "flex", justifyContent: "space-between" }}>
              <Slate style={{ color: "#8B95A0" }}>GULSHAN-E-IQBAL · KARACHI</Slate>
              <Slate style={{ color: "#8B95A0" }}>02:14</Slate>
            </div>
          </div>
        </div>
      )}

      {/* AUTH */}
      {view === "auth" && (
        <div style={{ maxWidth: 400, margin: "60px auto", padding: "0 20px" }}>
          <div style={{ background: T.white, border: `1.5px solid ${T.line}`, borderRadius: 16, padding: 28 }}>
            <div style={{ fontFamily: font.display, fontWeight: 800, fontSize: 24, marginBottom: 6 }}>
              {authFor === "candidate" ? "Create your audition" : "Start hiring"}
            </div>
            <p style={{ fontSize: 14, color: T.inkSoft, marginBottom: 20 }}>
              {authFor === "candidate" ? "One profile. Your voice, your video, your work — anonymous until an employer subscribes." : "Preview every audition free. Pay only to reach out."}
            </p>
            <Btn style={{ width: "100%", marginBottom: 10 }} kind="dark"
              onClick={async () => { try { await signInGoogle(); setView(authFor); } catch (e) { pop("Sign-in failed: " + (e.message || "")); } }}>
              Continue with Google
            </Btn>
            <Btn style={{ width: "100%" }} kind="ghost"
              onClick={async () => { try { await signInGuest(); setView(authFor); } catch (e) { pop("Sign-in failed: " + (e.message || "")); } }}>
              Continue as guest
            </Btn>
            {DEMOFLAG && <div style={{ marginTop: 16, textAlign: "center" }}><Slate>Demo mode — add Firebase keys for real auth</Slate></div>}
          </div>
        </div>
      )}

      {/* CANDIDATE */}
      {view === "candidate" && (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px 80px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
            <h2 style={{ fontFamily: font.display, fontWeight: 800, fontSize: 28, margin: 0 }}>Your audition profile</h2>
            <Slate style={{ color: completeness === 100 ? T.ok : T.amberDark }}>{completeness}% COMPLETE</Slate>
          </div>
          <div style={{ height: 6, background: T.line, borderRadius: 3, marginBottom: 22 }}>
            <div style={{ height: "100%", width: `${completeness}%`, background: completeness === 100 ? T.ok : T.amber, borderRadius: 3, transition: "width .3s" }} />
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
            {steps.map((s, i) => (
              <button key={s} onClick={() => setStep(i)} style={{ fontFamily: font.mono, fontSize: 11.5, letterSpacing: ".05em", padding: "7px 12px", borderRadius: 7, border: `1.5px solid ${i === step ? T.ink : T.line}`, background: i === step ? T.ink : T.white, color: i === step ? T.paper : T.inkSoft, cursor: "pointer" }}>
                {String(i + 1).padStart(2, "0")} {s.toUpperCase()}
              </button>
            ))}
          </div>

          <div style={{ background: T.white, border: `1.5px solid ${T.line}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            {step === 0 && (
              <>
                <Field label="Full name" required value={p.name} onChange={set("name")} placeholder="e.g. Nadeem Khan" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                  <Field label="Email" required type="email" value={p.email} onChange={set("email")} placeholder="you@example.com" error={p.email && !validEmail(p.email) ? "Enter a valid email" : ""} />
                  <div>
                    <Field label="Phone / WhatsApp" required value={p.phone} onChange={set("phone")} placeholder="+1 …" />
                    {p.phone && !p.verified && (
                      <button onClick={doVerifyPhone}
                        style={{ marginTop: 6, background: "none", border: "none", cursor: "pointer", fontFamily: font.body, fontSize: 13, fontWeight: 600, color: T.amberDark, padding: 0 }}>
                        Verify phone → get the ✓ badge
                      </button>
                    )}
                    {p.verified && <span style={{ display: "inline-block", marginTop: 6, fontFamily: font.mono, fontSize: 11, color: T.ok }}>✓ VERIFIED</span>}
                  </div>
                </div>
                <Field label="Headline" required value={p.headline} onChange={set("headline")} placeholder="e.g. Senior React Developer" />
                <Field label="Skills (comma separated)" value={p.skills} onChange={set("skills")} placeholder="React, Node.js, Figma" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
                  <Field label="Expected salary (USD/mo)" value={p.salary} onChange={set("salary")} placeholder="e.g. 4000" />
                  <Field label="Availability" value={p.availability} onChange={set("availability")} placeholder="Immediate / 2 weeks" />
                  <Field label="Languages" value={p.languages} onChange={set("languages")} placeholder="English, Urdu" />
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                  <Field label="Neighbourhood" value={p.neighbourhood} onChange={set("neighbourhood")} placeholder="e.g. Leslieville" />
                  <Field label="City" required value={p.city} onChange={set("city")} placeholder="e.g. Toronto" />
                  <Field label="Province / State" value={p.province} onChange={set("province")} placeholder="e.g. Ontario" />
                  <Field label="Country" required value={p.country} onChange={set("country")} placeholder="e.g. Canada" />
                </div>
                <div style={{ background: T.paper, borderRadius: 10, padding: 14, fontSize: 13.5, color: T.inkSoft }}>
                  Neighbourhood-level search is how nearby employers find you first — most job boards stop at the city.
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <Slate>Resume (PDF) *</Slate>
                  <label style={{ display: "block", marginTop: 8, border: `2px dashed ${p.resumeFile ? T.ok : T.line}`, borderRadius: 10, padding: 18, textAlign: "center", cursor: "pointer", fontSize: 14, color: T.inkSoft }}>
                    {p.resumeFile ? `✓ ${p.resumeFile.name}` : "Tap to upload your resume"}
                    <input type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} onChange={(e) => set("resumeFile")(e.target.files?.[0] || null)} />
                  </label>
                  {p.resumeFile && <div style={{ marginTop: 6, fontSize: 12.5, color: T.inkSoft }}>Your resume stays private — employers get it only after unlocking you.</div>}
                </div>
                <div>
                  <Slate>Portfolio — file or link (revealed only after unlock)</Slate>
                  <label style={{ display: "block", margin: "8px 0", border: `2px dashed ${p.portfolioFile ? T.ok : T.line}`, borderRadius: 10, padding: 14, textAlign: "center", cursor: "pointer", fontSize: 14, color: T.inkSoft }}>
                    {p.portfolioFile ? `✓ ${p.portfolioFile.name}` : "Upload portfolio file"}
                    <input type="file" style={{ display: "none" }} onChange={(e) => set("portfolioFile")(e.target.files?.[0] || null)} />
                  </label>
                  <Field label="" value={p.portfolioLink} onChange={set("portfolioLink")} placeholder="or paste a link — behance.net/you" />
                </div>
                <Recorder mode="voice" saved={p.voice?.url} onSave={set("voice")} />
                <Recorder mode="video" saved={p.video?.url} onSave={set("video")} />
              </>
            )}

            {step === 3 && (
              <>
                <div style={{ fontFamily: font.mono, fontSize: 12.5, lineHeight: 2, color: T.inkSoft, background: T.paper, borderRadius: 10, padding: 16 }}>
                  PUBLIC NAME — {p.name ? anon(p.name) : "—"} (full name unlocks after employer pays)<br />
                  HEADLINE — {p.headline || "—"}<br />
                  CONTACT — hidden until unlock<br />
                  LOCATION — {[p.neighbourhood, p.city, p.province, p.country].filter(Boolean).join(", ") || "—"}<br />
                  RESUME — {p.resumeFile ? "✓ private until unlock" : "missing"}<br />
                  VOICE — {p.voice ? "✓" : "missing"} · VIDEO — {p.video ? "✓ (watermarked)" : "missing"} · {p.verified ? "✓ VERIFIED" : "not verified"}
                </div>

                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: T.inkSoft, cursor: "pointer" }}>
                  <input type="checkbox" checked={p.consent} onChange={(e) => set("consent")(e.target.checked)} style={{ marginTop: 3, accentColor: T.amber }} />
                  <span>I consent to TalentVault storing and displaying my resume, voice and video recordings to paying employers, under the Privacy Policy. I can delete my data at any time.</span>
                </label>

                {p.published ? (
                  <div style={{ color: T.ok, fontWeight: 600, fontSize: 14.5 }}>✓ Live — employers see you as "{anon(p.name)}". Open the Employer tab to preview your card.</div>
                ) : (
                  <>
                    {publishBlockers.length > 0 && <div style={{ fontSize: 13, color: T.rec }}>Still needed: {publishBlockers.join(", ")}</div>}
                    <Btn onClick={doPublish} disabled={publishBlockers.length > 0 || publishing}>
                      {publishing ? "Uploading media…" : "Publish my profile"}
                    </Btn>
                  </>
                )}
              </>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <Btn small kind="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>← Back</Btn>
              <Btn small kind="dark" onClick={() => setStep(Math.min(3, step + 1))} disabled={step === 3}>Next →</Btn>
            </div>
          </div>
        </div>
      )}

      {/* EMPLOYER */}
      {view === "employer" && (
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "26px 20px 80px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
            <h2 style={{ fontFamily: font.display, fontWeight: 800, fontSize: 28, margin: 0 }}>Talent monitors</h2>
            {!plan && <Btn small onClick={() => setShowPricing(true)}>View plans</Btn>}
            {plan === "starter" && <Btn small kind="ghost" onClick={() => setShowPricing(true)}>Upgrade · {credits} credits left</Btn>}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search skill, city, neighbourhood…"
              style={{ flex: "1 1 220px", fontFamily: font.body, fontSize: 14.5, padding: "11px 14px", border: `1.5px solid ${T.line}`, borderRadius: 9, background: T.white, outline: "none" }} />
            <select value={fCountry} onChange={(e) => setFCountry(e.target.value)} style={{ fontFamily: font.body, fontSize: 14, padding: "10px 12px", border: `1.5px solid ${T.line}`, borderRadius: 9, background: T.white }}>
              {countries.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={fBand} onChange={(e) => setFBand(e.target.value)} style={{ fontFamily: font.body, fontSize: 14, padding: "10px 12px", border: `1.5px solid ${T.line}`, borderRadius: 9, background: T.white }}>
              {BANDS.map((b) => <option key={b}>{b}</option>)}
            </select>
            <Btn small kind={onlyVerified ? "dark" : "ghost"} onClick={() => setOnlyVerified(!onlyVerified)}>✓ Verified</Btn>
            <Btn small kind={onlyShort ? "dark" : "ghost"} onClick={() => setOnlyShort(!onlyShort)}>★ Shortlist ({Object.values(shortlist).filter(Boolean).length})</Btn>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: T.inkSoft, fontSize: 15 }}>No candidates match. Clear a filter to widen the search.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 18 }}>
              {filtered.map((c) => (
                <MonitorCard key={c.id} c={c}
                  unlocked={!!unlocks[c.id]}
                  contact={contacts[c.id]}
                  onUnlock={() => tryUnlock(c.id)}
                  shortlisted={!!shortlist[c.id]}
                  toggleShortlist={() => setShortlist((s) => ({ ...s, [c.id]: !s[c.id] }))}
                  stage={stages[c.id] || "New"}
                  setStage={(v) => setStages((s) => ({ ...s, [c.id]: v }))}
                  playing={playing} setPlaying={setPlaying} />
              ))}
            </div>
          )}
        </div>
      )}

      {showPricing && <Pricing onClose={() => setShowPricing(false)} onSubscribe={subscribe} busy={checkoutBusy} />}

      {toast && (
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: T.ink, color: T.paper, fontFamily: font.body, fontSize: 14, padding: "11px 18px", borderRadius: 10, zIndex: 60, boxShadow: "0 10px 30px rgba(0,0,0,.3)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
