import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TextInput } from "../components/ui/TextInput.jsx";
import { PasswordInput } from "../components/ui/PasswordInput.jsx";
import { Button } from "../components/ui/Button.jsx";
import "../components/ui/TextButton.css";
import { useAuth } from "../app/AuthProvider.jsx";
import { copy } from "../lib/copy.js";
import { describeAuthError } from "../api/client.js";
import "./AuthPage.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function validate({ email, password }) {
  const errors = {};
  if (!email.trim()) {
    errors.email = "Enter your email.";
  } else if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!password) {
    errors.password = "Enter a password.";
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return errors;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
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
      await register({ email: email.trim(), password });
      navigate("/budget", { replace: true });
    } catch (err) {
      const described = describeAuthError(err, { conflictField: "email" });
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
        <h1 className="auth-title">{copy.register.title}</h1>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <TextInput
            label={copy.register.emailLabel}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldErrors.email}
          />
          <PasswordInput
            label={copy.register.passwordLabel}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
          />
          {formError ? (
            <p role="alert" className="auth-form-error">
              {formError}
            </p>
          ) : null}
          <Button type="submit" className="auth-submit" loading={submitting} disabled={submitting}>
            {copy.register.submitLabel}
          </Button>
        </form>
        <Link className="text-btn" to="/login">
          {copy.register.haveAccountLabel}
        </Link>
      </div>
    </main>
  );
}
