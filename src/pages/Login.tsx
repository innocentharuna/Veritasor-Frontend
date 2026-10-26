import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { Location } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { useToast } from "../components/ToastContext";
import MfaMethodChooser, {
  type MfaMethod,
} from "../components/MfaMethodChooser";
import ConfirmDialog from "../components/ConfirmDialog";
import { useAuth } from "../auth/AuthContext";
import { safeNextPath } from "../auth/RequireAuth";
import SubmitButton, { SUBMIT_DEMO_MS } from "../components/SubmitButton";
import {
  verifyRecoveryCode,
  remainingCodeCount,
  generateRecoveryCodes,
} from "../services/mockAuth";

type LoginState = "credentials" | "mfa-challenge" | "mfa-recovery";
type MfaFallbackMethod = MfaMethod | "recovery";
type RecoveryStep =
  | "choose-path"
  | "recovery-code-entry"
  | "recovery-code-success"
  | "support-verify"
  | "reenroll-method"
  | "complete";
type RecoveryPath = "recovery-code" | "support";

interface MfaMethodFallbackDefinition {
  id: MfaFallbackMethod;
  title: string;
  icon: string;
  description: string;
  inputLabel: string;
  inputPlaceholder: string;
  inputAriaLabel: string;
  recommended?: boolean;
}

const PRIMARY_METHOD: MfaMethodFallbackDefinition = {
  id: "security-key",
  title: "Security key (FIDO2 / WebAuthn)",
  icon: "🔐",
  description:
    "Use your registered hardware key or platform authenticator (Touch ID, Face ID, Windows Hello).",
  inputLabel: "Security key",
  inputPlaceholder: "Waiting for key…",
  inputAriaLabel: "Security key challenge status",
  recommended: true,
};

const FALLBACK_METHODS: MfaMethodFallbackDefinition[] = [
  {
    id: "totp",
    title: "Authenticator app (TOTP)",
    icon: "📱",
    description:
      "Enter a 6-digit code from Google Authenticator, 1Password, Authy, etc.",
    inputLabel: "One-time code",
    inputPlaceholder: "6-digit code",
    inputAriaLabel: "6-digit authenticator one-time code",
  },
  {
    id: "sms",
    title: "SMS text message",
    icon: "💬",
    description:
      "We will text a one-time code to the phone number ending in •••• 4242.",
    inputLabel: "SMS code",
    inputPlaceholder: "6-digit code",
    inputAriaLabel: "6-digit SMS one-time code",
  },
  {
    id: "recovery",
    title: "Recovery code",
    icon: "🛡",
    description:
      "Use one of your saved recovery codes if you cannot access any other method.",
    inputLabel: "Recovery code",
    inputPlaceholder: "XXXX-XXXX-XXXX",
    inputAriaLabel: "Recovery code",
  },
];

const loginHighlights = [
  "Verifiable revenue attestations anchored on-chain",
  "Fully keyboard accessible, with inline guidance",
  "Clear feedback on every step of sign-in",
];

function getMethodDefinition(
  id: MfaFallbackMethod,
): MfaMethodFallbackDefinition {
  if (id === PRIMARY_METHOD.id) return PRIMARY_METHOD;
  return FALLBACK_METHODS.find((m) => m.id === id) ?? FALLBACK_METHODS[0];
}

