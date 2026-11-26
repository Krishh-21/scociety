import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/Brand";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;

const modules = ["Visitor approvals", "Society notices", "Maintenance dues", "Shared amenities"];

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: 74, background: "#fbfaf7", color: "#17223b", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 35, fontWeight: 700 }}>
          <BrandMark size={56} />
          <span>{SITE_NAME}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 82, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3, maxWidth: 800 }}>
            {SITE_TAGLINE}
          </div>
          <div style={{ fontSize: 32, color: "#566379" }}>For residents, committees and gate staff</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {modules.map((module) => (
            <div key={module} style={{ display: "flex", padding: "12px 18px", borderRadius: 12, color: "#293faa", background: "#ebeeff", fontSize: 23, fontWeight: 600 }}>
              {module}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
