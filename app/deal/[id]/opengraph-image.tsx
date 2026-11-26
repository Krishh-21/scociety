import { ImageResponse } from "next/og";
import { isDemoMode } from "@/lib/auth-mode";
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
  const deal = isDemoMode() ? await getDealView(id) : null;

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
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5, color: "#314ec5" }}>JODO</div>
          <div style={{ fontSize: 24, color: "#566379" }}>{deal.society.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.05, color: "#17223b" }}>{deal.sku.name}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
            <div style={{ fontSize: 108, fontWeight: 800, color: "#314ec5", lineHeight: 1 }}>
              {rupees(deal.currentPricePaise)}
            </div>
            <div style={{ fontSize: 34, color: "#657187", textDecoration: "line-through", paddingBottom: 12 }}>
              {rupees(deal.listPricePaise)}
            </div>
            <div style={{ fontSize: 28, color: "#566379", paddingBottom: 14 }}>per {deal.sku.unitLabel}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#3b4962" }}>
            {locked
              ? `${deal.basisCount} ${deal.basisLabel} booked together · one vendor`
              : `${deal.basisCount} of ${deal.targetFlats} ${deal.basisLabel} joined`}
          </div>
          <div style={{ display: "flex", width: "100%", height: 20, background: "#dbe1ed", borderRadius: 999 }}>
            <div
              style={{
                width: `${Math.max(4, Math.min(100, Math.round((deal.basisCount / deal.targetFlats) * 100)))}%`,
                background: locked ? "#28734b" : "#314ec5",
                borderRadius: 999,
              }}
            />
          </div>
          <div style={{ fontSize: 28, color: "#566379" }}>
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
  background: "#fbfaf7",
  fontFamily: "sans-serif",
};
