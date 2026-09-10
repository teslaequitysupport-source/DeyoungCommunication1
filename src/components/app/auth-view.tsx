"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiSend, ApiClientError } from "@/lib/client/api";
import { useToast } from "@/hooks/use-toast";
import { SiteConfig } from "@/components/app/app-shell";

// Sign in / register. Lockout, progressive throttling and rate limits are
// enforced server-side; errors here surface the server's own messages.

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
  const [devToken, setDevToken] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDevToken(null);
    try {
      if (mode === "register") {
        const res = await apiSend<{ ok: boolean; devVerificationToken?: string; emailModeNote?: string }>("/api/auth/register", "POST", {
          email, password, name: name || undefined, acceptTerms: accept,
        });
        if (res.devVerificationToken) {
          setDevToken(res.devVerificationToken);
          await apiSend("/api/auth/verify-email", "POST", { token: res.devVerificationToken }).catch(() => {});
        }
        toast({ title: "Account created", description: res.emailModeNote ?? "Welcome." });
        await refreshMe();
        navigate("dashboard");
      } else {
        await apiSend("/api/auth/login", "POST", { email, password });
        await refreshMe();
        navigate("dashboard");
      }
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setBusy(false);
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
            <Alert className="mb-4 border-violet-800 bg-violet-950/30">
              <AlertDescription className="text-xs text-violet-200">{note}</AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Request failed</AlertTitle>
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          ) : null}
          {devToken ? (
            <Alert className="mb-4 border-amber-800 bg-amber-950/40">
              <AlertTitle className="text-amber-200">Dev-mode email verification</AlertTitle>
              <AlertDescription className="break-all font-mono text-[11px] text-amber-100">
                SMTP is not configured in this deployment, so the verification token is shown once: {devToken}
              </AlertDescription>
            </Alert>
          ) : null}
          <form onSubmit={submit} className="space-y-4" noValidate={false}>
            {mode === "register" ? (
              <div className="space-y-2">
                <Label htmlFor="name">Display name (optional)</Label>
                <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password" type="password" required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password} onChange={(e) => setPassword(e.target.value)}
                aria-describedby={mode === "register" ? "pw-help" : undefined}
              />
              {mode === "register" ? (
                <p id="pw-help" className="text-xs text-zinc-500">At least 10 characters with upper case, lower case and a digit. Hashed with bcrypt; never stored in clear.</p>
              ) : null}
            </div>
            {mode === "register" ? (
              <div className="flex items-start gap-2">
                <Checkbox id="accept" checked={accept} onCheckedChange={(v) => setAccept(v === true)} className="mt-1" required />
                <Label htmlFor="accept" className="text-xs font-normal leading-relaxed text-zinc-500">
                  I accept the{" "}
                  <button type="button" className="underline hover:text-violet-500" onClick={() => navigate("legal/terms")}>Terms</button>, the{" "}
                  <button type="button" className="underline hover:text-violet-500" onClick={() => navigate("legal/privacy")}>Privacy Policy</button> and the{" "}
                  <button type="button" className="underline hover:text-violet-500" onClick={() => navigate("legal/voice-rights")}>Voice Rights Policy</button> including its takedown terms.
                </Label>
              </div>
            ) : null}
            <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-500" disabled={busy || (mode === "register" && (!accept || !email || !password))}>
              {busy ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <div className="mt-4 text-center text-xs text-zinc-500">
            {mode === "login" ? (
              <>
                No account?{" "}
                <button className="underline hover:text-violet-500" onClick={() => navigate("auth/register")}>Create one</button>
                {" "}&middot;{" "}
                <button className="underline hover:text-violet-500" onClick={() => navigate("auth/login")}>Forgot your password?</button>
              </>
            ) : (
              <>
                Already registered?{" "}
                <button className="underline hover:text-violet-500" onClick={() => navigate("auth/login")}>Sign in</button>
              </>
            )}
          </div>
          {config?.registrationEnabled === false ? (
            <p className="mt-4 text-center text-xs text-amber-500">Registration is temporarily closed by the administrator.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
