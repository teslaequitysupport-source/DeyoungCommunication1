"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/app/ui-bits";
import { apiSend, ApiClientError } from "@/lib/client/api";
import { validateFields, emailHint, minLengthHint } from "@/lib/client/form-validate";
import { supportContactSchema } from "@/lib/validate";
import { VoxMark } from "@/components/app/app-shell";

// Public support surface for signed-out visitors: honest quick answers plus a
// contact form that creates a real, referenced support request. Signed-in
// users are routed to the ticket system instead (see app-shell), because a
// ticket thread is strictly better when an account exists.

const QUICK_ANSWERS: [string, string][] = [
  [
    "I cannot sign in",
    "Check the password rules: at least 10 characters with an uppercase letter, a lowercase letter and a digit. Ten failed attempts lock the account temporarily. Still stuck: send the form below with the subject Sign in and include the address you registered with.",
  ],
  [
    "I see Internal server error",
    "Open /api/health in this browser. The errors block names the failing route and the exact message. Include that line in the form below and recovery is much faster.",
  ],
  [
    "How do I use the voice in OBS or Discord",
    "A virtual audio cable carries the converted sound into any app. The full walkthrough with every click is in the Guides page.",
  ],
  [
    "How is my voice data handled",
    "Live audio is converted and returned, not stored by the platform. Session recordings stay in your browser until you download them. The privacy policy lists every field the platform keeps, why, and for how long.",
  ],
  [
    "Someone is using a voice to impersonate me",
    "Report it immediately. Signed in: open a ticket marked URGENT. Signed out: use the form below with the subject Impersonation. Identity-harm reports jump every other queue.",
  ],
];

export default function PublicSupportView({ navigate }: { navigate: (to: string) => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ref: string; message: string } | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const values = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      subject: String(form.get("subject") || ""),
      body: String(form.get("body") || ""),
      website: String(form.get("website") || ""),
    };

    // Instant, per-field feedback using the same schema the server enforces,
    // with human phrasing overlaid where we have it.
    const result = validateFields(supportContactSchema, values);
    if (!result.ok) {
      const merged = { ...result.errors };
      const e = emailHint(values.email);
      if (e) merged.email = e;
      const s = minLengthHint(values.subject, 4, "The subject");
      if (s && merged.subject) merged.subject = s;
      const b = minLengthHint(values.body, 10, "The message");
      if (b && merged.body) merged.body = b;
      setErrors(merged);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await apiSend<{ ok: boolean; ref: string; message: string }>("/api/support/contact", "POST", values);
      setDone({ ref: res.ref, message: res.message });
    } catch (err) {
      setErrors({ form: err instanceof ApiClientError ? err.message : "Could not send. Try again in a minute." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-black">
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <p className="label-kicker text-red-500">Support</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-white">Talk to a human</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400">
          You are signed out, so the form below creates a referenced support request and the team replies to
          your email. With an account, the ticket system is better: replies land in a thread you can follow.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate("auth/login")} className="h-11">Sign in to open a ticket instead</Button>
          <Button variant="ghost" onClick={() => navigate("guides")} className="h-11 text-zinc-300">Read the guides first</Button>
        </div>

        {/* Quick answers */}
        <h2 className="mt-14 font-display text-2xl font-bold tracking-tight text-white">Fast answers</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {QUICK_ANSWERS.map(([q, a]) => (
            <div key={q} className="border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-zinc-100">{q}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{a}</p>
            </div>
          ))}
        </div>

        {/* Contact form */}
        <h2 className="mt-14 font-display text-2xl font-bold tracking-tight text-white">Send a message</h2>
        {done ? (
          <Card className="mt-5 border-red-800 bg-red-950/20">
            <CardHeader>
              <div className="flex items-center gap-3">
                <VoxMark size={32} />
                <CardTitle className="text-lg">Message received</CardTitle>
              </div>
              <CardDescription>{done.message}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-300">
                Your reference:{" "}
                <output className="ml-1 inline-block border border-red-700 bg-black px-2 py-1 font-mono text-base font-bold tracking-widest text-red-300">
                  {done.ref}
                </output>
              </p>
              <p className="mt-3 text-sm text-zinc-400">
                Replies come from the support queue to the address you left. Nothing else will be sent to it.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-5">
            <CardHeader>
              <CardTitle className="text-base">Contact support</CardTitle>
              <CardDescription>One message, one reference code, a reply by email. Rate limited to 3 per hour per network.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} noValidate className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="c-name">Name (optional)</Label>
                    <Input id="c-name" name="name" maxLength={80} autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "c-name-err" : undefined} className="h-12" />
                    {errors.name ? <p id="c-name-err" role="alert" className="text-xs text-red-400">{errors.name}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-email">Email</Label>
                    <Input id="c-email" name="email" type="email" inputMode="email" autoComplete="email" required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "c-email-err" : undefined} className="h-12"
                      onChange={(e) => setErrors((prev) => ({ ...prev, email: emailHint(e.target.value) ?? "" }))}
                    />
                    {errors.email ? <p id="c-email-err" role="alert" className="text-xs text-red-400">{errors.email}</p> : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-subject">Subject</Label>
                  <Input id="c-subject" name="subject" maxLength={150} required placeholder="Sign in problem, latency, billing question..." aria-invalid={Boolean(errors.subject)} aria-describedby={errors.subject ? "c-subject-err" : undefined} className="h-12" />
                  {errors.subject ? <p id="c-subject-err" role="alert" className="text-xs text-red-400">{errors.subject}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-body">Message</Label>
                  <Textarea id="c-body" name="body" rows={6} maxLength={5000} required placeholder="What happened, what you expected, and what you tried. If an error appeared, paste the exact text." aria-invalid={Boolean(errors.body)} aria-describedby={errors.body ? "c-body-err" : undefined}
                    onChange={(e) => setErrors((prev) => ({ ...prev, body: minLengthHint(e.target.value, 10, "The message") ?? "" }))}
                  />
                  {errors.body ? <p id="c-body-err" role="alert" className="text-xs text-red-400">{errors.body}</p> : null}
                </div>
                {/* Honeypot: hidden from humans, catnip for bots. Must stay empty. */}
                <div className="hidden" aria-hidden="true">
                  <Label htmlFor="c-website">Website</Label>
                  <Input id="c-website" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
                </div>
                {errors.form ? <p role="alert" className="border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">{errors.form}</p> : null}
                <Button type="submit" className="h-12 bg-red-600 px-6 font-display font-bold uppercase tracking-wider hover:bg-red-500" disabled={busy}>
                  {busy ? <Spinner /> : "Send message"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
