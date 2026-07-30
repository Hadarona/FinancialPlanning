import "./TextButton.css";

export function TextButton({ children, type = "button", onClick, ...rest }) {
  return (
    <button type={type} className="text-btn" onClick={onClick} {...rest}>
      {children}
    </button>
  );
}
