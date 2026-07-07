import { useState, useRef, useEffect } from "react";

/* ── Theme tokens ───────────────────────────── */
export const T = {
  paper: "#ECEEF0", ink: "#14181D", inkSoft: "#3A424B", line: "#D4D8DC",
  monitor: "#0E1116", monitorEdge: "#232A33",
  amber: "#E8A23D", amberDark: "#C9861F", rec: "#FF4B3E", ok: "#3FA46A", white: "#FFFFFF",
};

export const font = {
  display: "'Bricolage Grotesque', sans-serif",
  body: "'Instrument Sans', sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

export const BANDS = ["All", "Under $1k", "$1k–$3k", "$3k–$6k", "$6k+"];
export const bandOf = (usd) => (usd < 1000 ? BANDS[1] : usd < 3000 ? BANDS[2] : usd < 6000 ? BANDS[3] : BANDS[4]);
export const PIPELINE = ["New", "Contacted", "Interviewed", "Hired"];
export const anon = (name) => {
  const p = String(name || "").trim().split(" ").filter(Boolean);
  if (p.length === 0) return "—";
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0];
};
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/* ── Atoms ──────────────────────────────────── */
export const Slate = ({ children, style }) => (
  <span style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: T.inkSoft, ...style }}>{children}</span>
);

export const Btn = ({ children, onClick, kind = "primary", small, style, disabled }) => {
  const kinds = {
    primary: { background: T.amber, color: T.ink },
    dark: { background: T.ink, color: T.paper },
    ghost: { background: "transparent", color: T.ink, border: `1.5px solid ${T.line}` },
    danger: { background: T.rec, color: T.white },
  };
  return (
    <button onClick={disabled ? undefined : onClick}
      style={{ fontFamily: font.body, fontWeight: 600, cursor: disabled ? "default" : "pointer", border: "none", borderRadius: 8, padding: small ? "8px 14px" : "12px 22px", fontSize: small ? 13 : 15, opacity: disabled ? 0.45 : 1, transition: "transform .12s", ...kinds[kind], ...style }}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "scale(.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}>
      {children}
    </button>
  );
};

export const Field = ({ label, value, onChange, placeholder, type = "text", required, error }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <Slate>{label}{required && <span style={{ color: T.rec }}> *</span>}</Slate>}
    <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      style={{ fontFamily: font.body, fontSize: 15, padding: "11px 13px", border: `1.5px solid ${error ? T.rec : T.line}`, borderRadius: 8, background: T.white, color: T.ink, outline: "none" }}
      onFocus={(e) => (e.target.style.borderColor = T.amber)}
      onBlur={(e) => (e.target.style.borderColor = error ? T.rec : T.line)} />
    {error && <span style={{ fontFamily: font.body, fontSize: 12, color: T.rec }}>{error}</span>}
  </div>
);

export const RecDot = ({ live }) => (
  <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: live ? T.rec : "#4A545F", marginRight: 7, animation: live ? "tvPulse 1.1s infinite" : "none" }} />
);

export const Verified = () => (
  <span title="Phone verified" style={{ fontFamily: font.mono, fontSize: 10, background: "rgba(63,164,106,.12)", color: T.ok, border: `1px solid ${T.ok}`, borderRadius: 5, padding: "2px 6px", marginLeft: 8, verticalAlign: "middle" }}>✓ VERIFIED</span>
);

const Watermark = ({ dim }) => (
  <span style={{ position: "absolute", top: 8, right: 10, fontFamily: font.mono, fontSize: 9.5, letterSpacing: ".08em", color: `rgba(255,255,255,${dim ? ".35" : ".55"})`, pointerEvents: "none" }}>VIA TALENTVAULT</span>
);

