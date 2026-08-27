import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../src/components/ui/Button.jsx";

describe("Button", () => {
  it("renders its label", () => {
    render(<Button>Sign in</Button>);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("blocks clicks while disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Sign in
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows a busy state while loading and blocks clicks", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Sign in
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Sign in" });
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
