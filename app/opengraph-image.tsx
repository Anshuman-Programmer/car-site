import { ImageResponse } from "next/og";
import { profile } from "@/data/profile";

export const alt = `${profile.name} — interactive 3D portfolio`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 72,
          background: "linear-gradient(180deg, #ffc6a8 0%, #b49ae0 45%, #241a31 100%)",
          color: "#fff6ea",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.85, marginBottom: 12 }}>Take a drive through my work</div>
        <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1 }}>{profile.name}</div>
        <div style={{ fontSize: 36, marginTop: 18, color: "#ffd166" }}>{profile.headline}</div>
      </div>
    ),
    size,
  );
}
