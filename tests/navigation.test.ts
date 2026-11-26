import { describe, expect, it } from "vitest";
import { notificationArea, notificationHref } from "@/app/notifications/links";
import { navigationModel } from "@/components/ui";
import { translator } from "@/lib/i18n";

const note = (type: string, extra: { dealId?: string; gateVisitId?: string } = {}) => ({
  type, dealId: extra.dealId ?? null, gateVisitId: extra.gateVisitId ?? null,
});

describe("notification deep links", () => {
  it("opens the exact entry ticket for a gate request", () => {
    expect(notificationHref(note("gate_request", { gateVisitId: "gv_1" }))).toBe("/society/visitors#visit-gv_1");
  });

  it("falls back to the entry queue when a gate update has no ticket", () => {
    expect(notificationHref(note("gate_request"))).toBe("/society/visitors#gate-entry-requests");
  });

  it("sends booking milestones to the booking and other deal updates to the deal", () => {
    expect(notificationHref(note("locked", { dealId: "d1" }))).toBe("/bookings#booking-d1");
    expect(notificationHref(note("price_drop", { dealId: "d1" }))).toBe("/deal/d1");
  });

  it("lands society updates on the matching community section", () => {
    expect(notificationHref(note("society_notice"))).toBe("/society/community#notices");
    expect(notificationHref(note("society_meeting"))).toBe("/society/community#meetings");
    expect(notificationHref(note("society_poll"))).toBe("/society/community#polls");
    expect(notificationHref(note("society_dues_reminder"))).toBe("/society/finance");
    expect(notificationHref(note("society_complaint"))).toBe("/society/complaints");
  });

  it("has no link for an update with nowhere to go", () => {
    expect(notificationHref(note("something_new"))).toBeUndefined();
  });

  it("groups updates by society area", () => {
    expect(notificationArea("gate_request")).toBe("gate");
    expect(notificationArea("society_dues_reminder")).toBe("dues");
    expect(notificationArea("price_drop")).toBe("booking");
  });
});

describe("resident navigation", () => {
  const { groups, tabs } = navigationModel();

  it("keeps the phone bar to five society-first tabs", () => {
    expect(tabs.map((t) => t.href)).toEqual(["/", "/society/visitors", "/society", "/society/finance", "/profile"]);
  });

  it("gives every sidebar destination a phone tab that owns it", () => {
    for (const link of groups.flatMap((g) => g.links)) {
      expect(tabs.some((t) => t.owns.includes(link.key)), link.key).toBe(true);
    }
  });

  it("reaches the daily society modules and bookings from the sidebar", () => {
    const hrefs = groups.flatMap((g) => g.links.map((l) => l.href));
    for (const href of ["/society/visitors", "/society/community", "/society/finance", "/society/complaints", "/society", "/explore", "/bookings"]) {
      expect(hrefs).toContain(href);
    }
  });

  it("uses translated labels where the dictionary has them", () => {
    const hi = navigationModel(translator("hi"));
    expect(hi.tabs.find((t) => t.key === "society")?.label).toBe("सोसायटी");
    expect(hi.tabs.find((t) => t.key === "finance")?.label).toBe("शुल्क");
  });
});
