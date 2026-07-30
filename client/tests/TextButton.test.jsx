import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextButton } from "../src/components/ui/TextButton.jsx";

describe("TextButton", () => {
  it("renders a non-submitting button by default and forwards clicks", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<TextButton onClick={onClick}>Create account</TextButton>);

    const button = screen.getByRole("button", { name: "Create account" });
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("passes through an explicit type and extra attributes", () => {
    render(
      <TextButton type="submit" aria-describedby="hint">
        Sign in
      </TextButton>,
    );
    const button = screen.getByRole("button", { name: "Sign in" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("aria-describedby", "hint");
  });
});
