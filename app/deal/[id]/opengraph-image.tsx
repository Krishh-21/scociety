import { ImageResponse } from "next/og";
import { getDealView } from "@/lib/deals";
import { rupeesPlain as rupees } from "@/lib/pricing";

// The card uses the server's Node database driver.
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A JODO group booking";

/**
 * The card that shows up when the deal link is pasted into a WhatsApp group:
 * the counter and the price, which is the whole pitch.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await getDealView(id);

  if (!deal) {
    return new ImageResponse(
      (
        <div style={{ ...base, justifyContent: "center", alignItems: "center" }}>
          <div style={{ fontSize: 56, fontWeight: 800 }}>JODO</div>
        </div>
      ),
      size,
    );
  }

  const locked = deal.status === "locked" || deal.status === "in_progress" || deal.status === "completed";

  return new ImageResponse(
    (
      <div style={base}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5, color: "#156348" }}>JODO</div>
          <div style={{ fontSize: 24, color: "#52675b" }}>{deal.society.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.05, color: "#132c24" }}>{deal.sku.name}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
            <div style={{ fontSize: 108, fontWeight: 800, color: "#156348", lineHeight: 1 }}>
              {rupees(deal.currentPricePaise)}
            </div>
            <div style={{ fontSize: 34, color: "#5d6e64", textDecoration: "line-through", paddingBottom: 12 }}>
              {rupees(deal.listPricePaise)}
            </div>
            <div style={{ fontSize: 28, color: "#52675b", paddingBottom: 14 }}>per {deal.sku.unitLabel}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#344d42" }}>
            {locked
              ? `${deal.basisCount} ${deal.basisLabel} booked together · one vendor`
              : `${deal.basisCount} of ${deal.targetFlats} ${deal.basisLabel} joined`}
          </div>
          <div style={{ display: "flex", width: "100%", height: 20, background: "#dce3d9", borderRadius: 999 }}>
            <div
              style={{
                width: `${Math.max(4, Math.min(100, Math.round((deal.basisCount / deal.targetFlats) * 100)))}%`,
                background: locked ? "#28734b" : "#156348",
                borderRadius: 999,
              }}
            />
          </div>
          <div style={{ fontSize: 28, color: "#52675b" }}>
            {deal.nextSlab
              ? `${deal.nextSlab.away} more and everyone pays ${rupees(deal.nextSlab.pricePaise)}`
              : "Best group price unlocked"}
          </div>
        </div>
      </div>
    ),
    size,
  );
}

const base = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
  padding: 64,
  background: "#f7f6f0",
  fontFamily: "sans-serif",
};
