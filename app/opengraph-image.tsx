import { ImageResponse } from "next/og";

/**
 * The share card for every page that doesn't ship its own image — the site
 * root, /catalog, and anything added later.
 *
 * Both the root layout and the home page already declared
 * `card: "summary_large_image"` while shipping no image at all, so sharing the
 * site anywhere rendered a card with an empty image slot. A single cat page had
 * an image (its photo); the domain itself did not.
 *
 * Deliberately self-contained: no remote fetch, no filesystem read, no custom
 * font loading. It is generated once at build and cannot fail at request time
 * for a cat that has no photo, a font that didn't resolve, or an origin that
 * isn't serving yet. Brand identity is carried by colour and type instead.
 *
 * Colours are hardcoded because ImageResponse resolves no CSS variables — these
 * mirror the tokens in app/globals.css (brand green / orange / cream).
 */

export const alt =
  "AGILA CATalog — adopt/foster a campus cat from Ateneo de Manila University, Quezon City";
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
          justifyContent: "space-between",
          backgroundColor: "#239547",
          padding: "72px 80px",
        }}
      >
        {/* Wordmark row */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: "#eb6324",
              display: "flex",
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 30,
              letterSpacing: 6,
              color: "#fff7ea",
              fontWeight: 700,
            }}
          >
            AGILA CATALOG
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 104,
              lineHeight: 1.02,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: -3,
            }}
          >
            Adopt a campus cat
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 26,
              fontSize: 38,
              color: "#fff7ea",
              opacity: 0.92,
            }}
          >
            Meet the cats of Ateneo looking for homes.
          </div>
        </div>

        {/* Footer rule + origin */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              width: 140,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#eb6324",
              marginBottom: 26,
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 28,
              color: "#fff7ea",
              opacity: 0.85,
            }}
          >
            Ateneo de Manila University · Quezon City
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