// ─── Credentials state ───────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CredentialsState({ onContinue }: { onContinue: (email: string) => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [emailBlurred, setEmailBlurred] = useState(false);
  const [passwordBlurred, setPasswordBlurred] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const submitTimerRef = useRef<number | null>(null);

  const emailId = useId();
  const emailErrorId = useId();
  const passwordId = useId();
  const passwordErrorId = useId();

  const trimmedEmail = email.trim();
  let emailErrorMessage = "";
  if (!trimmedEmail) {
    emailErrorMessage = "Email is required.";
  } else if (!EMAIL_REGEX.test(trimmedEmail)) {
    emailErrorMessage = "Please enter a valid email address.";
  }

  let passwordErrorMessage = "";
  if (!password) {
    passwordErrorMessage = "Password is required.";
  }

  const showEmailError = (hasSubmitted || emailBlurred) && Boolean(emailErrorMessage);
  const showPasswordError = (hasSubmitted || passwordBlurred) && Boolean(passwordErrorMessage);

  useEffect(() => {
    return () => {
      if (submitTimerRef.current !== null) {
        window.clearTimeout(submitTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);

    if (emailErrorMessage) {
      emailInputRef.current?.focus();
      return;
    }

    if (passwordErrorMessage) {
      passwordInputRef.current?.focus();
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    submitTimerRef.current = window.setTimeout(() => {
      submitTimerRef.current = null;
      setIsSubmitting(false);
      onContinue(email.trim());
    }, SUBMIT_DEMO_MS);
  };

  return (
    <AuthShell
      eyebrow="Authentication"
      title="Welcome back"
      description="Sign in to monitor attestation runs, review evidence, and continue onboarding securely."
      footerPrompt="Need an account?"
      footerLinkLabel="Create one"
      footerLinkHref="/signup"
      sideTitle="Trusted access for finance teams"
      sideDescription="Sign in to review attestation runs and share verifiable revenue proof. This is a demo build: no real credentials are checked."
      sideHighlights={loginHighlights}
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-input-group">
          <label className="auth-label" htmlFor={emailId}>
            Work email
          </label>
          <input
            ref={emailInputRef}
            id={emailId}
            className={"auth-input" + (showEmailError ? " auth-input-error" : "")}
            type="email"
            placeholder="team@veritasor.com"
            autoComplete="email"
            aria-describedby={showEmailError ? emailErrorId : undefined}
            aria-invalid={showEmailError ? "true" : undefined}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailBlurred(true)}
          />
          {showEmailError && (
            <p
              id={emailErrorId}
              className="auth-message auth-message-error"
              role="alert"
            >
              <span aria-hidden="true" className="auth-message-icon">
                !
              </span>
              {emailErrorMessage}
            </p>
          )}
        </div>

        <div className="auth-input-group">
          <div className="auth-label-row">
            <label className="auth-label" htmlFor={passwordId}>
              Password
            </label>
            <Link to="/forgot-password" className="auth-inline-link">
              Forgot password?
            </Link>
          </div>
          <input
            ref={passwordInputRef}
            id={passwordId}
            className={"auth-input" + (showPasswordError ? " auth-input-error" : "")}
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            aria-describedby={showPasswordError ? passwordErrorId : undefined}
            aria-invalid={showPasswordError ? "true" : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setPasswordBlurred(true)}
          />
          {showPasswordError && (
            <p
              id={passwordErrorId}
              className="auth-message auth-message-error"
              role="alert"
            >
              <span aria-hidden="true" className="auth-message-icon">
                !
              </span>
              {passwordErrorMessage}
            </p>
          )}
        </div>

        <label className="auth-checkbox">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
          />
          <span>Keep this device trusted for 30 days</span>
        </label>

        <div className="auth-actions">
          <SubmitButton
            idleLabel="Sign in"
            busyLabel="Signing in…"
            busy={isSubmitting}
          />
        </div>
      </form>
    </AuthShell>
  );
}

// ─── MFA Challenge state ─────────────────────────────────────────────────────

function MfaChallengeState({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: () => void;
}) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  const [activeMethodId, setActiveMethodId] = useState<MfaFallbackMethod>(
    PRIMARY_METHOD.id,
  );
  const [code, setCode] = useState("");
  const [showFallbackSelector, setShowFallbackSelector] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [codeError, setCodeError] = useState<string | null>(null);

  const codeId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const verifyTimerRef = useRef<number | null>(null);
  const keyTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const activeMethod = getMethodDefinition(activeMethodId);
  const isKeyMethod = activeMethodId === "security-key";
  const codeLengthExpected = activeMethodId === "recovery" ? 14 : 6;
  const sanitizedCode = code.replace(/\s/g, "");

  const isRecoveryMethod = activeMethodId === "recovery";
  const RECOVERY_CODE_PATTERN = /^[A-Z0-9]{4}-?[A-Z0-9]{4}-?[A-Z0-9]{4}$/;
  const codeValidLength = isRecoveryMethod
    ? RECOVERY_CODE_PATTERN.test(sanitizedCode.toUpperCase())
    : /^\d{6}$/.test(sanitizedCode);
  const submitDisabled = isSubmitting || (isKeyMethod ? false : !codeValidLength);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (verifyTimerRef.current !== null) {
        window.clearTimeout(verifyTimerRef.current);
        verifyTimerRef.current = null;
      }
      if (keyTimerRef.current !== null) {
        window.clearTimeout(keyTimerRef.current);
        keyTimerRef.current = null;
      }
    };
  }, []);

  // Focus the input on mount / method change (non-key methods)
  useEffect(() => {
    if (!isKeyMethod) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isKeyMethod, activeMethodId]);

  // Auto-trigger key simulation for security-key method
  useEffect(() => {
    if (isKeyMethod && !isSubmitting) {
      // Simulate waiting for a tap; in real app, call WebAuthn API here
    }
  }, [isKeyMethod, isSubmitting]);

  // Resend countdown for SMS
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const id = window.setInterval(
      () => setResendCountdown((n) => Math.max(0, n - 1)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [resendCountdown]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitDisabled) return;

    setIsSubmitting(true);
    setCodeError(null);
    verifyTimerRef.current = window.setTimeout(() => {
      verifyTimerRef.current = null;
      if (!isMountedRef.current) return;
      setIsSubmitting(false);
      addToast("Second factor verified. Redirecting…", "success");
      onSuccess();
    }, 900);
  };

  const handleResend = () => {
    setResendCountdown(30);
    setCode("");
    addToast("A fresh code has been sent to your registered phone.", "info");
  };

  const handleSelectFallback = (id: MfaFallbackMethod) => {
    setActiveMethodId(id);
    setShowFallbackSelector(false);
    setCode("");
    setCodeError(null);
  };

  const maskEmail = (e: string) => {
    const [local, domain] = e.split("@");
    const l = local.length;
    return `${local[0]}${"•".repeat(Math.max(0, l - 2))}${
      l > 1 ? local[l - 1] : ""
    }@${domain ?? "veritasor.com"}`;
  };

  return (
    <AuthShell
      eyebrow="Two-factor authentication"
      title="Verify your sign-in"
      description={`A second factor is required to access this workspace. A sign-in notification was also sent to ${maskEmail(
        "ops@veritasor.com",
      )}.`}
      footerPrompt="Using a different account?"
      footerLinkLabel="Go back to sign in"
      footerLinkHref="/login"
      sideTitle="Phishing-resistant sign-in"
      sideDescription="Security keys and platform authenticators verify the site origin so even a phishing page cannot reuse your credentials."
      sideHighlights={[
        "Primary method + fallback selector prevent lockouts",
        'Code inputs use autocomplete="one-time-code" for SMS/TOTP autofill',
        "Recovery codes and support paths are reachable without signing in",
      ]}
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {/* Current method hero */}
        <div
          role="region"
          aria-labelledby="mfa-method-title"
          style={{
            display: "grid",
            gap: "0.75rem",
            padding: "1rem",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-strong)",
            background:
              "linear-gradient(180deg, rgba(94, 234, 212, 0.06), rgba(96, 165, 250, 0.04))",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "2.75rem",
                height: "2.75rem",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-strong)",
                border: "1px solid var(--border)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.35rem",
                flexShrink: 0,
              }}
            >
              {activeMethod.icon}
            </span>
            <div style={{ display: "grid", gap: "0.2rem", minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}
              >
                <span
                  id="mfa-method-title"
                  style={{ fontWeight: 700, fontSize: "1rem" }}
                >
                  {activeMethod.title}
                </span>
                {activeMethod.recommended && (
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      padding: "0.12rem 0.5rem",
                      borderRadius: 999,
                      background: "rgba(94, 234, 212, 0.14)",
                      border: "1px solid rgba(94, 234, 212, 0.35)",
                      color: "var(--accent)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    Recommended
                  </span>
                )}
              </div>
              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  fontSize: "0.9rem",
                  lineHeight: 1.6,
                }}
              >
                {activeMethod.description}
              </p>
            </div>
          </div>
        </div>

        {/* Input area: security-key is a status, other methods are code inputs */}
        {isKeyMethod ? (
          <div
            className="auth-input-group"
            role="group"
            aria-labelledby="mfa-key-status-title"
          >
            <div id="mfa-key-status-title" className="sr-only">
              Security key challenge
            </div>
            <button
              type="button"
              onClick={() => {
                setIsSubmitting(true);
                keyTimerRef.current = window.setTimeout(() => {
                  keyTimerRef.current = null;
                  if (!isMountedRef.current) return;
                  setIsSubmitting(false);
                  addToast("Security key verified.", "success");
                  onSuccess();
                }, 1200);
              }}
              disabled={isSubmitting}
              className="auth-button auth-button-secondary"
              aria-label="Tap security key or use platform authenticator"
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "0.875rem",
                alignItems: "center",
                textAlign: "left",
                padding: "1rem 1.1rem",
                minHeight: "5rem",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "2.75rem",
                  height: "2.75rem",
                  borderRadius: 999,
                  background: isSubmitting
                    ? "var(--accent)"
                    : "rgba(94, 234, 212, 0.12)",
                  color: isSubmitting ? "#04111f" : "var(--accent)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.4rem",
                  fontWeight: 700,
                }}
              >
                {isSubmitting ? "✓" : "🔑"}
              </span>
              <span style={{ display: "grid", gap: "0.1rem" }}>
                <span
                  style={{
                    fontWeight: 700,
                    color: "var(--text)",
                    fontSize: "1rem",
                  }}
                >
                  {isSubmitting ? "Verifying key…" : "Tap security key"}
                </span>
                <span
                  style={{
                    fontSize: "0.88rem",
                    color: "var(--muted)",
                    lineHeight: 1.5,
                  }}
                >
                  {isSubmitting
                    ? "Validating signature with WebAuthn…"
                    : "Insert your key, then tap its button or touch the sensor. Or use Touch ID / Windows Hello."}
                </span>
              </span>
            </button>
          </div>
        ) : (
          <div className="auth-input-group">
            <label className="auth-label" htmlFor={codeId}>
              {activeMethod.inputLabel}
            </label>
            <input
              ref={inputRef}
              id={codeId}
              className={
                "auth-input" + (codeError ? " auth-input-error" : "")
              }
              type={activeMethodId === "recovery" ? "text" : "text"}
              inputMode={isRecoveryMethod ? "text" : "numeric"}
              autoCapitalize={
                isRecoveryMethod ? "characters" : undefined
              }
              autoCorrect={isRecoveryMethod ? "off" : undefined}
              spellCheck={isRecoveryMethod ? false : undefined}
              autoComplete="one-time-code"
              placeholder={activeMethod.inputPlaceholder}
              aria-label={activeMethod.inputAriaLabel}
              aria-invalid={codeError ? "true" : undefined}
              aria-describedby={
                [
                  codeError ? errorId : null,
                  activeMethodId === "sms" && resendCountdown > 0
                    ? "mfa-resend-status"
                    : null,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (codeError) setCodeError(null);
              }}
              style={{
                fontFamily:
                  activeMethodId === "recovery"
                    ? "ui-monospace, SFMono-Regular, Menlo, monospace"
                    : "inherit",
                letterSpacing:
                  activeMethodId === "recovery" ? "0.1em" : "0.25em",
                textAlign: "center" as const,
                fontSize: "1.15rem",
              }}
              maxLength={
                activeMethodId === "recovery" ? 16 : codeLengthExpected
              }
              disabled={isSubmitting}
            />

            {codeError && (
              <p
                id={errorId}
                className="auth-message auth-message-error"
                role="alert"
              >
                <span aria-hidden="true" className="auth-message-icon">
                  !
                </span>
                {codeError}
              </p>
            )}

            {activeMethodId === "sms" && resendCountdown > 0 && (
              <p
                id="mfa-resend-status"
                className="auth-message auth-message-help"
                role="status"
                aria-live="polite"
              >
                You can request a new code in {resendCountdown}s.
              </p>
            )}

            {activeMethodId === "sms" && resendCountdown === 0 && (
              <button
                type="button"
                onClick={handleResend}
                className="auth-inline-link"
                style={{
                  justifySelf: "start",
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                Didn&apos;t receive the text? Resend code
              </button>
            )}

            {activeMethodId === "recovery" && (
              <p className="auth-message auth-message-warning" role="note">
                <span aria-hidden="true" className="auth-message-icon">
                  ⚠
                </span>
                Each recovery code can only be used once. After sign-in, you
                will be prompted to regenerate a fresh set.
              </p>
            )}
          </div>
        )}

        {/* Fallback selector */}
        <button
          type="button"
          className="auth-button auth-button-ghost"
          aria-expanded={showFallbackSelector}
          aria-controls="mfa-fallback-panel"
          onClick={() => setShowFallbackSelector((v) => !v)}
          style={{ minHeight: "2.75rem" }}
        >
          {showFallbackSelector ? "Hide other methods" : "Use another method"}
        </button>

        {showFallbackSelector && (
          <div
            id="mfa-fallback-panel"
            role="region"
            aria-label="Alternative second-factor methods"
            style={{
              display: "grid",
              gap: "0.65rem",
              padding: "0.875rem",
              borderRadius: "var(--radius-sm)",
              border: "1px dashed var(--border)",
              background: "var(--surface-soft)",
            }}
          >
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--muted)",
                padding: "0.125rem 0.25rem",
              }}
            >
              Other methods
            </div>
            {FALLBACK_METHODS.map((method) => {
              const isActive = method.id === activeMethodId;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => handleSelectFallback(method.id)}
                  aria-current={isActive ? "true" : undefined}
                  aria-pressed={isActive}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: "0.75rem",
                    alignItems: "center",
                    textAlign: "left",
                    padding: "0.75rem 0.875rem",
                    borderRadius: "calc(var(--radius-sm) - 0.1rem)",
                    border: isActive
                      ? "1px solid var(--border-strong)"
                      : "1px solid var(--border)",
                    background: isActive
                      ? "rgba(94, 234, 212, 0.06)"
                      : "var(--surface)",
                    cursor: "pointer",
                    color: "var(--text)",
                    transition:
                      "border-color 120ms ease, background-color 120ms ease",
                    minHeight: "3.25rem",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: "2rem",
                      height: "2rem",
                      borderRadius: "calc(var(--radius-sm) - 0.25rem)",
                      background: "var(--surface-strong)",
                      border: "1px solid var(--border)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1rem",
                      flexShrink: 0,
                    }}
                  >
                    {method.icon}
                  </span>
                  <span style={{ display: "grid", gap: "0.1rem", minWidth: 0 }}>
                    <span
                      style={{
                        fontWeight: isActive ? 700 : 600,
                        fontSize: "0.92rem",
                        color: "var(--text)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      {method.title}
                      {isActive && (
                        <span
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--accent)",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Active
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: "0.82rem",
                        color: "var(--muted)",
                        lineHeight: 1.45,
                      }}
                    >
                      {method.description}
                    </span>
                  </span>
                </button>
              );
            })}

            <div
              role="separator"
              style={{
                height: 1,
                background: "var(--border)",
                margin: "0.25rem 0",
              }}
            />

            <button
              type="button"
              onClick={() => navigate("/login?state=mfa-recover")}
              className="auth-inline-link"
              style={{
                justifySelf: "start",
                padding: "0.35rem 0.25rem",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--muted)",
                fontWeight: 600,
              }}
            >
              Lost your device? Use recovery codes or contact support
            </button>
          </div>
        )}

        <div className="auth-actions">
          <button
            type="button"
            className="auth-button auth-button-secondary"
            onClick={onBack}
            disabled={isSubmitting}
          >
            ← Back
          </button>
          {!isKeyMethod && (
            <SubmitButton
              idleLabel="Verify code"
              busyLabel="Verifying…"
              busy={isSubmitting}
              disabled={submitDisabled}
            />
          )}
        </div>
      </form>
    </AuthShell>
  );
}

