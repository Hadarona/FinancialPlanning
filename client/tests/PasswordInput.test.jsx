import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordInput } from "../src/components/ui/PasswordInput.jsx";

describe("PasswordInput", () => {
  it("toggles visibility and keeps focus on the toggle button, not the input", async () => {
    render(<PasswordInput label="Password" value="secret123" onChange={() => {}} />);
    const user = userEvent.setup();
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    const showToggle = screen.getByRole("button", { name: "Show password" });
    await user.click(showToggle);

    expect(input).toHaveAttribute("type", "text");
    const hideToggle = screen.getByRole("button", { name: "Hide password" });
    expect(hideToggle).toHaveFocus();
    expect(hideToggle).toHaveAttribute("aria-pressed", "true");
  });
});