/* ── Recorder — returns { url, blob } so the app can upload to Storage ── */
export function Recorder({ mode, onSave, saved }) {
  const [state, setState] = useState(saved ? "done" : "idle");
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState(saved || null);
  const mediaRef = useRef(null), chunksRef = useRef([]), streamRef = useRef(null), timerRef = useRef(null), videoPreviewRef = useRef(null);
  const isVideo = mode === "video";
  const cap = isVideo ? 180 : 90;

  useEffect(() => () => { clearInterval(timerRef.current); streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  const replaceUrl = (u, blob) => {
    if (url && url !== saved) URL.revokeObjectURL(url);
    setUrl(u);
    onSave({ url: u, blob });
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(isVideo ? { video: true, audio: true } : { audio: true });
      streamRef.current = stream;
      if (isVideo && videoPreviewRef.current) { videoPreviewRef.current.srcObject = stream; videoPreviewRef.current.play().catch(() => {}); }
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: isVideo ? "video/webm" : "audio/webm" });
        replaceUrl(URL.createObjectURL(blob), blob);
        setState("done");
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRef.current = rec; rec.start(); setState("recording"); setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => { if (s + 1 >= cap) stop(); return s + 1; }), 1000);
    } catch { setState("unsupported"); }
  };
  const stop = () => { clearInterval(timerRef.current); if (mediaRef.current?.state === "recording") mediaRef.current.stop(); };
  const onFile = (e) => { const f = e.target.files?.[0]; if (!f) return; replaceUrl(URL.createObjectURL(f), f); setState("done"); };
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ background: T.monitor, borderRadius: 12, border: `1px solid ${T.monitorEdge}`, padding: 16, color: "#C6CDD4" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Slate style={{ color: "#8B95A0" }}><RecDot live={state === "recording"} />{isVideo ? "Video presentation" : "Voice intro"} · max {isVideo ? "3:00" : "1:30"}</Slate>
        {state === "recording" && <span style={{ fontFamily: font.mono, fontSize: 13, color: T.rec }}>{fmt(seconds)}</span>}
      </div>
      {isVideo && state === "recording" && <video ref={videoPreviewRef} muted playsInline style={{ width: "100%", borderRadius: 8, marginBottom: 12, background: "#000" }} />}
      {state === "done" && url && (isVideo
        ? <div style={{ position: "relative", marginBottom: 12 }}>
            <video src={url} controls style={{ width: "100%", borderRadius: 8, background: "#000" }} />
            <Watermark />
          </div>
        : <audio src={url} controls style={{ width: "100%", marginBottom: 12 }} />)}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {state !== "recording"
          ? <Btn small kind="danger" onClick={start}>● {state === "done" ? "Re-record" : "Record"}</Btn>
          : <Btn small kind="ghost" style={{ color: "#C6CDD4", borderColor: "#3A424B" }} onClick={stop}>■ Stop</Btn>}
        <label style={{ fontFamily: font.body, fontSize: 13, fontWeight: 600, cursor: "pointer", color: T.amber }}>
          or upload a file
          <input type="file" accept={isVideo ? "video/*" : "audio/*"} onChange={onFile} style={{ display: "none" }} />
        </label>
      </div>
      {state === "unsupported" && <div style={{ marginTop: 10, fontSize: 13, fontFamily: font.body, color: "#8B95A0" }}>Camera/mic permission was blocked — use "upload a file" instead.</div>}
    </div>
  );
}

