import { ZodError, type ZodType } from "zod";

// Client-side form validation. Runs the SAME zod schemas the API enforces,
// so the browser shows the exact rule the server would reject on, without a
// round trip. The server stays the source of truth; this is convenience only.

export type FieldErrors = Record<string, string>;

export function zodFieldErrors(err: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: FieldErrors };

export function validateFields<T>(schema: ZodType<T>, values: unknown): ValidationResult<T> {
  const parsed = schema.safeParse(values);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, errors: zodFieldErrors(parsed.error) };
}

// Extra friendly messages for the two most common single-field cases, so the
// hint under an empty input reads like a person wrote it.
export function emailHint(value: string): string | null {
  const v = value.trim();
  if (!v) return "Enter your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "That does not look like an email address. Check for typos.";
  if (v.length > 200) return "Email addresses up to 200 characters are accepted.";
  return null;
}

export function minLengthHint(value: string, min: number, label: string): string | null {
  const v = value.trim();
  if (!v) return `Enter ${label}.`;
  if (v.length < min) return `${label} needs at least ${min} characters (now ${v.length}).`;
  return null;
}