// ─── MFA Recovery / Re-enrollment flow — #255 ────────────────────────────────

interface RecoveryProgressStep {
  id: RecoveryStep;
  label: string;
  showLabel?: boolean;
}

const RECOVERY_PROGRESS: RecoveryProgressStep[] = [
  { id: "choose-path", label: "1. Choose" },
  { id: "recovery-code-entry", label: "2. Verify" },
  { id: "recovery-code-success", label: "2. Verify" },
  { id: "support-verify", label: "2. Verify" },
  { id: "reenroll-method", label: "3. Re-enroll" },
  { id: "complete", label: "4. Done" },
];

function getProgressIndex(step: RecoveryStep): number {
  const idx = RECOVERY_PROGRESS.findIndex((s) => s.id === step);
  return idx === -1 ? 0 : idx;
}

function RecoveryProgress({ current }: { current: RecoveryStep }) {
  const currentIdx = getProgressIndex(current);
  const uniqueSteps = [
    { key: "choose-path", label: "Choose recovery path", idx: 0 },
    { key: "verify", label: "Verify identity", idx: 1 },
    { key: "reenroll", label: "Set new method", idx: 2 },
    { key: "complete", label: "Complete", idx: 3 },
  ];

  const mapStepToLogical = (step: RecoveryStep): number => {
    switch (step) {
      case "choose-path":
        return 0;
      case "recovery-code-entry":
      case "recovery-code-success":
      case "support-verify":
        return 1;
      case "reenroll-method":
        return 2;
      case "complete":
        return 3;
    }
  };

  const logical = mapStepToLogical(current);

  return (
    <nav
      role="navigation"
      aria-label="MFA recovery progress"
      style={{
        display: "grid",
        gap: "0.75rem",
      }}
    >
      <ol
        role="list"
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "0.35rem",
        }}
      >
        {uniqueSteps.map((s, i) => {
          const isComplete = i < logical;
          const isCurrent = i === logical;
          return (
            <li
              key={s.key}
              style={{
                display: "grid",
                gap: "0.35rem",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "1.75rem",
                    height: "1.75rem",
                    minWidth: "1.75rem",
                    borderRadius: 999,
                    border: `1.5px solid ${
                      isComplete || isCurrent
                        ? "var(--border-strong)"
                        : "var(--border)"
                    }`,
                    background: isComplete
                      ? "var(--accent)"
                      : isCurrent
                        ? "rgba(94, 234, 212, 0.08)"
                        : "transparent",
                    color: isComplete
                      ? "#04111f"
                      : isCurrent
                        ? "var(--accent)"
                        : "var(--muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "0.78rem",
                    transition: "all 180ms ease",
                  }}
                >
                  {isComplete ? "✓" : i + 1}
                </span>
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: isCurrent ? 700 : 600,
                    color: isCurrent
                      ? "var(--text)"
                      : isComplete
                        ? "var(--text)"
                        : "var(--muted)",
                    whiteSpace: "nowrap" as const,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.label}
                </span>
              </div>
              {i < uniqueSteps.length - 1 && (
                <div
                  aria-hidden="true"
                  style={{
                    marginLeft: "0.875rem",
                    height: 3,
                    borderRadius: 999,
                    background: isComplete
                      ? "var(--accent)"
                      : "rgba(148, 163, 184, 0.2)",
                    transition: "background-color 180ms ease",
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function MfaRecoveryFlowState({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: () => void;
}) {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [step, setStep] = useState<RecoveryStep>("choose-path");
  const [path, setPath] = useState<RecoveryPath | null>(null);

  // Recovery-code step state
  // `codes` is populated with a fresh crypto-generated set when the user
  // reaches the "complete" step after re-enrollment.  It is empty until then.
  const [codes, setCodes] = useState<string[]>([]);
  const [codeValue, setCodeValue] = useState("");
  const [codeTried, setCodeTried] = useState(false);
  const [codeValid, setCodeValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [codesRemaining, setCodesRemaining] = useState<number>(
    remainingCodeCount,
  );

  // Support step state
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportReason, setSupportReason] = useState("lost-device");
  const [supportDetails, setSupportDetails] = useState("");
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  // Re-enroll step state
  const [chosenMethod, setChosenMethod] = useState<MfaMethod | null>(null);

  const codeId = useId();
  const supportNameId = useId();
  const supportEmailId = useId();

  // Shared helpers
  const goTo = (s: RecoveryStep) => setStep(s);

  // When recovery code succeeds, go to success screen then auto-advance
  useEffect(() => {
    if (step !== "recovery-code-success") return;
    const t = window.setTimeout(() => goTo("reenroll-method"), 1800);
    return () => window.clearTimeout(t);
  }, [step]);

  // When re-enroll picks a method, go to complete — generate fresh codes first
  useEffect(() => {
    if (step !== "reenroll-method" || !chosenMethod) return;
    const t = window.setTimeout(() => {
      setCodes(generateRecoveryCodes());
      goTo("complete");
    }, 500);
    return () => window.clearTimeout(t);
  }, [step, chosenMethod]);

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    setCodeTried(true);
    setIsSubmitting(true);

    const valid = verifyRecoveryCode(codeValue);
    setTimeout(() => {
      setCodeValid(valid);
      setIsSubmitting(false);
      if (valid) {
        setCodesRemaining(remainingCodeCount());
        addToast("Recovery code accepted. Proceeding…", "success");
        goTo("recovery-code-success");
      } else {
        addToast(
          "That code does not match any unused recovery code. Try again or use support verification.",
          "error",
        );
      }
    }, 800);
  };

  const handleSubmitSupport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportName.trim() || !supportEmail.trim()) {
      addToast("Please provide your full name and verified email.", "error");
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      addToast(
        "Verification request submitted. Support will reply within 1 business day.",
        "success",
      );
      // For demo flow, proceed so user can see full UX; production would
      // actually wait for support to verify and send a magic link.
      goTo("reenroll-method");
    }, 1200);
  };

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Lost your MFA device?"
      description="Use one of the paths below to verify your identity, then enroll a new second-factor method to regain access."
      footerPrompt="Back to sign in?"
      footerLinkLabel="Return to sign in"
      footerLinkHref="/login"
      sideTitle="Safe recovery — no dead ends"
      sideDescription="Users who lose a phone or security key can self-serve via recovery codes, or open a verified ticket. Both paths end with guided re-enrollment so the workspace stays protected."
      sideHighlights={[
        "Visible progress indicator across every recovery branch",
        "Support-verification fallback for users without recovery codes",
        "Mandatory re-enrollment step before the workspace is accessible again",
      ]}
    >
      <RecoveryProgress current={step} />

      {/* Step 1: Choose path */}
      {step === "choose-path" && (
        <form
          className="auth-form"
          onSubmit={(e) => e.preventDefault()}
          style={{ gap: "0.875rem" }}
        >
          <div
            role="group"
            aria-labelledby="recovery-choose-title"
            style={{ display: "grid", gap: "0.5rem" }}
          >
            <h2 id="recovery-choose-title" className="sr-only">
              Choose a recovery method
            </h2>
          </div>

          <div
            role="radiogroup"
            aria-label="Recovery path"
            style={{ display: "grid", gap: "0.65rem" }}
          >
            {[
              {
                id: "recovery-code" as RecoveryPath,
                icon: "🛡",
                title: "Use a recovery code",
                description:
                  "Enter one of the 10 single-use codes saved when you set up 2FA. This is the fastest way back in.",
                recommended: true,
              },
              {
                id: "support" as RecoveryPath,
                icon: "🎧",
                title: "Verify with support",
                description:
                  "Don't have your recovery codes? Submit a verification request. Support will confirm your identity via your registered email and/or phone.",
                recommended: false,
              },
            ].map((opt) => {
              const isActive = path === opt.id;
              return (
                <label
                  key={opt.id}
                  className="wizard-choice-card"
                  style={{ display: "block" }}
                >
                  <input
                    type="radio"
                    name="recovery-path"
                    className="wizard-choice-input sr-only"
                    checked={isActive}
                    onChange={() => setPath(opt.id)}
                    aria-label={opt.title}
                  />
                  <div
                    className="wizard-choice-surface"
                    style={{
                      minHeight: "100%",
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: "0.875rem",
                      padding: "1rem",
                      borderRadius: "var(--radius-sm)",
                      border: isActive
                        ? "1.5px solid var(--border-strong)"
                        : "1px solid var(--border)",
                      background: isActive
                        ? "rgba(94, 234, 212, 0.06)"
                        : "rgba(15, 23, 42, 0.72)",
                      cursor: "pointer",
                      transition:
                        "border-color 140ms ease, background-color 140ms ease",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: "2.5rem",
                        height: "2.5rem",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--surface-strong)",
                        border: "1px solid var(--border)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.2rem",
                        flexShrink: 0,
                      }}
                    >
                      {opt.icon}
                    </span>
                    <div style={{ display: "grid", gap: "0.25rem" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>{opt.title}</span>
                        {opt.recommended && (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 800,
                              padding: "0.12rem 0.5rem",
                              borderRadius: 999,
                              background: "rgba(94, 234, 212, 0.14)",
                              border: "1px solid rgba(94, 234, 212, 0.35)",
                              color: "var(--accent)",
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                            }}
                          >
                            Fastest
                          </span>
                        )}
                      </div>
                      <p
                        style={{
                          margin: 0,
                          color: "var(--muted)",
                          fontSize: "0.88rem",
                          lineHeight: 1.55,
                        }}
                      >
                        {opt.description}
                      </p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="auth-actions" style={{ gap: "0.5rem" }}>
            <button
              type="button"
              className="auth-button auth-button-secondary"
              onClick={onBack}
            >
              ← Back to sign in
            </button>
            <button
              type="button"
              className="auth-button auth-button-primary"
              disabled={!path}
              onClick={() => {
                if (path === "recovery-code") goTo("recovery-code-entry");
                else goTo("support-verify");
              }}
            >
              Continue
            </button>
          </div>
        </form>
      )}

      {/* Step 2a: Recovery code entry */}
      {step === "recovery-code-entry" && (
        <form
          className="auth-form"
          onSubmit={handleSubmitCode}
          noValidate
          style={{ gap: "1rem" }}
        >
          <div
            style={{
              display: "grid",
              gap: "0.5rem",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "1.15rem",
                fontWeight: 700,
              }}
            >
              Enter a recovery code
            </h2>
            <p
              style={{
                margin: 0,
                color: "var(--muted)",
                fontSize: "0.9rem",
                lineHeight: 1.6,
              }}
            >
              Recovery codes were displayed when you first enabled two-factor
              authentication. Each code can be used once.
            </p>
            <p
              style={{
                margin: 0,
                color: "var(--muted)",
                fontSize: "0.85rem",
              }}
            >
              {codesRemaining === 10
                ? "10 codes remaining."
                : codesRemaining === 1
                  ? "1 code remaining."
                  : `${codesRemaining} codes remaining.`}
            </p>
          </div>

          <div className="auth-message auth-message-warning" role="note">
            <span aria-hidden="true" className="auth-message-icon">
              ⚠
            </span>
            After using a recovery code, all other MFA methods on your account
            will be suspended until you enroll a replacement.
          </div>

          <div className="auth-input-group">
            <label className="auth-label" htmlFor={codeId}>
              Recovery code
            </label>
            <input
              id={codeId}
              className={
                "auth-input" +
                (codeTried && !codeValid && codeValue.length > 0
                  ? " auth-input-error"
                  : "")
              }
              type="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="one-time-code"
              placeholder="XXXX-XXXX-XXXX"
              value={codeValue}
              onChange={(e) => {
                setCodeValue(e.target.value.toUpperCase());
                if (codeTried) setCodeTried(false);
              }}
              aria-invalid={
                codeTried && !codeValid && codeValue.length > 0
                  ? "true"
                  : undefined
              }
              aria-describedby={
                "recovery-code-help" +
                (codeTried && !codeValid ? " recovery-code-error" : "")
              }
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                letterSpacing: "0.12em",
                textAlign: "center" as const,
                fontSize: "1.1rem",
              }}
              maxLength={16}
              disabled={isSubmitting}
            />
            <p
              id="recovery-code-help"
              className="auth-message auth-message-help"
            >
              Codes are case-insensitive. Hyphens are added automatically.
            </p>
            {codeTried && !codeValid && codeValue.length > 0 && (
              <p
                id="recovery-code-error"
                className="auth-message auth-message-error"
                role="alert"
              >
                <span aria-hidden="true" className="auth-message-icon">
                  !
                </span>
                That code wasn&apos;t recognized. Double-check the characters
                (avoid 0 vs O, 1 vs I, 5 vs S).
              </p>
            )}
          </div>

          <div className="auth-actions" style={{ gap: "0.5rem" }}>
            <button
              type="button"
              className="auth-button auth-button-ghost"
              onClick={() => goTo("choose-path")}
            >
              ← Try a different method
            </button>
            <SubmitButton
              idleLabel="Verify code"
              busyLabel="Verifying code…"
              busy={isSubmitting}
              disabled={
                isSubmitting ||
                codeValue.trim().replace(/[^A-Z0-9]/g, "").length < 8
              }
            />
          </div>
        </form>
      )}

      {/* Step 2a success — auto-advances */}
      {step === "recovery-code-success" && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "grid",
            gap: "1rem",
            padding: "1.25rem 0",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.875rem",
              padding: "1rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(52, 211, 153, 0.35)",
              background: "var(--success-soft)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "2.75rem",
                height: "2.75rem",
                borderRadius: 999,
                background: "var(--accent)",
                color: "#04111f",
                fontWeight: 800,
                fontSize: "1.25rem",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              ✓
            </span>
            <div style={{ display: "grid", gap: "0.15rem" }}>
              <div style={{ fontWeight: 700, color: "var(--text)" }}>
                Recovery code accepted
              </div>
              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  fontSize: "0.9rem",
                  lineHeight: 1.5,
                }}
              >
                Preparing the re-enrollment screen…
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 2b: Support verification */}
      {step === "support-verify" && (
        <form
          className="auth-form"
          onSubmit={handleSubmitSupport}
          noValidate
          style={{ gap: "0.875rem" }}
        >
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "1.15rem",
                fontWeight: 700,
              }}
            >
              Verify with support
            </h2>
            <p
              style={{
                margin: 0,
                color: "var(--muted)",
                fontSize: "0.9rem",
                lineHeight: 1.6,
              }}
            >
              Submit a verification request. Our team will reply within 1
              business day to confirm your identity and unlock account recovery.
            </p>
          </div>

          <div
            className="auth-message auth-message-info"
            role="note"
            style={{
              padding: "0.75rem 0.875rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(96, 165, 250, 0.32)",
              background: "rgba(96, 165, 250, 0.12)",
              color: "#e0f2ff",
              fontSize: "0.88rem",
              lineHeight: 1.5,
            }}
          >
            <span aria-hidden="true" style={{ marginRight: "0.4rem" }}>
              ℹ
            </span>
            To protect your workspace from account-takeover attempts,
            support-assisted recovery requires verification via your registered
            email address and one additional factor (phone, billing, or
            workspace-admin confirmation).
          </div>

          <div className="auth-grid">
            <div className="auth-input-group">
              <label className="auth-label" htmlFor={supportNameId}>
                Full name
              </label>
              <input
                id={supportNameId}
                className="auth-input"
                type="text"
                autoComplete="name"
                placeholder="Joel Agboola"
                value={supportName}
                onChange={(e) => setSupportName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="auth-input-group">
              <label className="auth-label" htmlFor={supportEmailId}>
                Verified email
              </label>
              <input
                id={supportEmailId}
                className="auth-input"
                type="email"
                autoComplete="email"
                placeholder="joel@example.com"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label className="auth-label" htmlFor="support-reason">
              What do you need help with?
            </label>
            <select
              id="support-reason"
              className="auth-input"
              value={supportReason}
              onChange={(e) => setSupportReason(e.target.value)}
              disabled={isSubmitting}
              style={{ appearance: "auto" }}
            >
              <option value="lost-device">Lost or stolen MFA device</option>
              <option value="new-phone">
                Got a new phone — didn&apos;t transfer TOTP seeds
              </option>
              <option value="no-codes">
                Never saved or cannot find recovery codes
              </option>
              <option value="broken-key">
                Hardware security key is broken or damaged
              </option>
              <option value="other">Other / not sure</option>
            </select>
          </div>

          <div className="auth-input-group">
            <label className="auth-label" htmlFor="support-details">
              Additional details (optional)
            </label>
            <textarea
              id="support-details"
              className="auth-input"
              rows={3}
              placeholder="Anything that can help verify your account faster…"
              value={supportDetails}
              onChange={(e) => setSupportDetails(e.target.value)}
              disabled={isSubmitting}
              style={{
                minHeight: "5.5rem",
                resize: "vertical",
                lineHeight: 1.5,
              }}
            />
          </div>

          <label className="auth-checkbox">
            <input type="checkbox" required disabled={isSubmitting} />
            <span>
              I understand support will <strong>never</strong> ask me for my
              password or recovery codes over email or chat.
            </span>
          </label>

          <div className="auth-actions" style={{ gap: "0.5rem" }}>
            <button
              type="button"
              className="auth-button auth-button-ghost"
              onClick={() => goTo("choose-path")}
            >
              ← Back
            </button>
            <SubmitButton
              idleLabel="Submit request"
              busyLabel="Submitting…"
              busy={isSubmitting}
            />
          </div>
        </form>
      )}

      {/* Step 3: Re-enroll a new MFA method */}
      {step === "reenroll-method" && (
        <div className="auth-form" style={{ gap: "1rem" }}>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "1.15rem",
                fontWeight: 700,
              }}
            >
              Enroll a new second factor
            </h2>
            <p
              style={{
                margin: 0,
                color: "var(--muted)",
                fontSize: "0.9rem",
                lineHeight: 1.6,
              }}
            >
              To keep your workspace secure, you must enroll a new MFA method
              now. Old methods have been revoked.
            </p>
          </div>

          <div
            className="auth-message auth-message-warning"
            role="alert"
            aria-live="polite"
          >
            <span aria-hidden="true" className="auth-message-icon">
              ⚠
            </span>
            You will not be able to access the workspace until a new method is
            configured. After enrollment, save a fresh set of recovery codes in
            a safe place.
          </div>

          <MfaMethodChooser
            value={chosenMethod}
            onChange={(m) => setChosenMethod(m)}
            aria-label="Choose a new second-factor method to enroll"
          />

          <div className="auth-actions" style={{ gap: "0.5rem" }}>
            <button
              type="button"
              className="auth-button auth-button-ghost"
              onClick={() => setShowConfirmCancel(true)}
            >
              Cancel recovery
            </button>
            <button
              type="button"
              className="auth-button auth-button-primary"
              disabled={!chosenMethod}
              onClick={() => {
                if (!chosenMethod) return;
                addToast(
                  `${METHOD_DISPLAY[chosenMethod]} enrolled successfully.`,
                  "success",
                );
                setCodes(generateRecoveryCodes());
                goTo("complete");
              }}
            >
              {chosenMethod
                ? `Enroll ${METHOD_DISPLAY[chosenMethod]}`
                : "Select a method above"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === "complete" && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "grid",
            gap: "1.25rem",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              padding: "1.25rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(52, 211, 153, 0.35)",
              background:
                "linear-gradient(180deg, rgba(52, 211, 153, 0.08), rgba(96, 165, 250, 0.04))",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.875rem",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "3rem",
                  height: "3rem",
                  borderRadius: 999,
                  background: "linear-gradient(135deg, var(--accent), #60a5fa)",
                  color: "#04111f",
                  fontWeight: 800,
                  fontSize: "1.4rem",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              <div style={{ display: "grid", gap: "0.2rem" }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "1.1rem",
                  }}
                >
                  Recovery complete
                </div>
                <p
                  style={{
                    margin: 0,
                    color: "var(--muted)",
                    fontSize: "0.9rem",
                    lineHeight: 1.55,
                  }}
                >
                  Your account is secured with a fresh second-factor method.
                </p>
              </div>
            </div>
          </div>

          <div
            role="region"
            aria-label="Fresh recovery codes"
            style={{
              display: "grid",
              gap: "0.75rem",
              padding: "1rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--surface-strong)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "grid", gap: "0.2rem" }}>
                <div style={{ fontWeight: 700 }}>
                  Save these new recovery codes
                </div>
                <p
                  style={{
                    margin: 0,
                    color: "var(--muted)",
                    fontSize: "0.88rem",
                    lineHeight: 1.5,
                  }}
                >
                  Each code below is single-use. Store them in a password
                  manager or print them out.
                </p>
              </div>
              <button
                type="button"
                className="auth-inline-link"
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  cursor: "pointer",
                  justifyContent: "flex-start",
                  fontWeight: 600,
                  minHeight: "2.25rem",
                }}
                onClick={() => {
                  const text = codes.join("\n");
                  navigator.clipboard
                    ?.writeText(text)
                    .then(() =>
                      addToast(
                        "Recovery codes copied to clipboard.",
                        "success",
                      ),
                    )
                    .catch(() => {});
                }}
              >
                📋 Copy all
              </button>
            </div>
            <ol
              role="list"
              style={{
                margin: 0,
                padding: "0.75rem",
                borderRadius: "calc(var(--radius-sm) - 0.2rem)",
                background: "rgba(15, 23, 42, 0.7)",
                border: "1px solid var(--border)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))",
                gap: "0.5rem 1rem",
                listStyle: "none",
              }}
            >
              {codes.map((c, i) => (
                <li
                  key={c}
                  style={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: "0.85rem",
                    color: "var(--text)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: "1.25rem",
                      color: "var(--muted)",
                      fontSize: "0.75rem",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}.
                  </span>
                  <code>{c}</code>
                </li>
              ))}
            </ol>
          </div>

          <div className="auth-actions" style={{ gap: "0.5rem" }}>
            <button
              type="button"
              className="auth-button auth-button-secondary"
              onClick={() => navigate("/settings#security")}
            >
              Go to Security settings
            </button>
            <button
              type="button"
              className="auth-button auth-button-primary"
              onClick={onSuccess}
            >
              Continue to dashboard
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showConfirmCancel}
        title="Cancel recovery and return to sign in?"
        description="Any progress you made in this recovery flow (such as recovery code or support information you typed) will not be saved. You can restart recovery at any time from the sign-in screen."
        confirmText="Cancel recovery"
        cancelText="Stay in recovery flow"
        tone="danger"
        onConfirm={() => {
          setShowConfirmCancel(false);
          onBack();
        }}
        onClose={() => setShowConfirmCancel(false)}
      />
    </AuthShell>
  );
}

