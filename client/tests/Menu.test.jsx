import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu } from "../src/components/ui/Menu.jsx";

describe("Menu", () => {
  it("opens on trigger click, disables Edit budget, and calls onSelect for Logout", async () => {
    const onLogout = vi.fn();
    render(
      <Menu
        items={[
          { label: "Edit budget", disabled: true },
          { label: "Logout", onSelect: onLogout },
        ]}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "More options" }));

    expect(screen.getByRole("menuitem", { name: "Edit budget" })).toBeDisabled();

    await user.click(screen.getByRole("menuitem", { name: "Logout" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
