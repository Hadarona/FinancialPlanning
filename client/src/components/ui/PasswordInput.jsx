import { useId, useRef, useState } from "react";
import { LockKeyhole, Eye, EyeOff } from "lucide-react";
import { copy } from "../../lib/copy.js";
import "./TextInput.css";
import "./PasswordInput.css";

/** Password field with a show/hide toggle. The toggle keeps focus on
 * itself (D-AUTH-D3): activating it never moves focus into the input. */
export function PasswordInput({ label, value, onChange, error, ...rest }) {
  const inputId = useId();
  const errorId = useId();
  const [visible, setVisible] = useState(false);
  const toggleRef = useRef(null);

  function toggleVisibility() {
    setVisible((current) => !current);
    toggleRef.current?.focus();
  }

  return (
    <div className="field">
      <label htmlFor={inputId} className="field-label">
        {label}
      </label>
      <div className={`field-control${error ? " field-control-error" : ""}`}>
        <LockKeyhole className="field-icon" aria-hidden="true" size={20} />
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : undefined}
          {...rest}
        />
        <button
          type="button"
          ref={toggleRef}
          className="password-toggle"
          aria-pressed={visible}
          aria-label={visible ? copy.password.hide : copy.password.show}
          onClick={toggleVisibility}
        >
          {visible ? (
            <EyeOff size={20} aria-hidden="true" />
          ) : (
            <Eye size={20} aria-hidden="true" />
          )}
        </button>
      </div>
      {error ? (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