const METHOD_DISPLAY: Record<MfaMethod, string> = {
  totp: "Authenticator app",
  sms: "SMS text message",
  "security-key": "Security key",
};

// ─── Login state router ──────────────────────────────────────────────────────

const MOCK_USER_NAME = "Joel Agboola";
const MOCK_USER_EMAIL = "joel@veritasor.example";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forcedState = searchParams.get("state");
  const location = useLocation();
  // `?next=` comes from RequireAuth; `state.from` from Layout's session-expiry redirect.
  const from = (location.state as { from?: Partial<Location> } | null)?.from;
  const nextPath = safeNextPath(
    searchParams.get("next") ??
      (from?.pathname ? `${from.pathname}${from.search ?? ""}${from.hash ?? ""}` : null),
  );
  const { signIn } = useAuth();
  const [pendingEmail, setPendingEmail] = useState("");

  const [state, setState] = useState<LoginState>(() => {
    if (forcedState === "mfa-recover" || forcedState === "mfa-recovery")
      return "mfa-recovery";
    return "credentials";
  });

  useEffect(() => {
    if (forcedState === "mfa-recover" || forcedState === "mfa-recovery")
      setState("mfa-recovery");
  }, [forcedState]);

  const returnToCredentials = () => {
    setState("credentials");
    navigate("/login", { replace: true });
  };

  // Mock session: only non-secret display data is recorded.
  const completeSignIn = () => {
    signIn({ name: MOCK_USER_NAME, email: pendingEmail || MOCK_USER_EMAIL });
    navigate(nextPath, { replace: true });
  };

  if (state === "mfa-recovery") {
    return (
      <MfaRecoveryFlowState
        onBack={returnToCredentials}
        onSuccess={completeSignIn}
      />
    );
  }

  if (state === "mfa-challenge") {
    return (
      <MfaChallengeState
        onBack={returnToCredentials}
        onSuccess={completeSignIn}
      />
    );
  }

  return (
    <CredentialsState
      onContinue={(email) => {
        setPendingEmail(email);
        setState("mfa-challenge");
      }}
    />
  );
}
