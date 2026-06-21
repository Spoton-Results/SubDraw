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

export default function Terms() {
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
          <h1 style={{ fontSize: "clamp(1.8rem,4vw,2.6rem)", fontWeight: 800, letterSpacing: "-.04em", color: T.text, marginBottom: 12 }}>Terms of Service</h1>
          <p style={{ color: T.hint, fontSize: ".85rem" }}>Effective date: June 21, 2026 · Last updated: June 21, 2026</p>
          <div style={{ marginTop: 20, padding: "16px 20px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 10 }}>
            <p style={{ color: T.muted, fontSize: ".875rem", lineHeight: 1.7, margin: 0 }}>
              These Terms of Service ("Terms") are a legal agreement between you and SpotOn Results LLC ("SubDraw," "we," "us," or "our") governing your access to and use of the SubDraw platform at subdraw.com. By creating an account or using SubDraw, you agree to be bound by these Terms. If you do not agree, do not use the platform.
            </p>
          </div>
        </div>

        <Section title="1. Acceptance and Eligibility">
          <P>By using SubDraw, you represent and warrant that:</P>
          <UL items={[
            "You are at least 18 years of age",
            "You have the legal authority to enter into these Terms on behalf of yourself or your business",
            "You are using SubDraw for legitimate business purposes related to construction project management",
            "Your use of SubDraw will not violate any applicable law or regulation",
            "The information you provide is accurate, current, and complete",
          ]} />
          <P>SubDraw is a business platform. Personal use unrelated to construction project management is outside the intended scope of service.</P>
        </Section>

        <Section title="2. Description of Service">
          <P>SubDraw provides invoice protection and draw management software for general contractors, including:</P>
          <UL items={[
            "Invoice review and automatic overbilling detection against approved contract amounts",
            "Subcontractor draw management and approval workflows",
            "Digital lien waiver collection and tracking",
            "Retainage tracking and schedule generation",
            "Change order management with audit trails",
            "Subcontractor compliance tracking (insurance, licenses)",
            "Lender-ready draw package generation",
            "Subcontractor portal for invoice submission and payment status",
          ]} />
          <P>SubDraw is a software tool that assists with financial review. It does not constitute legal, financial, or accounting advice. You remain solely responsible for all business decisions, payment approvals, and contract compliance. SubDraw's invoice flagging is an automated aid — it is not a guarantee that flagged invoices are invalid or that unflagged invoices are correct.</P>
        </Section>

        <Section title="3. Account Registration and Security">
          <P>To use SubDraw, you must create an account. You agree to:</P>
          <UL items={[
            "Provide accurate, complete, and current registration information",
            "Maintain the security of your password and account credentials",
            "Notify us immediately at hello@subdraw.com of any unauthorized access to your account",
            "Accept responsibility for all activities that occur under your account",
            "Not share your account credentials with unauthorized parties",
          ]} />
          <P>SubDraw reserves the right to suspend or terminate accounts that appear to be compromised, are being used fraudulently, or are in violation of these Terms.</P>
        </Section>

        <Section title="4. Subscription Plans and Payment">
          <P><strong style={{ color: T.text }}>Plans:</strong> SubDraw offers tiered subscription plans (Starter, Professional, Scale) priced by number of active subcontracts. Plan details and current pricing are available at subdraw.com. Subcontractors are always free on every plan.</P>
          <P><strong style={{ color: T.text }}>Billing:</strong> Subscriptions are billed in advance on a monthly or annual basis. Annual subscriptions are billed as a single payment at the annual rate. All payments are processed through Stripe.</P>
          <P><strong style={{ color: T.text }}>Payment processing fee:</strong> Payments processed through SubDraw on behalf of subcontractors include a 1% payment processing fee, which is less than standard credit card terminal rates. This fee is disclosed at the time of payment.</P>
          <P><strong style={{ color: T.text }}>Free trial:</strong> SubDraw offers a free trial period as described on the pricing page. No credit card is required to start a trial. At the end of the trial, a paid subscription is required to continue access.</P>
          <P><strong style={{ color: T.text }}>Automatic renewal:</strong> Your subscription automatically renews at the end of each billing period at the then-current rate unless you cancel before the renewal date.</P>
          <P><strong style={{ color: T.text }}>Price changes:</strong> We reserve the right to change subscription pricing. We will provide at least 30 days' notice before any price increase takes effect. Continued use after the effective date constitutes acceptance of the new pricing.</P>
          <P><strong style={{ color: T.text }}>Refunds:</strong> We offer a 7-day refund policy for new subscriptions. Refund requests must be submitted to hello@subdraw.com within 7 days of the initial charge. Annual subscription refunds are prorated for unused months. We do not offer refunds for partial months on monthly plans.</P>
        </Section>

        <Section title="5. Cancellation">
          <P>You may cancel your SubDraw subscription at any time through your account billing settings or by contacting hello@subdraw.com. Upon cancellation:</P>
          <UL items={[
            "Your subscription remains active through the end of the current paid billing period",
            "You will not be charged for subsequent billing periods",
            "You retain read-only access to your project data for 90 days after cancellation",
            "After 90 days, your data may be permanently deleted (you can request an export before this date)",
            "Subcontractors invited to your projects will lose access when your subscription ends",
          ]} />
          <P>We do not offer refunds for the remainder of a monthly billing period upon cancellation.</P>
        </Section>

        <Section title="6. Acceptable Use">
          <P>You agree to use SubDraw only for lawful purposes and in accordance with these Terms. You agree not to:</P>
          <UL items={[
            "Use SubDraw to submit, process, or approve fraudulent invoices or payments",
            "Misrepresent your identity or your authority to act on behalf of a business",
            "Upload or transmit malicious code, viruses, or any software intended to damage the platform",
            "Attempt to gain unauthorized access to any part of the platform or other users' data",
            "Reverse engineer, decompile, or disassemble any portion of the SubDraw platform",
            "Use automated tools (bots, scrapers) to access the platform without express written permission",
            "Resell or sublicense SubDraw access to third parties without authorization",
            "Use SubDraw in any manner that could disable, overburden, or impair the platform",
            "Collect or harvest any personally identifiable information from the platform",
            "Use SubDraw for any purpose that violates any applicable law, regulation, or third-party rights",
          ]} />
          <P>Violation of acceptable use policies may result in immediate suspension or termination of your account without refund.</P>
        </Section>

        <Section title="7. Your Data and Content">
          <P><strong style={{ color: T.text }}>Ownership:</strong> You retain all ownership rights to the data, project information, contracts, invoices, and other content you upload to SubDraw ("Your Content"). SubDraw does not claim ownership of Your Content.</P>
          <P><strong style={{ color: T.text }}>License to SubDraw:</strong> By uploading Your Content, you grant SubDraw a limited, non-exclusive, royalty-free license to store, process, and display Your Content solely for the purpose of providing the SubDraw service to you.</P>
          <P><strong style={{ color: T.text }}>Data accuracy:</strong> You are responsible for the accuracy and completeness of all data you enter into SubDraw. SubDraw's automated flagging relies on the accuracy of the contract amounts and budget data you provide.</P>
          <P><strong style={{ color: T.text }}>No use of your data for training:</strong> We do not use Your Content to train machine learning models or artificial intelligence systems. Your financial data remains yours and is not used to improve SubDraw's AI features in identifiable form.</P>
          <P><strong style={{ color: T.text }}>Subcontractor data:</strong> When you invite subcontractors to your projects, you represent that you have the authority to share project data with them and that doing so is consistent with your contractual obligations with those subcontractors.</P>
        </Section>

        <Section title="8. Intellectual Property">
          <P>SubDraw and its original content, features, and functionality are owned by SpotOn Results LLC and are protected by United States and international copyright, trademark, patent, and other intellectual property laws.</P>
          <P>The SubDraw name, logo, and all related product names, designs, and slogans are trademarks of SpotOn Results LLC. You may not use these marks without our prior written permission.</P>
          <P>You may not copy, modify, distribute, sell, or lease any part of the SubDraw platform or software without our express written consent.</P>
        </Section>

        <Section title="9. Third-Party Integrations">
          <P>SubDraw integrates with third-party services including Stripe (payment processing), and may offer integrations with lender portals and construction software. Your use of these integrations is subject to the respective third party's terms of service and privacy policies. SubDraw is not responsible for the availability, accuracy, or actions of third-party services.</P>
        </Section>

        <Section title="10. Disclaimers">
          <P><strong style={{ color: T.text }}>No financial or legal advice:</strong> SubDraw is a software tool. Nothing in the platform constitutes financial, accounting, or legal advice. You should consult qualified professionals for advice specific to your business situation.</P>
          <P><strong style={{ color: T.text }}>No guarantee of accuracy:</strong> SubDraw's automated invoice flagging is designed to assist, not replace, human review. We do not guarantee that all overbilling will be detected or that all flagged invoices represent errors. You remain responsible for all payment decisions.</P>
          <P><strong style={{ color: T.text }}>Service availability:</strong> SubDraw is provided "as is" and "as available." We do not guarantee that the platform will be available at all times or free from errors. We reserve the right to modify, suspend, or discontinue the service with reasonable notice.</P>
          <P>TO THE MAXIMUM EXTENT PERMITTED BY LAW, SUBDRAW DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</P>
        </Section>

        <Section title="11. Limitation of Liability">
          <P>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, SUBDRAW AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR:</P>
          <UL items={[
            "Any indirect, incidental, special, consequential, or punitive damages",
            "Loss of profits, revenue, data, or business opportunities",
            "Damages arising from unauthorized access to or alteration of your data",
            "Damages arising from your reliance on SubDraw's invoice flagging or analysis",
            "Damages arising from any third-party conduct or content",
          ]} />
          <P>IN NO EVENT SHALL SUBDRAW'S TOTAL LIABILITY TO YOU FOR ALL CLAIMS EXCEED THE AMOUNT YOU PAID TO SUBDRAW IN THE 12 MONTHS PRECEDING THE CLAIM.</P>
          <P>Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability, so the above limitations may not apply to you.</P>
        </Section>

        <Section title="12. Indemnification">
          <P>You agree to indemnify, defend, and hold harmless SubDraw and its officers, directors, employees, and agents from any claims, liabilities, damages, losses, costs, or expenses (including reasonable legal fees) arising from:</P>
          <UL items={[
            "Your use of the SubDraw platform",
            "Your violation of these Terms",
            "Your violation of any applicable law or third-party rights",
            "Any content or data you submit to SubDraw",
            "Disputes between you and your subcontractors or other parties",
          ]} />
        </Section>

        <Section title="13. Dispute Resolution">
          <P><strong style={{ color: T.text }}>Informal resolution:</strong> Before filing any formal dispute, you agree to contact SubDraw at hello@subdraw.com and attempt to resolve the dispute informally. We will attempt to respond within 30 days.</P>
          <P><strong style={{ color: T.text }}>Arbitration:</strong> If informal resolution fails, disputes shall be resolved by binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules. Arbitration will be conducted in the state of Utah. The arbitrator's decision shall be final and binding.</P>
          <P><strong style={{ color: T.text }}>Class action waiver:</strong> You waive any right to participate in class action lawsuits or class-wide arbitration against SubDraw.</P>
          <P><strong style={{ color: T.text }}>Exceptions:</strong> Either party may seek injunctive or other equitable relief in court to prevent irreparable harm, and either party may bring claims in small claims court for disputes within that court's jurisdiction.</P>
          <P><strong style={{ color: T.text }}>Governing law:</strong> These Terms are governed by the laws of the State of Utah, without regard to conflict of law principles.</P>
        </Section>

        <Section title="14. Termination">
          <P>SubDraw reserves the right to suspend or terminate your account and access to the platform at any time, with or without notice, for:</P>
          <UL items={[
            "Violation of these Terms or our Acceptable Use policy",
            "Fraudulent, illegal, or harmful activity",
            "Non-payment of subscription fees",
            "Repeated or severe complaints from subcontractors or third parties",
            "Any conduct that SubDraw believes may expose it to liability",
          ]} />
          <P>Upon termination for cause, you will not receive a refund for any prepaid subscription amounts. Upon termination by you (cancellation), the terms of Section 5 apply.</P>
          <P>Sections 7, 8, 10, 11, 12, 13, and 15 of these Terms survive termination.</P>
        </Section>

        <Section title="15. General Provisions">
          <P><strong style={{ color: T.text }}>Entire agreement:</strong> These Terms, together with our Privacy Policy, constitute the entire agreement between you and SubDraw regarding your use of the platform.</P>
          <P><strong style={{ color: T.text }}>Severability:</strong> If any provision of these Terms is found invalid or unenforceable, the remaining provisions will continue in full force and effect.</P>
          <P><strong style={{ color: T.text }}>Waiver:</strong> Our failure to enforce any provision of these Terms shall not constitute a waiver of that provision or any other provision.</P>
          <P><strong style={{ color: T.text }}>Assignment:</strong> You may not assign or transfer your rights under these Terms without our prior written consent. SubDraw may assign these Terms in connection with a merger, acquisition, or sale of assets.</P>
          <P><strong style={{ color: T.text }}>Changes to Terms:</strong> We may update these Terms from time to time. We will notify you of material changes by email and/or by posting notice on the platform at least 14 days before changes take effect. Continued use of SubDraw after the effective date constitutes acceptance of the updated Terms.</P>
          <P><strong style={{ color: T.text }}>Force majeure:</strong> SubDraw shall not be liable for delays or failures in performance resulting from causes beyond our reasonable control, including natural disasters, government actions, internet outages, or third-party service failures.</P>
        </Section>

        <Section title="16. Contact">
          <P>For questions about these Terms, please contact us:</P>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "20px 24px", marginTop: 8 }}>
            <p style={{ color: T.text, fontWeight: 600, marginBottom: 4 }}>SpotOn Results LLC (SubDraw)</p>
            <p style={{ color: T.muted, marginBottom: 4 }}>Email: <a href="mailto:hello@subdraw.com" style={{ color: T.teal, textDecoration: "none" }}>hello@subdraw.com</a></p>
            <p style={{ color: T.muted, margin: 0 }}>We respond to all legal inquiries within 30 days.</p>
          </div>
        </Section>

        {/* Footer links */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid ${T.border}`, display: "flex", gap: 24, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: T.hint, fontSize: ".8rem", textDecoration: "none" }}>← Back to SubDraw</Link>
          <Link href="/privacy" style={{ color: T.hint, fontSize: ".8rem", textDecoration: "none" }}>Privacy Policy →</Link>
        </div>
      </div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'); *, *::before, *::after { box-sizing: border-box; } body { margin: 0; }`}</style>
    </div>
  );
}
