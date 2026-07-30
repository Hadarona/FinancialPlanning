import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { TextInput } from "../components/ui/TextInput.jsx";
import { PasswordInput } from "../components/ui/PasswordInput.jsx";
import { Button } from "../components/ui/Button.jsx";
import "../components/ui/TextButton.css";
import { useAuth } from "../app/AuthProvider.jsx";
import { copy } from "../lib/copy.js";
import { describeAuthError } from "../api/client.js";
import "./AuthPage.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ email, password }) {
  const errors = {};
  if (!email.trim()) {
    errors.email = "Enter your email.";
  } else if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!password) {
    errors.password = "Enter your password.";
  }
  return errors;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get("reason") === "session-expired";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    const errors = validate({ email, password });
    setFieldErrors(errors);
    setFormError("");
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      const redirectTo = location.state?.from?.pathname ?? "/budget";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const described = describeAuthError(err);
      setFieldErrors(described.fieldErrors);
      setFormError(described.formError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <img src="/logo.svg" alt="" width={80} height={80} className="auth-logo" />
        <h1 className="auth-title">{copy.login.title}</h1>
        {sessionExpired ? (
          <p role="status" className="auth-session-expired">
            {copy.session.expired}
          </p>
        ) : null}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <TextInput
            label={copy.login.emailLabel}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldErrors.email}
          />
          <PasswordInput
            label={copy.login.passwordLabel}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
          />
          {formError ? (
            <p role="alert" className="auth-form-error">
              {formError}
            </p>
          ) : null}
          <Button
            type="submit"
            className="auth-submit"
            loading={submitting}
            disabled={submitting}
          >
            {copy.login.submitLabel}
          </Button>
        </form>
        <Link className="text-btn" to="/register">
          {copy.login.createAccountLabel}
        </Link>
      </div>
    </main>
  );
}
