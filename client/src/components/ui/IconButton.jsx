import "./IconButton.css";

export function IconButton({ icon: Icon, label, onClick, size = 24, ...rest }) {
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={label}
      onClick={onClick}
      {...rest}
    >
      <Icon size={size} aria-hidden="true" />
    </button>
  );
}
