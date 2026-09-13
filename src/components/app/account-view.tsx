"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { StatusBadge, formatDate } from "@/components/app/ui-bits";
import { apiGet, apiSend, ApiClientError } from "@/lib/client/api";
import { useToast } from "@/hooks/use-toast";

interface DeviceSession {
  id: string; device: string | null; ip: string | null; createdAt: string; lastSeenAt: string; expiresAt: string; revoked: boolean; current: boolean;
}

export default function AccountView({ refreshMe, navigate }: { refreshMe: () => Promise<void>; navigate: (to: string) => void }) {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);

  const load = () => {
    apiGet<{ sessions: DeviceSession[] }>("/api/auth/sessions").then((d) => setSessions(d.sessions)).catch(() => {});
  };
  useEffect(load, []);

  const changePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await apiSend("/api/auth/change-password", "POST", {
        currentPassword: String(form.get("current") || ""),
        newPassword: String(form.get("next") || ""),
      });
      toast({ title: "Password changed", description: "All other sessions were revoked." });
      await refreshMe();
      navigate("");
    } catch (err) {
      toast({ title: "Change failed", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    }
  };

  const revoke = async (id: string) => {
    try {
      await apiSend(`/api/auth/sessions/${id}`, "DELETE");
      toast({ title: "Session revoked" });
      load();
    } catch (err) {
      toast({ title: "Could not revoke", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    }
  };

  const resendVerification = async () => {
    try {
      const res = await apiSend<{ devVerificationToken?: string; emailSent?: boolean }>("/api/auth/resend-verification", "POST", {});
      toast({
        title: "Verification reissued",
        description: res.devVerificationToken ? `Dev mode token (SMTP disabled): ${res.devVerificationToken}` : "A verification email would be sent in production (SMTP not configured here).",
      });
    } catch (err) {
      toast({ title: "Could not reissue", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    }
  };

  const deleteAccount = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await apiSend("/api/auth/account", "DELETE", { password: String(form.get("password") || "") });
      toast({ title: "Account deleted", description: "Personal data was removed immediately." });
      await refreshMe();
      navigate("");
    } catch (err) {
      toast({ title: "Deletion failed", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base">Change password</CardTitle>
            <CardDescription>All sessions are revoked after a change; you will sign in again.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cur">Current password</Label>
                <Input id="cur" name="current" type="password" required autoComplete="current-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next">New password</Label>
                <Input id="next" name="next" type="password" required autoComplete="new-password" minLength={10} />
                <p className="text-xs text-zinc-500">10+ characters, upper and lower case, and a digit.</p>
              </div>
              <Button type="submit" className="bg-red-600 hover:bg-red-500">Update password</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base">Email verification</CardTitle>
            <CardDescription>Verification unlocks model uploads. Tokens expire after 48 hours.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">SMTP is not configured in this deployment (EMAIL_MODE=none): reissued tokens are shown once in the toast instead of being emailed. This is documented dev-mode behavior.</p>
            <Button variant="outline" className="mt-3" onClick={resendVerification}>Resend verification</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">Devices and sessions</CardTitle>
          <CardDescription>Sign out any device. Sessions expire after 14 days.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Device</th>
                  <th className="px-4 py-2.5 font-medium">Last seen</th>
                  <th className="px-4 py-2.5 font-medium">State</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {sessions.map((s) => (
                  <tr key={s.id} className="bg-white dark:bg-zinc-950">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{s.device ?? "Unknown device"}</div>
                      <div className="text-xs text-zinc-400">{s.ip ?? "ip hidden"}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-400">{formatDate(s.lastSeenAt)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={s.current ? "ACTIVE" : s.revoked ? "CLOSED" : "IDLE"} />
                      {s.current ? <span className="ml-2 text-xs text-white">this device</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {!s.revoked && !s.current ? (
                        <Button size="sm" variant="outline" onClick={() => revoke(s.id)}>Revoke</Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 border-red-900/50 dark:border-red-900/50">
        <CardHeader>
          <CardTitle className="text-base text-red-500">Delete account</CardTitle>
          <CardDescription>
            Immediate erasure: identity is anonymized, uploads are removed from disk, sessions are ended and personal content is deleted. This cannot be undone. Audit entries retain a minimal, non-identifying record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete my account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>This permanently deletes your account</AlertDialogTitle>
                <AlertDialogDescription>
                  Confirm with your password to proceed. Uploaded voice models are removed from storage immediately.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <form onSubmit={deleteAccount} className="space-y-3">
                <Input name="password" type="password" required placeholder="Your password" autoComplete="current-password" aria-label="Password confirmation" />
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep my account</AlertDialogCancel>
                  <AlertDialogAction type="submit" className="bg-red-600 hover:bg-red-500">Delete permanently</AlertDialogAction>
                </AlertDialogFooter>
              </form>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
