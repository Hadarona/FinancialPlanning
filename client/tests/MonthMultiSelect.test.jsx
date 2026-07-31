import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MonthMultiSelect } from "../src/components/ui/MonthMultiSelect.jsx";
import { lastMonths } from "../src/lib/dates.js";

// Fixed option set spanning a year boundary (newest first from July 2026).
const OPTIONS = lastMonths(12, "2026-07");

function Harness({ initial = ["2026-07"], onChange = () => {} }) {
  const [selected, setSelected] = useState(initial);
  return (
    <MonthMultiSelect
      options={OPTIONS}
      selected={selected}
      onChange={(next) => {
        setSelected(next);
        onChange(next);
      }}
    />
  );
}

async function openList(initial) {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Harness initial={initial} onChange={onChange} />);
  await user.click(screen.getByRole("button", { name: /Months to compare/ }));
  await screen.findByRole("listbox");
  return { user, onChange };
}

describe("MonthMultiSelect (CR3-2)", () => {
  it("summarizes the selection on the trigger", () => {
    render(<Harness initial={["2026-07", "2026-06", "2026-05"]} />);
    const trigger = screen.getByRole("button", { name: /Months to compare/ });
    expect(trigger).toHaveTextContent("July 2026 + 2 more");
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("spans a year boundary: twelve options roll into the previous year (CR3-6)", async () => {
    await openList();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(12);
    expect(options[0]).toHaveTextContent("July 2026");
    expect(options[6]).toHaveTextContent("January 2026");
    expect(options[7]).toHaveTextContent("December 2025");
    expect(options[11]).toHaveTextContent("August 2025");
  });

  it("is a multiselect listbox that takes focus and roves with arrows", async () => {
    const { user } = await openList();
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("aria-multiselectable", "true");
    expect(document.activeElement).toBe(listbox);

    // Roving active descendant follows arrow keys.
    const initialActive = listbox.getAttribute("aria-activedescendant");
    await user.keyboard("{ArrowDown}");
    const nextActive = listbox.getAttribute("aria-activedescendant");
    expect(nextActive).not.toBe(initialActive);
    await user.keyboard("{Home}");
    expect(listbox.getAttribute("aria-activedescendant")).toBe(initialActive);
    await user.keyboard("{End}");
    const lastActive = listbox.getAttribute("aria-activedescendant");
    expect(document.getElementById(lastActive)).toHaveTextContent("August 2025");
  });

  it("toggles months with Space/Enter and reports a newest-first selection", async () => {
    const { user, onChange } = await openList(["2026-06"]);
    // Active starts on the first selected month (June 2026, index 1).
    await user.keyboard("{Home}");
    await user.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith(["2026-07", "2026-06"]);

    await user.keyboard("{ArrowDown}{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["2026-07", "2026-06", "2026-05"]);
  });

  it("disables unselected options at three and refuses a fourth with a visible hint", async () => {
    const { user, onChange } = await openList(["2026-07", "2026-06", "2026-05"]);

    const options = screen.getAllByRole("option");
    const disabled = options.filter(
      (option) => option.getAttribute("aria-disabled") === "true",
    );
    expect(disabled).toHaveLength(9);
    expect(options[0]).not.toHaveAttribute("aria-disabled");

    await user.click(screen.getByRole("option", { name: /April 2026/ }));
    expect(onChange).not.toHaveBeenCalled();
    const hint = screen.getByText("Select up to 3 months");
    expect(hint).toBeVisible();
    expect(hint.closest("[aria-live]")).not.toBeNull();
  });

  it("refuses to deselect the last remaining month with a visible hint", async () => {
    const { user, onChange } = await openList(["2026-07"]);
    await user.click(screen.getByRole("option", { name: /July 2026/ }));
    expect(onChange).not.toHaveBeenCalled();
    const hint = screen.getByText("Select at least 1 month");
    expect(hint).toBeVisible();
    expect(hint.closest("[aria-live]")).not.toBeNull();
  });

  it("marks selected options and shows a visible checkmark", async () => {
    await openList(["2026-07", "2026-05"]);
    expect(screen.getByRole("option", { name: /July 2026/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("option", { name: /June 2026/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("Escape closes the popup and returns focus to the trigger", async () => {
    const { user } = await openList();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /Months to compare/ }),
    );
    expect(document.activeElement).toHaveAttribute("aria-expanded", "false");
  });

  it("Tab closes the popup without trapping focus", async () => {
    const { user } = await openList();
    await user.keyboard("{Tab}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
