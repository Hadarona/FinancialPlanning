import { useId } from "react";
import "./TextInput.css";

/** Text input with a visible label rendered outside the field, and an
 * error message associated via aria-describedby (D-AUTH-D2). */
export function TextInput({
  label,
  type = "text",
  value,
  onChange,
  error,
  icon: Icon,
  ...rest
}) {
  const inputId = useId();
  const errorId = useId();

  return (
    <div className="field">
      <label htmlFor={inputId} className="field-label">
        {label}
      </label>
      <div className={`field-control${error ? " field-control-error" : ""}`}>
        {Icon ? <Icon className="field-icon" aria-hidden="true" size={20} /> : null}
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : undefined}
          {...rest}
        />
      </div>
      {error ? (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
