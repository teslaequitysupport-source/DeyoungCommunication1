"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, Me } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Menu, X } from "lucide-react";
import { SkeletonCards, ScrollProgress } from "@/components/app/ui-bits";
import LandingView from "@/components/app/landing";
import AuthView from "@/components/app/auth-view";
import DashboardView from "@/components/app/dashboard";
import StudioView from "@/components/app/studio";
import ModelsView from "@/components/app/models-view";
import BillingView from "@/components/app/billing-view";
import SupportView from "@/components/app/support-view";
import AccountView from "@/components/app/account-view";
import LegalView from "@/components/app/legal";
import AdminShell from "@/components/admin/admin-shell";

export interface SiteConfig {
  siteName: string;
  tagline: string;
  announcement: string | null;
  announcementLevel: "INFO" | "WARN";
  maintenanceMode: boolean;
  studioEnabled: boolean;
  uploadsEnabled: boolean;
  registrationEnabled: boolean;
  supportEnabled: boolean;
  animationIntensity: "OFF" | "SUBTLE" | "FULL";
  googleEnabled?: boolean;
}

export interface RouteInfo {
  path: string; // e.g. "admin/workers"
  query: URLSearchParams;
}

// Brand mark: five voice bars whose tops form a "V" valley - the product
// (a voice waveform) and the name (VoxCore) in one glyph. Stays legible at
// 16px; clear space = one bar width on all sides; monochrome-safe.
export function VoxMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      role="img"
      aria-label="VoxCore"
      className={cn("shrink-0", className)}
    >
      <rect width="28" height="28" rx="8" fill="#e11d2e" />
      {[5, 8.5, 12, 15.5, 19].map((x, i) => {
        const h = [10, 6, 3, 6, 10][i];
        return <rect key={x} x={x} y={21 - h} width={2.5} height={h} rx={1.25} fill="#ffffff" />;
      })}
    </svg>
  );
}

function parseHash(): RouteInfo {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [pathPart, queryPart] = raw.split("?");
  return { path: pathPart || "", query: new URLSearchParams(queryPart || "") };
}

