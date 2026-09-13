"use client";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Legal and trust pages. Content describes the ACTUAL product behavior:
// deferred charging (no payments exist), open uploads with attestation and
// takedown, dev-mode email verification, no analytics or third-party tracking.
// Business identity fields are marked as implementation requirements rather
// than invented (directive 41). Each page notes where professional legal
// review is required before commercial launch.

const UPDATED = "September 14, 2026";

export default function LegalView({ slug, navigate }: { slug: string; navigate: (to: string) => void }) {
  const doc = DOCS[slug] ?? DOCS["terms"];
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap gap-2 pb-6">
        {Object.entries(DOCS).map(([key, d]) => (
          <Button key={key} size="sm" variant={key === slug ? "default" : "outline"} className={key === slug ? "bg-red-600 hover:bg-red-500" : ""} onClick={() => navigate(`legal/${key}`)}>
            {d.nav}
          </Button>
        ))}
      </div>
      <article className="rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900" aria-label={doc.title}>
        <h1 className="text-3xl font-semibold tracking-tight">{doc.title}</h1>
        <p className="mt-2 text-xs uppercase tracking-wider text-zinc-400">Last updated: {UPDATED}</p>
        {doc.review ? (
          <Alert className="mt-5 border-white/25 bg-white/5">
            <AlertDescription className="text-xs text-zinc-100">{doc.review}</AlertDescription>
          </Alert>
        ) : null}
        <div className="prose-neutral mt-6 max-w-none space-y-6 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {doc.body}
        </div>
      </article>
    </div>
  );
}

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="pt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{children}</h2>
);

