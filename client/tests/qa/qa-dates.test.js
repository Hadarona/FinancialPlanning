// QA-CU-05..06: independent unit coverage of client/src/lib/dates.js.
import { describe, it, expect } from "vitest";
import {
  previousMonth,
  nextMonth,
  monthRange,
  monthLabel,
  monthYearLabel,
  shortDateLabel,
} from "../../src/lib/dates.js";

describe("QA-CU-05: previousMonth / nextMonth rollover", () => {
  it("previousMonth('2026-01') === '2025-12'", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
  });

  it("nextMonth('2025-12') === '2026-01'", () => {
    expect(nextMonth("2025-12")).toBe("2026-01");
  });
});

describe("QA-CU-06: monthRange / monthLabel / monthYearLabel / shortDateLabel", () => {
  it("monthRange is leap-aware", () => {
    expect(monthRange("2028-02")).toEqual({
      firstDay: "2028-02-01",
      lastDay: "2028-02-29",
    });
    expect(monthRange("2026-07")).toEqual({
      firstDay: "2026-07-01",
      lastDay: "2026-07-31",
    });
  });

  it("produces the documented labels", () => {
    expect(monthLabel("2026-07")).toBe("July");
    expect(monthYearLabel("2026-07")).toBe("July 2026");
    expect(shortDateLabel("2026-07-15")).toBe("Jul 15");
  });
});
