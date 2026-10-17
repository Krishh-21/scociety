import { describe, expect, it } from "vitest";
import {
  commission, currentPrice, discountPct, effectivePrice, ladderRaisesPrice, nextSlab,
  rupees, savings, validateSlabs,
} from "@/lib/pricing";
import type { Slab } from "@/lib/types";

const LIST = 99900;
const LADDER: Slab[] = [
  { minFlats: 5, pricePaise: 84900 },
  { minFlats: 10, pricePaise: 74900 },
  { minFlats: 20, pricePaise: 64500 },
  { minFlats: 35, pricePaise: 59900 },
];

describe("currentPrice", () => {
  it("charges list price below the first slab", () => {
    expect(currentPrice(LIST, LADDER, 0)).toBe(LIST);
    expect(currentPrice(LIST, LADDER, 4)).toBe(LIST);
  });

  it("takes the highest slab the count has unlocked", () => {
    expect(currentPrice(LIST, LADDER, 5)).toBe(84900);
    expect(currentPrice(LIST, LADDER, 19)).toBe(74900);
    expect(currentPrice(LIST, LADDER, 20)).toBe(64500);
    expect(currentPrice(LIST, LADDER, 1000)).toBe(59900);
  });

  it("does not care what order the slabs are written in", () => {
    expect(currentPrice(LIST, [...LADDER].reverse(), 20)).toBe(64500);
  });
});

describe("effectivePrice", () => {
  it("is the slab price when no floor has been reached", () => {
    expect(effectivePrice(74900, null)).toBe(74900);
  });

  it("never charges more than the floor the deal already reached", () => {
    // 20 flats got to ₹645; one leaves and the slab says ₹749 again.
    expect(effectivePrice(74900, 64500)).toBe(64500);
  });

  it("still follows the slab down past the floor", () => {
    expect(effectivePrice(59900, 64500)).toBe(59900);
  });
});

describe("nextSlab", () => {
  it("reports the distance to the next price", () => {
    expect(nextSlab(LADDER, 17)).toMatchObject({ away: 3, pricePaise: 64500 });
  });

  it("is null once the last slab is unlocked", () => {
    expect(nextSlab(LADDER, 35)).toBeNull();
  });
});

describe("validateSlabs", () => {
  it("accepts a strictly falling ladder", () => {
    expect(validateSlabs(LIST, LADDER)).toBeNull();
  });

  it("rejects a slab that is not cheaper than the one before", () => {
    expect(validateSlabs(LIST, [
      { minFlats: 5, pricePaise: 84900 },
      { minFlats: 10, pricePaise: 84900 },
    ])).toMatch(/cheaper/);
  });

  it("rejects a slab dearer than the list price", () => {
    expect(validateSlabs(LIST, [{ minFlats: 5, pricePaise: 120000 }])).toMatch(/cheaper/);
  });

  it("rejects slabs that do not step up in flats", () => {
    expect(validateSlabs(LIST, [
      { minFlats: 10, pricePaise: 84900 },
      { minFlats: 10, pricePaise: 74900 },
    ])).toMatch(/more flats/);
  });

  it("rejects an empty ladder", () => {
    expect(validateSlabs(LIST, [])).toMatch(/at least one/);
  });
});

describe("ladderRaisesPrice", () => {
  it("passes an edit that is cheaper everywhere", () => {
    const cheaper = LADDER.map((s) => ({ ...s, pricePaise: s.pricePaise - 1000 }));
    expect(ladderRaisesPrice(LIST, LADDER, cheaper, 40)).toBeNull();
  });

  it("catches a vendor raising the slab people already joined at", () => {
    const dearer = LADDER.map((s) => (s.minFlats === 20 ? { ...s, pricePaise: 74000 } : s));
    const raise = ladderRaisesPrice(LIST, LADDER, dearer, 40);
    expect(raise).toMatchObject({ atCount: 20, from: 64500, to: 74000 });
  });

  it("catches a slab quietly moved out of reach", () => {
    const moved = LADDER.map((s) => (s.minFlats === 20 ? { ...s, minFlats: 30 } : s));
    expect(ladderRaisesPrice(LIST, LADDER, moved, 40)).not.toBeNull();
  });
});

describe("money formatting", () => {
  it("formats rupees in the Indian grouping", () => {
    expect(rupees(100000)).toBe("₹1,000");
    expect(rupees(14230000)).toBe("₹1,42,300");
  });

  it("computes savings and discount from the list price", () => {
    expect(savings(LIST, 64500)).toBe(35400);
    expect(discountPct(LIST, 64500)).toBe(35);
  });

  it("takes 15% commission", () => {
    expect(commission(100000)).toBe(15000);
  });
});