const DOCS: Record<string, { nav: string; title: string; review?: string; body: React.ReactNode }> = {
  terms: {
    nav: "Terms",
    title: "Terms & Conditions",
    review: "These terms describe real, current functionality. Before charging money, have a qualified lawyer review this document against your jurisdiction (Nigeria: NDPA 2023, FCCPC consumer rules) and the jurisdictions you serve.",
    body: (
      <>
        <p>These Terms & Conditions govern your use of this real-time AI voice conversion platform. By creating an account you accept them, the Privacy Policy, the Cookie Policy and the Voice Rights Policy. If you do not agree, do not use the service.</p>
        <H>1. What the service does</H>
        <p>The platform converts live microphone audio into another voice using conversion engines running on platform-managed workers. Two engine tiers exist today: a DSP tier (built-in signal-processing voices, CPU) and an RVC neural tier that activates when a worker has the requested model loaded. The platform reports only measured performance figures and never guarantees latency you have not observed in your own sessions.</p>
        <H>2. Accounts</H>
        <p>You must provide a valid email address and verify it to unlock uploads. Accounts are personal. You are responsible for activity under your credentials. We may suspend accounts that violate these terms or the Acceptable Use Policy, with a reason recorded and communicated.</p>
        <H>3. Payments and credits</H>
        <p>No payment processing is enabled in this deployment. Credits are granted administratively and consumed by measured usage. Plan prices are not published. When payment processing is introduced, this section will be updated before any charge occurs, and payment will always be verified server-side.</p>
        <H>4. Acceptable use</H>
        <p>You may not use the service to deceive, defraud, harass or impersonate any person, to infringe rights, or for any unlawful purpose. The Voice Rights Policy governs uploaded voice models and clone sample recordings; the Acceptable Use Policy governs conduct. Enforcement includes takedowns, suspensions and cooperation with legal process.</p>
        <H>5. Availability</H>
        <p>The service runs on a worker fleet that can include free compute with quota limits and session caps. Capacity may be unavailable at times; sessions are queued or rejected honestly in that case. We do not promise any uptime percentage in this build.</p>
        <H>6. Termination</H>
        <p>You may delete your account at any time from the account page; deletion is immediate and removes your personal content as described in the Privacy Policy. We may terminate accounts for material breach of these terms.</p>
        <H>7. Disclaimers</H>
        <p>The service is provided as is. To the maximum extent permitted by law we disclaim warranties that are not stated here. Nothing in this document limits liability that cannot be limited by law.</p>
        <H>8. Contact</H>
        <p>Use the Contact page. A ticket-based support channel is available to signed-in users.</p>
      </>
    ),
  },
  privacy: {
    nav: "Privacy",
    title: "Privacy Policy",
    review: "This policy matches implemented data flows exactly. Professional review is required before commercial launch (Nigeria Data Protection Act 2023: registration with NDPC where applicable, DPIA for biometric-adjacent voice data, cross-border transfer rules).",
    body: (
      <>
        <p>This policy lists every category of personal data the platform processes, why, for how long, and who can access it. We practice data minimisation: if a field is listed, it has a concrete purpose; nothing is collected on speculation.</p>
        <H>1. Data we process</H>
        <p><strong>Account data.</strong> Email address (identifier and verification), optional display name, bcrypt password hash. Purpose: authentication. Retention: until account deletion.</p>
        <p><strong>Session and device data.</strong> Session tokens (hashed), device label derived from your browser user agent, IP address, timestamps. Purpose: security, device management, abuse detection. Retention: session lifetime plus revocation record; security events 90 days.</p>
        <p><strong>Voice audio.</strong> Live microphone audio is streamed to a worker, converted, and returned. It is not persisted by the control plane. If you enable session recording, the converted audio stays in your browser until you download it; we do not receive a copy. Uploaded model files are stored until you remove them, moderation requires deletion, or a takedown legal window expires.</p>
        <p><strong>Voice clone samples (device uploads).</strong> When you submit a clone request, the recordings you upload from your device (at most three files, each size-capped) are stored in the platform database together with each file's name, size, SHA-256 hash and, when your browser can measure it, its duration. The server verifies every file's content by header before storing it. Purpose: building the voice clone you requested once real training capacity exists; until then the request stays queued and nothing is processed. Access: private to your account, never published, never used for marketing or profiling. Retention: until you delete the request (one click on the Voices page) or your account is deleted.</p>
        <p><strong>Usage and metering.</strong> Session durations, engine tier, worker identifier, computed cost. Purpose: entitlement enforcement, credit ledger integrity, capacity planning. Retention: 12 months.</p>
        <p><strong>Upload attestations.</strong> For each model upload we store your attestation text, a cryptographic evidence hash and request metadata. Purpose: voice-rights enforcement and takedown defense. Retention: life of the model record plus legal window.</p>
        <p><strong>Audit and security events.</strong> Administrative actions with actor, target, before/after state, and a hash chain for tamper evidence; security events such as failed logins. Purpose: security, accountability. Retention: audit records are long-lived by design; security events 90 days.</p>
        <p><strong>Contact form messages (signed-out visitors).</strong> Optional name, email address, message, plus IP and user agent kept for abuse filtering. Purpose: answering support questions from people who cannot sign in. Retention: 12 months, then deleted. The reference code shown to you (format VC-XXXXXX) is the only identifier you need to cite.</p>
        <p><strong>Mobile app waitlist.</strong> Email address and platform choice, deduplicated. Purpose: exactly one notification when the mobile app ships, then deletion unless you ask us to keep the address. It is never used for marketing and never shared.</p>
        <H>2. How your data is used, in one paragraph</H>
        <p>Your account data authenticates you. Session and security data keep your account safe and stop abuse. Voice audio converts and returns; the platform does not bank it. Clone sample audio sits in storage, private and queued, until real training capacity exists. Metering data keeps free limits and credit math honest. Attestation data protects the people whose voices could be cloned. Contact and waitlist data exist only to answer you or to tell you the app shipped. Nothing on this list is used for advertising, profiling, or model training, and no data is sold.</p>
        <H>3. What we do not do</H>
        <p>No advertising pixels. No third-party analytics. No profiling. No sale of data. No external fonts or scripts at runtime. Cookies are strictly necessary (session) plus interface preferences; see the Cookie Policy.</p>
        <H>4. Third parties</H>
        <p>Currently none receive your data outside of this deployment's own infrastructure. GPU workers are platform-operated components; when third-party providers are introduced, this section will list each with purpose, data, and commercial terms.</p>
        <H>5. Your rights</H>
        <p>Access: the dashboard shows your data directly. Portability: usage and ledger records are exportable on request. Erasure: self-service account deletion is immediate; waitlist addresses are deleted on request or after the launch notification. Objection and rectification: open a support ticket. If local law grants you a complaint route (for example the NDPC in Nigeria), you may use it; we ask you to contact us first so we can fix the problem.</p>
        <H>6. Children</H>
        <p>The service is not directed at children. Accounts require an email address; we delete accounts we learn belong to children below the local digital-consent age.</p>
        <H>7. Contact</H>
        <p>Privacy questions and data-subject requests: use the Contact page. Signed-in requests run through the ticket system so you can track progress. Signed-out requests go through the referenced contact form on the Support page.</p>
      </>
    ),
  },
  cookies: {
    nav: "Cookies",
    title: "Cookie Policy",
    body: (
      <>
        <p>This platform uses the minimum set of browser storage required to function. There are no advertising or analytics cookies because there is no advertising and no third-party analytics.</p>
        <H>Strictly necessary</H>
        <p><strong>voxcore_session.</strong> An httpOnly, SameSite=Strict session cookie. Purpose: keep you signed in securely; required for authentication to work at all. Duration: up to 14 days, cleared on sign-out.</p>
        <H>Preference storage</H>
        <p><strong>Theme preference.</strong> Stored locally (not a cookie) so the interface respects your light/dark choice. Not used for tracking.</p>
        <H>What we do not use</H>
        <p>No tracking pixels, no fingerprinting scripts, no external font CDNs that could log requests, no consent-adjacent data sharing. Because only strictly necessary storage is used, no consent banner is shown; a consent banner that trickles non-essential scripts would be dishonest here.</p>
        <H>Browser cache</H>
        <p>Standard HTTP caching stores this site's static assets (page code, stylesheets, self-hosted fonts, images) on your device so repeat visits load faster. Cached files are readable only by this site and are removed when you clear your browser cache; there is no offline mode and no service worker holding content. Clearing cache and cookies signs you out and removes everything the site stored on your device, because session state lives in the cookie above and nowhere else.</p>
      </>
    ),
  },
  refund: {
    nav: "Refund",
    title: "Refund Policy",
    body: (
      <>
        <p>Charging is not enabled: no payment can be taken, so nothing requires refunding. This policy is published now so its terms are visible before money ever moves, and it will govern any future paid plans.</p>
        <H>Future terms</H>
        <p>When paid plans launch: request a refund within 7 days of a charge for any reason and we will process it back to the original payment method; after 7 days, unused credit balances remain usable or refundable at our discretion, and statutory refund rights (for example under Nigerian consumer protection rules) always apply where they are stronger than this policy.</p>
        <p>Refunds will be verified and recorded server-side with an audit entry; support will never ask for payment credentials.</p>
      </>
    ),
  },
  cancellation: {
    nav: "Cancellation",
    title: "Cancellation Policy",
    body: (
      <>
        <p>You can stop using the service at any time and delete your account self-service from the account page; deletion is immediate and removes personal content. There is no cancellation fee because there are no paid subscriptions in this deployment.</p>
        <H>Future terms</H>
        <p>When subscriptions launch: cancel any time from the billing page; access continues to the end of the paid period; no partial-period charges are made; data stays available for export for 30 days after cancellation before scheduled deletion.</p>
      </>
    ),
  },
  "acceptable-use": {
    nav: "Acceptable Use",
    title: "Acceptable Use Policy",
    body: (
      <>
        <p>This policy governs conduct on the platform. Violations lead to takedowns, suspensions and, where required, cooperation with authorities.</p>
        <H>Prohibited</H>
        <p>Impersonating a real person without authorization, including to deceive listeners. Fraud: voice-based social engineering, scams, bypassing authentication of others. Harassment or abuse. Infringement of intellectual property or publicity rights. Uploading models you have no rights to. Interference: automated load generation, worker impersonation attempts, probing for vulnerabilities without a responsible-disclosure agreement, attempting to manipulate the metering or credit systems.</p>
        <H>Reporting and enforcement</H>
        <p>Every catalog model has a Report link; reports enter the moderation queue with the reporter protected. Administrators act on reports with reasons recorded in a tamper-evident audit log. Security findings: report through a support ticket and we will acknowledge within 5 business days.</p>
        <H>Appeals</H>
        <p>Takedowns and suspensions can be appealed by replying in the notification's related ticket. Appeals are reviewed by a different administrator than the one who took the action when the team size allows.</p>
      </>
    ),
  },
  copyright: {
    nav: "Copyright",
    title: "Copyright & IP Policy",
    body: (
      <>
        <p>We respect intellectual property rights, including the rights that attach to voices and to the software stack this platform builds on.</p>
        <H>Notices</H>
        <p>Send takedown notices through the Contact page or a support ticket, including: the work or voice identified, the URL or model name on the platform, your contact details, a good-faith statement, and your authority to act. Valid notices are actioned promptly: models are taken down immediately and the uploader is notified.</p>
        <H>Counter-notices</H>
        <p>Uploaders may respond with a counter-notice explaining the basis of their rights. Both notices are retained in the model's event history. Repeat infringers lose upload privileges.</p>
        <H>Platform stack</H>
        <p>The platform builds on open-source software and models (RVC ecosystem components, MIT-licensed where verified; see the License Audit document in our engineering docs). Built-in DSP voices are original implementations of classic signal-processing techniques, owned by the platform.</p>
      </>
    ),
  },
  "voice-rights": {
    nav: "Voice Rights",
    title: "Voice Rights & Voice Usage Policy",
    review: "Voice rights carry real legal exposure (personality/publicity rights, fraud and impersonation law). Professional legal review is mandatory before opening uploads to the public commercially.",
    body: (
      <>
        <p>A voice can identify a person as strongly as a face. This policy is the contract between you, the platform and the people whose voices matter.</p>
        <H>1. Uploading a voice model</H>
        <p>Every upload requires a signed rights attestation stored with a cryptographic evidence hash: you confirm you hold the rights or express permission for the voice, and that the model does not impersonate a real person without authorization. Licensing metadata (license name, and a link when one exists) is mandatory; models whose license is UNVERIFIED cannot be approved.</p>
        <H>1b. Cloning from device recordings</H>
        <p>Clone requests made by uploading recordings require the same attestation: you confirm you hold the rights or the spoken consent of the person whose voice is on the recordings. The set is private to your account, hash-sealed on arrival, and never published. It is used only to build the voice you requested when real training capacity exists; if a request is found to violate this policy, it is rejected and deleted, and the fact is recorded.</p>
        <H>2. Moderation</H>
        <p>Humans review every submission. Reviewers can approve, reject with a reason, disable, or take down. Reports from any user enter the same queue. Moderation actions and their reasons are audit-logged.</p>
        <H>3. Takedown</H>
        <p>Owners can remove their models instantly, self-service. Platform takedowns are immediate on a valid report or notice; the file is retained for a legal retention window (not served, not executable) and then deleted. Uploader notifications always state the reason.</p>
        <H>4. Prohibited uses</H>
        <p>Models of public figures or celebrities without documented authorization. Cloning for fraud, deception or harassment. Circumventing moderation by mislabeling. Using the DSP engines to imitate a specific person for deceptive purposes is equally prohibited: engine tier does not change the rules.</p>
        <H>5. Consent evidence</H>
        <p>We may require, before approval, documented consent from the voice's owner (a recording statement, written release or equivalent). The platform keeps consent records with hashes so their integrity can be demonstrated later.</p>
        <H>6. Enforcement contact</H>
        <p>Urgent impersonation matters: mark a support ticket URGENT or use the Contact page. We prioritize identity-harm reports over all other moderation work.</p>
      </>
    ),
  },
  contact: {
    nav: "Contact",
    title: "Contact",
    body: (
      <>
        <H>Support</H>
        <p>Signed-in users: the Support page creates a real ticket visible in your ticket list, with replies delivered as notifications. This is the fastest path for account, billing, session and takedown matters.</p>
        <p>Signed-out visitors: the same Support page offers a contact form that returns a reference code (format VC-XXXXXX). The team replies to the email address you leave; the code is what you cite in follow-ups so your message history can be found.</p>
        <H>How-to questions</H>
        <p>Before writing in: the Guides page answers the most common setup questions with step-by-step instructions for the studio, OBS, Discord, Zoom, recording and mobile use.</p>
        <H>Privacy and data-subject requests</H>
        <p>Open a ticket tagged privacy in the first line. Requests under data protection law (including the Nigeria Data Protection Act) are handled through the ticket so you can track progress.</p>
        <H>Security disclosure</H>
        <p>Report vulnerabilities through a ticket with the first line SECURITY. We acknowledge within 5 business days. Please do not test against production infrastructure beyond your own account.</p>
        <H>Business identity</H>
        <p>This deployment is a pre-commercial build. Registered company details, address and phone will be published here before any payment processing is enabled; they are deliberately not fabricated in the meantime.</p>
      </>
    ),
  },
};
