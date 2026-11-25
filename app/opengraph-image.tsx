import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "JODO — your building books together. Everyone pays less.";

/** The card shown when the site link is shared: the promise and the ladder, nothing else. */
export default function Image() {
  const ladder: [string, string, boolean][] = [
    ["Solo", "Rs 999", false],
    ["10+ ACs", "Rs 749", false],
    ["20+ ACs", "Rs 645", true],
    ["35+ ACs", "Rs 599", false],
  ];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#f7f6f0",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#156348", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 5 }}>
            <div style={{ width: 26, height: 9, borderRadius: 3, background: "#dce99e" }} />
            <div style={{ width: 26, height: 9, borderRadius: 3, background: "#ffffff" }} />
            <div style={{ width: 26, height: 9, borderRadius: 3, background: "#ffffff" }} />
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, color: "#132c24" }}>jodo</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, color: "#132c24" }}>Your building books together.</div>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, color: "#156348" }}>Everyone pays less.</div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {ladder.map(([label, price, on]) => (
            <div
              key={label}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "18px 26px",
                borderRadius: 20,
                background: on ? "#dce99e" : "#fffefa",
                border: on ? "3px solid #156348" : "2px solid #dce3d9",
              }}
            >
              <div style={{ fontSize: 24, color: on ? "#104f39" : "#52675b" }}>{label}</div>
              <div style={{ fontSize: 40, fontWeight: 800, color: "#132c24" }}>{price}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
