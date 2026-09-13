"use client";

import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiSend, ApiClientError } from "@/lib/client/api";
import { useToast } from "@/hooks/use-toast";
import { SiteConfig } from "@/components/app/app-shell";

// Sign in / register. Client-side validation gives immediate feedback (live
// password policy, email format); the server remains the source of truth and
// its field-level messages are surfaced verbatim. Lockout, progressive
// throttling and rate limits are enforced server-side.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthView({
  navigate, refreshMe, mode, config, note,
}: {
  navigate: (to: string) => void;
  refreshMe: () => Promise<void>;
  mode: "login" | "register";
  config: SiteConfig | null;
  note?: string;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({ email: false, password: false });

  // Live password policy - the same rules the server enforces (src/lib/auth.ts).
  const pwRules = useMemo(
    () => [
      { label: "At least 10 characters", ok: password.length >= 10 },
      { label: "A lowercase letter", ok: /[a-z]/.test(password) },
      { label: "An uppercase letter", ok: /[A-Z]/.test(password) },
      { label: "A digit", ok: /[0-9]/.test(password) },
    ],
    [password]
  );
  const emailOk = EMAIL_RE.test(email.trim());
  const passwordOk = pwRules.every((r) => r.ok);

  const emailError =
    touched.email && email.trim() !== "" && !emailOk ? "Enter a valid email address." : null;
  const passwordError =
    touched.password && password !== "" && mode === "register" && !passwordOk
      ? "Password does not meet all requirements yet (see the checklist below)."
      : null;

  const showFieldErrors = (which: "email" | "password") =>
    which === "email" ? emailError : passwordError;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setProblems([]);

    // Client-side gate: identical rules to the server, so users get instant
    // feedback instead of a failed round trip.
    const localProblems: string[] = [];
    if (!emailOk) localProblems.push("Enter a valid email address.");
    if (mode === "register" && !passwordOk)
      localProblems.push("Password must be at least 10 characters with upper case, lower case and a digit.");
    if (mode === "register" && !accept)
      localProblems.push("You must accept the Terms, Privacy Policy and Voice Rights Policy.");
    if (localProblems.length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }

    setBusy(true);
    setError(null);
    setDevToken(null);
    try {
      if (mode === "register") {
        const res = await apiSend<{ ok: boolean; devVerificationToken?: string; emailModeNote?: string; emailMode?: string }>("/api/auth/register", "POST", {
          email: email.trim(), password, name: name.trim() || undefined, acceptTerms: accept,
        });
        if (res.devVerificationToken) {
          setDevToken(res.devVerificationToken);
          // Verify BEFORE navigating: a swallowed failure here used to leave
          // the account pending forever with the token alert already gone.
          try {
            await apiSend("/api/auth/verify-email", "POST", { token: res.devVerificationToken });
          } catch {
            toast({
              title: "One more step",
              description: "Automatic verification failed - press \"Verify now\" below. Your account exists and is signed in.",
            });
            return; // stay on the auth view; devToken alert + Verify button remain visible
          }
        }
        toast({ title: "Account created", description: res.emailModeNote ?? "Welcome." });
        await refreshMe();
        navigate("dashboard");
      } else {
        await apiSend("/api/auth/login", "POST", { email: email.trim(), password });
        await refreshMe();
        navigate("dashboard");
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        const details = err.details as { problems?: string[] } | null;
        if (details && Array.isArray(details.problems)) setProblems(details.problems);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setBusy(false);
    }
  };

  const googleStart = () => {
    if (mode === "register" && !accept) {
      setError("Accept the Terms, Privacy Policy and Voice Rights Policy first - Google sign-up records the same consent.");
      return;
    }
    const params = new URLSearchParams({ mode });
    if (mode === "register" && accept) params.set("terms", "1");
    window.location.href = `/api/auth/google/start?${params.toString()}`;
  };

  const googleAvailable = config?.googleEnabled === true;

  const verifyNow = async () => {
    if (!devToken) return;
    setVerifying(true);
    setError(null);
    try {
      await apiSend("/api/auth/verify-email", "POST", { token: devToken });
      toast({ title: "Email verified" });
      await refreshMe();
      navigate("dashboard");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Verification failed - try again");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle>{mode === "login" ? "Sign in" : "Create your account"}</CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Sessions are device-scoped and revocable from your account page."
              : "Free plan: DSP-tier conversion, 10 minutes per day, 1 upload slot."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {note ? (
            <Alert className="mb-4 border-red-800 bg-red-950/30">
              <AlertDescription className="text-xs text-red-200">{note}</AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Request failed</AlertTitle>
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          ) : null}
          {problems.length > 0 ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                <ul className="list-disc pl-4 text-xs">
                  {problems.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          {devToken ? (
            <Alert className="mb-4 border-white/25 bg-white/5">
              <AlertTitle className="text-zinc-100">Dev-mode email verification</AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="break-all font-mono text-[11px] text-zinc-100">
                  SMTP is not configured in this deployment, so the verification token is shown once: {devToken}
                </p>
                <Button type="button" size="sm" variant="outline" className="border-white/30 text-zinc-100 hover:bg-white/5" onClick={verifyNow} disabled={verifying}>
                  {verifying ? "Verifying..." : "Verify now"}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          <form onSubmit={submit} className="space-y-4" noValidate>
            {mode === "register" ? (
              <div className="space-y-2">
                <Label htmlFor="name">Display name (optional)</Label>
                <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email" type="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                placeholder="you@example.com"
                aria-invalid={!!showFieldErrors("email")}
                className={emailError ? "border-red-500 focus-visible:ring-red-500" : undefined}
              />
              {emailError ? <p className="text-xs text-red-500">{emailError}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password" type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password} onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                aria-describedby={mode === "register" ? "pw-help" : undefined}
                aria-invalid={!!showFieldErrors("password")}
                className={passwordError ? "border-red-500 focus-visible:ring-red-500" : undefined}
              />
              {mode === "register" ? (
                <div id="pw-help" className="space-y-1">
                  <ul className="space-y-0.5">
                    {pwRules.map((r) => (
                      <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.ok ? "text-white" : "text-zinc-500"}`}>
                        <span aria-hidden>{r.ok ? "\u2713" : "\u25CB"}</span>
                        {r.label}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-zinc-500">Hashed with bcrypt; never stored in clear.</p>
                </div>
              ) : null}
              {passwordError ? <p className="text-xs text-red-500">{passwordError}</p> : null}
            </div>
            {mode === "register" ? (
              <div className="flex items-start gap-2">
                <Checkbox id="accept" checked={accept} onCheckedChange={(v) => setAccept(v === true)} className="mt-1" required />
                <Label htmlFor="accept" className="text-xs font-normal leading-relaxed text-zinc-500">
                  I accept the{" "}
                  <button type="button" className="underline hover:text-red-500" onClick={() => navigate("legal/terms")}>Terms</button>, the{" "}
                  <button type="button" className="underline hover:text-red-500" onClick={() => navigate("legal/privacy")}>Privacy Policy</button> and the{" "}
                  <button type="button" className="underline hover:text-red-500" onClick={() => navigate("legal/voice-rights")}>Voice Rights Policy</button> including its takedown terms.
                </Label>
              </div>
            ) : null}
            <Button type="submit" className="w-full bg-red-600 hover:bg-red-500" disabled={busy}>
              {busy ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
          {googleAvailable ? (
            <>
              <div className="my-4 flex items-center gap-3" aria-hidden>
                <div className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
                <span className="text-xs text-zinc-500">or</span>
                <div className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={googleStart} disabled={busy}>
                {mode === "login" ? "Continue with Google" : "Sign up with Google"}
              </Button>
              {mode === "register" ? (
                <p className="mt-2 text-center text-[11px] text-zinc-500">
                  Google sign-up records the same Terms and Voice Rights consent - tick the checkbox above first.
                </p>
              ) : null}
            </>
          ) : config ? (
            <p className="mt-4 text-center text-[11px] text-zinc-500">
              Google sign-in is not configured on this deployment (the operator must set GOOGLE_CLIENT_ID and
              GOOGLE_CLIENT_SECRET, then redeploy). Use email sign-up above.
            </p>
          ) : null}
          <div className="mt-4 text-center text-xs text-zinc-500">
            {mode === "login" ? (
              <>
                No account?{" "}
                <button className="underline hover:text-red-500" onClick={() => navigate("auth/register")}>Create one</button>
                {" "}&middot;{" "}
                <button className="underline hover:text-red-500" onClick={() => navigate("auth/login")}>Forgot your password?</button>
              </>
            ) : (
              <>
                Already registered?{" "}
                <button className="underline hover:text-red-500" onClick={() => navigate("auth/login")}>Sign in</button>
              </>
            )}
          </div>
          {config?.registrationEnabled === false ? (
            <p className="mt-4 text-center text-xs text-zinc-300">Registration is temporarily closed by the administrator.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
