import { toast } from "sonner";

/** Short random correlation ID (browser-friendly, no crypto dep). */
export function newCorrelationId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return "cid_" + Array.from(bytes, b => b.toString(36).padStart(2, "0")).join("").slice(0, 10);
}

export interface ReportedError {
  step: string;
  message: string;
  correlationId: string;
  status?: number;
  raw?: unknown;
}

/**
 * Structured error reporter. Prints a single grouped console entry with the
 * failing step, message, HTTP status, correlation ID, and raw payload — and
 * surfaces a toast with the same correlation ID so users can quote it when
 * reporting issues.
 */
export function reportError(step: string, err: unknown, opts: { silent?: boolean; status?: number } = {}): ReportedError {
  const correlationId = newCorrelationId();
  let message = "unknown_error";
  let status = opts.status;

  if (err instanceof Error) message = err.message;
  else if (typeof err === "string") message = err;
  else if (err && typeof err === "object") {
    const anyErr = err as any;
    message = anyErr.message || anyErr.error || JSON.stringify(anyErr).slice(0, 300);
    if (typeof anyErr.status === "number") status = anyErr.status;
  }

  const info: ReportedError = { step, message, correlationId, status, raw: err };

  // Grouped console log makes it easy to spot the failing step in devtools.
  try {
    console.groupCollapsed(`%c[${step}] ${message}`, "color:#dc2626;font-weight:600");
    console.log("correlationId:", correlationId);
    if (status) console.log("status:", status);
    console.log("raw:", err);
    console.groupEnd();
  } catch { /* ignore */ }

  if (!opts.silent) {
    toast.error(`${step}: ${message}`, {
      description: `ID: ${correlationId}${status ? ` · HTTP ${status}` : ""}`,
      duration: 8000,
    });
  }
  return info;
}
