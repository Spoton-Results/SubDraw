import * as React from "react";
import { Link } from "wouter";

const T = {
  teal: "#00d4a8", navy: "#080e1c", card: "#0d1525",
  border: "#182135", text: "#e8ecf4", muted: "#8899b4", hint: "#5c7090",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: T.text, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>{title}</h2>
      <div style={{ color: T.muted, fontSize: ".9rem", lineHeight: 1.8 }}>{children}</div>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ marginBottom: 12 }}>{children}</p>;
}

function UL({ items }: { items: string[] }) {
  return (
    <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
      {items.map((item, i) => <li key={i} style={{ marginBottom: 6 }}>{item}</li>)}
    </ul>
  );
}

export default function Privacy() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: T.navy, color: T.text, minHeight: "100vh" }}>
      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${T.border}`, background: "rgba(8,14,28,.97)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
            <div style={{ width: 28, height: 28, background: T.teal, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 10, color: "#000" }}>SD</div>
            <span style={{ fontWeight: 800, fontSize: "1rem", letterSpacing: "-.04em", color: T.text }}>Sub<span style={{ color: T.teal }}>Draw</span></span>
          </Link>
          <Link href="/" style={{ fontSize: ".85rem", color: T.muted, textDecoration: "none" }}>← Back to Home</Link>
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "64px 24px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: ".72rem", fontWeight: 700, color: T.teal, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 12 }}>Legal</div>
          <h1 style={{ fontSize: "clamp(1.8rem,4vw,2.6rem)", fontWeight: 800, letterSpacing: "-.04em", color: T.text, marginBottom: 12 }}>Privacy Policy</h1>
          <p style={{ color: T.hint, fontSize: ".85rem" }}>Effective date: June 21, 2026 · Last updated: June 21, 2026</p>
          <div style={{ marginTop: 20, padding: "16px 20px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 10 }}>
            <p style={{ color: T.muted, fontSize: ".875rem", lineHeight: 1.7, margin: 0 }}>
              SubDraw, operated by SpotOn Results LLC ("SubDraw," "we," "us," or "our"), is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform at subdraw.com. Please read this policy carefully. If you disagree with its terms, please discontinue use of the platform.
            </p>
          </div>
        </div>

        <Section title="1. Information We Collect">
          <P><strong style={{ color: T.text }}>Information you provide directly:</strong></P>
          <UL items={[
            "Account registration details: name, email address, phone number, company name, and password",
            "Business information: company address, license numbers, and contractor details",
            "Project data: subcontractor information, contracts, invoices, change orders, lien waivers, and payment records you enter into the platform",
            "Payment information: billing details processed securely through Stripe (we do not store full card numbers)",
            "Communications: messages, support requests, and correspondence with SubDraw",
          ]} />
          <P><strong style={{ color: T.text }}>Information collected automatically:</strong></P>
          <UL items={[
            "Usage data: pages visited, features used, actions taken, and time spent in the platform",
            "Device and browser information: IP address, browser type, operating system, and device identifiers",
            "Log data: server logs including access times, error reports, and referring URLs",
            "Cookies and similar tracking technologies: session cookies, preference cookies, and analytics identifiers",
          ]} />
          <P><strong style={{ color: T.text }}>Information from third parties:</strong></P>
          <UL items={[
            "Payment processors (Stripe) for billing and payment verification",
            "Authentication providers if you sign in using a third-party service",
            "Integration partners if you connect external construction or accounting tools",
          ]} />
        </Section>

        <Section title="2. How We Use Your Information">
          <P>We use the information we collect to:</P>
          <UL items={[
            "Provide, maintain, and improve the SubDraw platform and its features",
            "Process transactions, manage subscriptions, and send billing-related communications",
            "Send account notifications, draw alerts, and platform updates",
            "Respond to your comments, questions, and support requests",
            "Monitor and analyze usage patterns to improve user experience",
            "Detect, investigate, and prevent fraudulent transactions and platform abuse",
            "Comply with legal obligations and enforce our Terms of Service",
            "Send marketing communications about SubDraw features and updates (you may opt out at any time)",
          ]} />
          <P>We do not sell your personal information to third parties. We do not use your project financial data to train AI models or share it with competitors.</P>
        </Section>

        <Section title="3. How We Share Your Information">
          <P>We may share your information in the following circumstances:</P>
          <P><strong style={{ color: T.text }}>Service providers:</strong> We share information with third-party vendors who perform services on our behalf, including cloud hosting (Railway), payment processing (Stripe), email delivery, customer support tools, and analytics. These providers are contractually bound to protect your data.</P>
          <P><strong style={{ color: T.text }}>Subcontractors you invite:</strong> When you invite subcontractors to your SubDraw project, they will see the project data relevant to their subcontract, including invoices, change orders, lien waivers, and payment status for their own work. They cannot see other subcontractors' financial information.</P>
          <P><strong style={{ color: T.text }}>Business transfers:</strong> If SubDraw is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you via email and/or a prominent notice on our platform before your information is transferred.</P>
          <P><strong style={{ color: T.text }}>Legal requirements:</strong> We may disclose your information if required to do so by law or in response to valid requests by public authorities (e.g., a court or government agency).</P>
          <P><strong style={{ color: T.text }}>Protection of rights:</strong> We may disclose information where we believe it is necessary to investigate, prevent, or take action regarding illegal activities, suspected fraud, or situations involving potential threats to safety.</P>
        </Section>

        <Section title="4. Data Retention">
          <P>We retain your personal information for as long as your account is active or as needed to provide you with services. Specifically:</P>
          <UL items={[
            "Active account data is retained for the duration of your subscription",
            "Project data, invoices, and financial records are retained for 7 years after project completion to support construction lien and audit requirements",
            "If you delete your account, we will delete or anonymize your personal information within 30 days, except where retention is required by law or legitimate business interests",
            "Backup copies may persist for up to 90 days after deletion requests are processed",
          ]} />
        </Section>

        <Section title="5. Data Security">
          <P>We implement industry-standard security measures to protect your information:</P>
          <UL items={[
            "All data is encrypted in transit using TLS 1.2 or higher",
            "Data at rest is encrypted using AES-256 encryption",
            "Access to production systems is restricted to authorized personnel only",
            "We perform regular security assessments and vulnerability testing",
            "Payment card data is handled exclusively by Stripe, a PCI DSS Level 1 certified provider",
          ]} />
          <P>Despite these measures, no security system is impenetrable. We cannot guarantee absolute security of your information. You are responsible for maintaining the confidentiality of your account credentials.</P>
        </Section>

        <Section title="6. Your Rights and Choices">
          <P><strong style={{ color: T.text }}>Access and correction:</strong> You may access and update your account information at any time through your account settings or by contacting us at hello@subdraw.com.</P>
          <P><strong style={{ color: T.text }}>Data portability:</strong> You may request a copy of your data in a machine-readable format by contacting us. We will respond within 30 days.</P>
          <P><strong style={{ color: T.text }}>Deletion:</strong> You may request deletion of your account and personal data by contacting hello@subdraw.com. Note that we may retain certain information as required by law or legitimate business purposes as described in Section 4.</P>
          <P><strong style={{ color: T.text }}>Marketing opt-out:</strong> You may opt out of marketing emails at any time by clicking the "unsubscribe" link in any email or contacting us directly. You will continue to receive transactional and account-related messages.</P>
          <P><strong style={{ color: T.text }}>Cookies:</strong> Most browsers accept cookies by default. You can configure your browser to refuse cookies, though some platform features may not function properly without them.</P>
          <P><strong style={{ color: T.text }}>California residents (CCPA):</strong> California residents have additional rights including the right to know what personal information we collect, the right to delete personal information, and the right to opt out of sale (we do not sell personal information). To exercise these rights, contact us at hello@subdraw.com.</P>
        </Section>

        <Section title="7. Cookies and Tracking Technologies">
          <P>We use the following types of cookies:</P>
          <UL items={[
            "Essential cookies: required for the platform to function (authentication, session management)",
            "Preference cookies: remember your settings and preferences",
            "Analytics cookies: help us understand how users interact with the platform (we use aggregated, anonymized data)",
            "Marketing cookies: used to track outreach campaign performance (not used for third-party advertising)",
          ]} />
          <P>You can opt out of analytics tracking by contacting us or using browser-level controls.</P>
        </Section>

        <Section title="8. Third-Party Links">
          <P>Our platform may contain links to third-party websites, lender portals, or construction software integrations. We are not responsible for the privacy practices of those third parties. We encourage you to review the privacy policies of any third-party sites you visit.</P>
        </Section>

        <Section title="9. Children's Privacy">
          <P>SubDraw is a business platform intended for use by adults operating general contracting businesses. We do not knowingly collect personal information from anyone under the age of 18. If you become aware that a minor has provided us with personal information, please contact us at hello@subdraw.com and we will take steps to delete that information.</P>
        </Section>

        <Section title="10. Changes to This Policy">
          <P>We may update this Privacy Policy from time to time. When we make material changes, we will notify you by email and/or by posting a prominent notice on our platform at least 14 days before the changes take effect. Your continued use of SubDraw after the effective date constitutes acceptance of the updated policy.</P>
        </Section>

        <Section title="11. Contact Us">
          <P>If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:</P>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "20px 24px", marginTop: 8 }}>
            <p style={{ color: T.text, fontWeight: 600, marginBottom: 4 }}>SpotOn Results LLC (SubDraw)</p>
            <p style={{ color: T.muted, marginBottom: 4 }}>Email: <a href="mailto:hello@subdraw.com" style={{ color: T.teal, textDecoration: "none" }}>hello@subdraw.com</a></p>
            <p style={{ color: T.muted, margin: 0 }}>We respond to all privacy requests within 30 days.</p>
          </div>
        </Section>

        {/* Footer links */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid ${T.border}`, display: "flex", gap: 24, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: T.hint, fontSize: ".8rem", textDecoration: "none" }}>← Back to SubDraw</Link>
          <Link href="/terms" style={{ color: T.hint, fontSize: ".8rem", textDecoration: "none" }}>Terms of Service →</Link>
        </div>
      </div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'); *, *::before, *::after { box-sizing: border-box; } body { margin: 0; }`}</style>
    </div>
  );
}
