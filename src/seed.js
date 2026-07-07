/* Seed data in the production shape:
   public profile = anonymous;  private contact = gated by unlock. */

export const SEED_PUBLIC = [
  { id: "s1", anonName: "Amina Y.", verified: true, headline: "Senior Customer Support Lead", skills: ["Customer Support", "Zendesk", "Team Lead"], neighbourhood: "Gulshan-e-Iqbal", city: "Karachi", province: "Sindh", country: "Pakistan", usd: 900, availability: "Immediate", languages: ["Urdu", "English"], voiceLen: "0:52", videoLen: "2:14", exp: "6 yrs" },
  { id: "s2", anonName: "Marcus R.", verified: true, headline: "Full-Stack Developer (React/Node)", skills: ["React", "Node.js", "PostgreSQL"], neighbourhood: "Leslieville", city: "Toronto", province: "Ontario", country: "Canada", usd: 7100, availability: "2 weeks", languages: ["English", "French"], voiceLen: "1:03", videoLen: "1:48", exp: "8 yrs" },
  { id: "s3", anonName: "Priya N.", verified: false, headline: "Digital Marketing Specialist", skills: ["SEO", "Google Ads", "Analytics"], neighbourhood: "Al Barsha", city: "Dubai", province: "Dubai", country: "UAE", usd: 3200, availability: "1 month", languages: ["English", "Hindi", "Malayalam"], voiceLen: "0:47", videoLen: "2:30", exp: "5 yrs" },
  { id: "s4", anonName: "Jomar S.", verified: true, headline: "Virtual Assistant & Bookkeeper", skills: ["QuickBooks", "Admin", "Data Entry"], neighbourhood: "Poblacion", city: "Makati", province: "Metro Manila", country: "Philippines", usd: 650, availability: "Immediate", languages: ["English", "Tagalog"], voiceLen: "0:58", videoLen: "1:55", exp: "4 yrs" },
  { id: "s5", anonName: "Sophie C.", verified: true, headline: "UX Designer — SaaS products", skills: ["Figma", "UX Research", "Design Systems"], neighbourhood: "Shoreditch", city: "London", province: "Greater London", country: "UK", usd: 6100, availability: "1 month", languages: ["English"], voiceLen: "1:10", videoLen: "2:02", exp: "7 yrs" },
  { id: "s6", anonName: "Chidi O.", verified: false, headline: "Sales Executive — B2B Telecom", skills: ["B2B Sales", "CRM", "Cold Outreach"], neighbourhood: "Lekki Phase 1", city: "Lagos", province: "Lagos", country: "Nigeria", usd: 1100, availability: "2 weeks", languages: ["English", "Igbo"], voiceLen: "0:44", videoLen: "2:21", exp: "5 yrs" },
];

export const SEED_CONTACTS = {
  s1: { fullName: "Amina Yusuf", email: "amina.y@example.com", phone: "+92 300 555 0181", portfolio: "linkedin.com/in/aminayusuf" },
  s2: { fullName: "Marcus Reid", email: "m.reid@example.com", phone: "+1 416 555 0132", portfolio: "github.com/mreid" },
  s3: { fullName: "Priya Nair", email: "priya.n@example.com", phone: "+971 50 555 0164", portfolio: "priyanair.marketing" },
  s4: { fullName: "Jomar Santos", email: "jomar.s@example.com", phone: "+63 917 555 0147", portfolio: "linkedin.com/in/jomars" },
  s5: { fullName: "Sophie Clarke", email: "sophie.c@example.com", phone: "+44 20 5550 199", portfolio: "behance.net/sophieclarke" },
  s6: { fullName: "Chidi Okafor", email: "chidi.o@example.com", phone: "+234 802 555 0117", portfolio: "chidiokafor.sales" },
};