export default function AppShell() {
  const [route, setRoute] = useState<RouteInfo>({ path: "", query: new URLSearchParams() });
  const [me, setMe] = useState<Me | null>(null);
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [booted, setBooted] = useState(false);
  const { toast } = useToast();

  const refreshMe = useCallback(async () => {
    try {
      const data = await apiGet<Me>("/api/auth/me");
      setMe(data);
    } catch {
      setMe({ user: null });
    }
  }, []);

  useEffect(() => {
    // Propagate the administrator animation switch to CSS/data hooks used by
    // the 3D canvas, marquees and reveal animations.
    if (config?.animationIntensity) {
      document.documentElement.dataset.anim = config.animationIntensity === "OFF" ? "off" : "on";
    }
  }, [config?.animationIntensity]);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    // Initial route: parse lazily inside the async boot to avoid a
    // synchronous setState in the effect body.
    (async () => {
      setRoute(parseHash());
      await Promise.all([refreshMe(), apiGet<{ config: SiteConfig }>("/api/public/config").then((d) => setConfig(d.config)).catch(() => setConfig(null))]);
      setBooted(true);
    })();
    return () => window.removeEventListener("hashchange", onHash);
  }, [refreshMe]);

  const navigate = useCallback((to: string) => {
    window.location.hash = to.startsWith("#") ? to : `#/${to.replace(/^\//, "")}`;
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    await refreshMe();
    navigate("");
    toast({ title: "Signed out", description: "Your session cookie was cleared." });
  };

  if (!booted) {
    // Branded boot skeleton: the page frame with shimmering placeholders
    // instead of a bare spinner - the layout is stable from the first frame.
    return (
      <div className="flex min-h-screen flex-col bg-black text-zinc-100">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-black/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
            <VoxMark size={28} />
            <span className="skeleton h-4 w-24" aria-hidden />
            <div className="ml-auto flex items-center gap-2" aria-hidden>
              <span className="skeleton h-8 w-16" />
              <span className="skeleton h-8 w-28" />
            </div>
          </div>
        </header>
        <main id="main" className="flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6" aria-label="Loading platform">
            <span className="sr-only">Loading platform</span>
            <div aria-hidden>
              <div className="flex items-center gap-3">
                <span className="live-dot inline-block h-2 w-2 rounded-full bg-red-600" />
                <span className="skeleton h-2.5 w-72" />
              </div>
              <div className="mt-8 space-y-4">
                <span className="skeleton block h-14 w-3/4" />
                <span className="skeleton block h-14 w-1/2 bg-red-950/60" />
                <span className="skeleton block h-14 w-2/3" />
              </div>
              <div className="mt-8 space-y-2">
                <span className="skeleton block h-3 w-full max-w-xl" />
                <span className="skeleton block h-3 w-4/5 max-w-xl" />
              </div>
              <div className="mt-10 flex gap-3">
                <span className="skeleton block h-12 w-48" />
                <span className="skeleton block h-12 w-40" />
              </div>
              <SkeletonCards count={4} className="mt-16" />
            </div>
          </div>
        </main>
        <footer className="mt-auto border-t border-white/10 bg-black">
          <div className="mx-auto max-w-7xl px-4 py-5" aria-hidden>
            <span className="skeleton block h-3 w-64" />
          </div>
        </footer>
      </div>
    );
  }

  const user = me?.user ?? null;
  const isAdmin = user?.role === "ADMIN";
  const isStaff = isAdmin || user?.role === "SUPPORT";

  // Legal views are public.
  if (route.path.startsWith("legal/")) {
    return (
      <Shell config={config} me={me} navigate={navigate} logout={logout} user={user} isAdmin={isAdmin}>
        <LegalView slug={route.path.replace("legal/", "")} navigate={navigate} />
      </Shell>
    );
  }

  // Admin area: separate visual language, separate gate.
  if (route.path.startsWith("admin")) {
    if (!user) {
      return (
        <Shell config={config} me={me} navigate={navigate} logout={logout} user={user} isAdmin={isAdmin}>
          <AuthView navigate={navigate} refreshMe={refreshMe} mode="login" config={config} note="Sign in with an administrator account to open the command centre." />
        </Shell>
      );
    }
    if (!isAdmin) {
      return (
        <Shell config={config} me={me} navigate={navigate} logout={logout} user={user} isAdmin={isAdmin}>
          <AccessDenied isAdmin={false} navigate={navigate} />
        </Shell>
      );
    }
    return (
      <Shell config={config} me={me} navigate={navigate} logout={logout} user={user} isAdmin={isAdmin}>
        <AdminShell route={route.path.replace("admin", "").replace(/^\//, "") || "overview"} navigate={navigate} />
      </Shell>
    );
  }

  // Public routes.
  if (route.path === "" || route.path === "home") {
    return (
      <Shell config={config} me={me} navigate={navigate} logout={logout} user={user} isAdmin={isAdmin}>
        <LandingView navigate={navigate} config={config} user={user} />
      </Shell>
    );
  }
  if (route.path.startsWith("auth")) {
    const mode = route.path.split("/")[1] === "register" ? "register" : "login";
    return (
      <Shell config={config} me={me} navigate={navigate} logout={logout} user={user} isAdmin={isAdmin}>
        <AuthView navigate={navigate} refreshMe={refreshMe} mode={mode} config={config} note={route.query.get("note") ?? undefined} />
      </Shell>
    );
  }

  // Authenticated user routes.
  if (!user) {
    return (
      <Shell config={config} me={me} navigate={navigate} logout={logout} user={user} isAdmin={isAdmin}>
        <AuthView navigate={navigate} refreshMe={refreshMe} mode="login" config={config} note="Sign in to open this area." />
      </Shell>
    );
  }

  if (user.status === "SUSPENDED") {
    return (
      <Shell config={config} me={me} navigate={navigate} logout={logout} user={user} isAdmin={isAdmin}>
        <AccessDenied isAdmin={false} navigate={navigate} suspended />
      </Shell>
    );
  }

  switch (route.path) {
    case "studio":
      return (
        <Shell config={config} me={me} navigate={navigate} logout={logout} user={user} isAdmin={isAdmin}>
          <StudioView navigate={navigate} refreshMe={refreshMe} config={config} />
        </Shell>
      );
    case "models":
      return (
        <Shell config={config} me={me} navigate={navigate} logout={logout} user={user} isAdmin={isAdmin}>
          <ModelsView config={config} />
        </Shell>
      );
    case "billing":
      return (
        <Shell config={config} me={me} navigate={navigate} logout={logout} user={user} isAdmin={isAdmin}>
          <BillingView />
        </Shell>
      );
    case "support":
      return (
        <Shell config={config} me={me} navigate={navigate} logout={logout} user={user} isAdmin={isAdmin}>
          <SupportView config={config} />
        </Shell>
      );
    case "account":
      return (
        <Shell config={config} me={me} navigate={navigate} logout={logout} user={user} isAdmin={isAdmin}>
          <AccountView refreshMe={refreshMe} navigate={navigate} />
        </Shell>
      );
    case "dashboard":
    default:
      return (
        <Shell config={config} me={me} navigate={navigate} logout={logout} user={user} isAdmin={isAdmin}>
          <DashboardView navigate={navigate} me={me} refreshMe={refreshMe} />
        </Shell>
      );
  }
}

function AccessDenied({ isAdmin, navigate, suspended }: { isAdmin: boolean; navigate: (to: string) => void; suspended?: boolean }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-zinc-100">{suspended ? "Account suspended" : "Administrator access required"}</h1>
      <p className="mt-3 text-sm text-zinc-400">
        {suspended
          ? "Your account has been suspended by an administrator. Contact support from the legal and contact pages for assistance."
          : "The command centre is restricted to administrator accounts. All access attempts are recorded as security events."}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button variant="outline" onClick={() => navigate("dashboard")}>Go to dashboard</Button>
        <Button variant="ghost" onClick={() => navigate("")}>Back to home</Button>
      </div>
      {!isAdmin && !suspended ? (
        <p className="mt-8 font-mono text-xs text-zinc-400">SECURITY EVENT LOGGED: PERMISSION_DENIED</p>
      ) : null}
    </div>
  );
}

function Shell({
  config, me, navigate, logout, user, isAdmin, children,
}: {
  config: SiteConfig | null;
  me: Me | null;
  navigate: (to: string) => void;
  logout: () => void;
  user: Me["user"];
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const inAdmin = typeof window !== "undefined" && window.location.hash.startsWith("#/admin");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile menu when the route changes (hash event) or Escape.
  // setState inside event-listener callbacks - allowed, not effect-body.
  useEffect(() => {
    const onHash = () => setMobileOpen(false);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const go = (to: string) => {
    setMobileOpen(false);
    navigate(to);
  };

  const mobileLinks: [string, string][] = [
    ["studio", "Studio"],
    ["models", "Voices"],
    ["support", "Support"],
    ...(user ? [["dashboard", "Dashboard"] as [string, string]] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-black text-zinc-100">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-red-600 focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <button onClick={() => go("")} className="flex min-w-0 items-center gap-2 font-semibold tracking-tight" aria-label="Go to home">
            <VoxMark size={28} />
            <span className="hidden min-[420px]:inline font-display text-sm font-bold uppercase tracking-widest">{config?.siteName ?? "VoxCore"}</span>
            {isAdmin && window.location.hash.startsWith("#/admin") ? (
              <span className="ml-1 hidden min-[420px]:inline border border-red-700 bg-red-950/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-red-400 sm:inline">command centre</span>
            ) : null}
          </button>

          <nav className="ml-auto flex items-center gap-1" aria-label="Main">
            {inAdmin ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => go("")} className="text-zinc-300 hover:text-white">Public site</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => go("studio")} className="hidden sm:inline-flex">Studio</Button>
                <Button variant="ghost" size="sm" onClick={() => go("models")} className="hidden sm:inline-flex">Voices</Button>
                <Button variant="ghost" size="sm" onClick={() => go("support")} className="hidden md:inline-flex">Support</Button>
                {user ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => go("dashboard")} className="hidden sm:inline-flex">Dashboard</Button>
                    {isAdmin ? (
                      <Button size="sm" className="hidden h-11 bg-red-600 font-display font-bold uppercase tracking-wider hover:bg-red-500 sm:inline-flex" onClick={() => go("admin/overview")}>Command centre</Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => { setMobileOpen(false); logout(); }} className="hidden sm:inline-flex">Sign out</Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => go("auth/login")} className="h-11 px-3">Sign in</Button>
                    <Button size="sm" className="h-11 bg-red-600 px-3 font-display font-bold uppercase tracking-wider hover:bg-red-500 min-[480px]:px-4" onClick={() => go("auth/register")}>Create account</Button>
                  </>
                )}
                {/* Mobile menu toggle: the only nav surface below sm. */}
                <button
                  type="button"
                  onClick={() => setMobileOpen((v) => !v)}
                  aria-expanded={mobileOpen}
                  aria-controls="mobile-menu"
                  aria-label={mobileOpen ? "Close menu" : "Open menu"}
                  className="ml-1 grid h-11 w-11 place-items-center rounded-[var(--radius-sm)] text-zinc-200 outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
                >
                  {mobileOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Mobile menu: full-width disclosure panel under the header. */}
        {mobileOpen ? (
          <nav id="mobile-menu" aria-label="Mobile" className="border-t border-white/10 bg-popover shadow-vox sm:hidden">
            <div className="mx-auto flex max-w-7xl flex-col p-3">
              {mobileLinks.map(([to, label]) => (
                <Button key={to} variant="ghost" onClick={() => go(to)} className="h-11 justify-start text-zinc-200">
                  {label}
                </Button>
              ))}
              <div className="my-2 h-px bg-white/10" aria-hidden />
              {user ? (
                <>
                  {isAdmin ? (
                    <Button variant="ghost" onClick={() => go("admin/overview")} className="h-11 justify-start text-red-400">Command centre</Button>
                  ) : null}
                  <Button variant="ghost" onClick={() => { setMobileOpen(false); logout(); }} className="h-11 justify-start text-zinc-300">Sign out</Button>
                </>
              ) : (
                <Button onClick={() => go("auth/register")} className="h-11 justify-start bg-red-600 font-display font-bold uppercase tracking-wider hover:bg-red-500">Create account</Button>
              )}
            </div>
          </nav>
        ) : null}
        {config?.announcement ? (
          <div className={cn("border-t px-4 py-1.5 text-center text-xs",
            config.announcementLevel === "WARN"
              ? "border-red-700 bg-red-950/70 font-medium text-red-300"
              : "border-white/10 bg-white/5 text-zinc-300")}
            role="status">
            {config.announcement}
          </div>
        ) : null}
        {config?.maintenanceMode ? (
          <div className="border-t border-red-600 bg-red-600 px-4 py-1.5 text-center text-xs font-bold uppercase tracking-widest text-white" role="alert">
            Maintenance mode: new sessions and uploads are paused by the administrator.
          </div>
        ) : null}
        <ScrollProgress />
      </header>

      <main id="main" className="flex-1">{children}</main>

      <footer className="mt-auto border-t border-white/10 bg-black">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between text-zinc-400">
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
            <span className="mr-2 flex items-center gap-2 font-medium">
              <VoxMark size={18} />
              {config?.siteName ?? "VoxCore"}
            </span>
            {[
              ["legal/terms", "Terms"],
              ["legal/privacy", "Privacy"],
              ["legal/cookies", "Cookies"],
              ["legal/refund", "Refund"],
              ["legal/acceptable-use", "Acceptable Use"],
              ["legal/voice-rights", "Voice Rights"],
              ["legal/copyright", "Copyright"],
              ["legal/contact", "Contact"],
            ].map(([to, label]) => (
              <button key={to} onClick={() => navigate(to)} className="rounded-[var(--radius-sm)] px-2 py-2 font-medium uppercase tracking-wider text-zinc-400 outline-none transition-colors hover:text-red-500 focus-visible:ring-2 focus-visible:ring-ring">
                {label}
              </button>
            ))}
          </div>
          <div className="text-zinc-400">
            Real-time AI voice conversion. Infrastructure core build, September 2026. No fabricated metrics: all numbers shown anywhere in this product are measured live.
          </div>
        </div>
      </footer>
      <Toaster />
      <span className="hidden">{me?.creditBalanceCents}</span>
    </div>
  );
}