/* ── Monitor card ───────────────────────────── */
export function MonitorCard({ c, unlocked, contact, onUnlock, shortlisted, toggleShortlist, stage, setStage, playing, setPlaying }) {
  const displayName = c.mine ? c.anonName + " (you)" : unlocked && contact ? contact.fullName : c.anonName;
  const initials = String(c.anonName || "?").split(" ").map((w) => w[0]).join("").replace(".", "");
  return (
    <div style={{ background: T.white, border: `1.5px solid ${T.line}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ background: T.monitor, aspectRatio: "16/9", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {c.videoUrl ? (
          <>
            <video src={c.videoUrl} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <Watermark />
          </>
        ) : (
          <>
            <div style={{ fontFamily: font.display, fontWeight: 800, fontSize: 44, color: "#2C3540" }}>{initials}</div>
            <div style={{ position: "absolute", top: 10, left: 12 }}><Slate style={{ color: "#6B7683" }}><RecDot live={false} />CAM {String(c.id).slice(-2).toUpperCase()}</Slate></div>
            <Watermark dim />
            <div style={{ position: "absolute", bottom: 10, right: 12 }}><Slate style={{ color: "#6B7683" }}>{c.videoLen || "—"}</Slate></div>
            {c.voiceUrl ? (
              <audio src={c.voiceUrl} controls style={{ position: "absolute", bottom: 8, left: 12, right: 12, width: "calc(100% - 24px)", height: 30 }} />
            ) : (
              <>
                <button onClick={() => setPlaying(playing === c.id ? null : c.id)}
                  style={{ position: "absolute", bottom: 8, left: 12, background: "rgba(232,162,61,.15)", border: `1px solid ${T.amber}`, color: T.amber, borderRadius: 6, fontFamily: font.mono, fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>
                  {playing === c.id ? "❚❚ voice intro" : "▶ voice intro"} {c.voiceLen}
                </button>
                {playing === c.id && <div style={{ position: "absolute", bottom: 0, left: 0, height: 3, background: T.amber, animation: "tvProgress 8s linear forwards", width: "100%" }} />}
              </>
            )}
          </>
        )}
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div>
          <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 18, color: T.ink }}>
            {displayName}{c.verified && <Verified />}
          </div>
          <div style={{ fontFamily: font.body, fontSize: 13.5, color: T.inkSoft }}>{c.headline}</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(c.skills || []).slice(0, 3).map((s) => (
            <span key={s} style={{ fontFamily: font.mono, fontSize: 10.5, background: T.paper, border: `1px solid ${T.line}`, borderRadius: 5, padding: "3px 7px", color: T.inkSoft }}>{s}</span>
          ))}
        </div>
        <div style={{ fontFamily: font.mono, fontSize: 11, color: T.inkSoft, lineHeight: 1.8 }}>
          LOC {c.neighbourhood}, {c.city}, {c.country}<br />
          PAY {bandOf(c.usd || 0)} · EXP {c.exp || "—"} · {String(c.availability || "—").toUpperCase()}
        </div>

        <div style={{ borderTop: `1px dashed ${T.line}`, paddingTop: 10, position: "relative", minHeight: 58 }}>
          {unlocked && contact ? (
            <div style={{ fontFamily: font.mono, fontSize: 12, color: T.ink, lineHeight: 1.7 }}>
              {contact.email}<br />{contact.phone}<br />{contact.portfolio ? `↗ ${contact.portfolio}` : "no portfolio"}
            </div>
          ) : c.mine ? (
            <div style={{ fontFamily: font.mono, fontSize: 12, color: T.inkSoft, lineHeight: 1.7 }}>Your contact — employers must unlock to see this.</div>
          ) : (
            <>
              <div aria-hidden style={{ fontFamily: font.mono, fontSize: 12, color: T.ink, lineHeight: 1.7, filter: "blur(5px)", userSelect: "none" }}>
                candidate@hidden.tv<br />+00 000 000 0000<br />↗ portfolio.hidden
              </div>
              <button onClick={onUnlock} style={{ position: "absolute", inset: 0, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: font.body, fontWeight: 600, fontSize: 13, color: T.amberDark }}>
                🔒 Unlock name, contact & portfolio
              </button>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: "auto", alignItems: "center" }}>
          <Btn small kind={shortlisted ? "dark" : "ghost"} onClick={toggleShortlist}>{shortlisted ? "★ Shortlisted" : "☆ Shortlist"}</Btn>
          <select value={stage} disabled={!unlocked && !c.mine} title={!unlocked && !c.mine ? "Unlock to manage pipeline" : ""}
            onChange={(e) => setStage(e.target.value)}
            style={{ fontFamily: font.mono, fontSize: 11.5, border: `1.5px solid ${T.line}`, borderRadius: 8, padding: "6px 8px", background: T.white, color: T.inkSoft, opacity: !unlocked && !c.mine ? 0.45 : 1 }}>
            {PIPELINE.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

/* ── Pricing modal ──────────────────────────── */
export function Pricing({ onClose, onSubscribe, busy }) {
  const tiers = [
    { key: "starter", name: "Starter", price: "$49", per: "/mo", blurb: "20 unlock credits · 1 seat", cta: "Choose Starter" },
    { key: "growth", name: "Growth", price: "$149", per: "/mo", blurb: "Unlimited unlocks · 3 seats · pipeline export", cta: "Choose Growth", hot: true },
    { key: "enterprise", name: "Enterprise", price: "Custom", per: "", blurb: "API access · bulk hiring · dedicated support", cta: "Contact sales" },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(14,17,22,.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.paper, borderRadius: 16, padding: "28px 24px", maxWidth: 780, width: "100%" }}>
        <div style={{ fontFamily: font.display, fontWeight: 800, fontSize: 26, color: T.ink, marginBottom: 4 }}>Unlock your talent pool</div>
        <div style={{ fontFamily: font.body, fontSize: 14.5, color: T.inkSoft, marginBottom: 20 }}>Watch every audition free. Unlock identities candidate by candidate.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {tiers.map((t) => (
            <div key={t.key} style={{ background: t.hot ? T.ink : T.white, color: t.hot ? T.paper : T.ink, border: `1.5px solid ${t.hot ? T.ink : T.line}`, borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <Slate style={{ color: t.hot ? T.amber : T.inkSoft }}>{t.name}</Slate>
              <div style={{ fontFamily: font.display, fontWeight: 800, fontSize: 30 }}>{t.price}<span style={{ fontSize: 14, fontWeight: 400 }}>{t.per}</span></div>
              <div style={{ fontFamily: font.body, fontSize: 13.5, opacity: 0.85, flex: 1 }}>{t.blurb}</div>
              <Btn small kind={t.hot ? "primary" : "ghost"} disabled={busy} onClick={() => onSubscribe(t.key)}>{busy ? "Opening checkout…" : t.cta}</Btn>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, fontFamily: font.body, fontSize: 12.5, color: T.inkSoft }}>
          Payments are processed by Stripe. Circumventing the platform to contact candidates violates the Terms of Service and results in account termination.
        </div>
      </div>
    </div>
  );
}
