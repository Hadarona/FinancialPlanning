import "./Button.css";

export function Button({
  children,
  variant = "primary",
  type = "button",
  disabled = false,
  loading = false,
  onClick,
  ...rest
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      className={`btn btn-${variant}`}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onClick={onClick}
      {...rest}
    >
      {loading && <span className="btn-spinner" aria-hidden="true" />}
      <span className="btn-label">{children}</span>
    </button>
  );
}
