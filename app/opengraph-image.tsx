import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * The share card for every page that doesn't ship its own image — the site
 * root, /catalog, and anything added later.
 *
 * Both the root layout and the home page declared `card: "summary_large_image"`
 * while shipping no image at all, so sharing the site anywhere rendered a card
 * with an empty image slot.
 *
 * Styled to match the app shell rather than invent a look: brand dark is the
 * bottom nav / sidebar colour, cream is the content background, and the wordmark
 * uses SFC La Pura exactly as it does in the app. ImageResponse resolves no CSS
 * variables, so the values below are copied from app/globals.css.
 *
 * The fonts are read from disk at BUILD time — this route has no dynamic data,
 * so Next prerenders it and `public/` is present on the build machine. Keep it
 * that way: making this route dynamic would move the read to request time,
 * where `public/` may not be traced into the serverless bundle.
 */

const BRAND = {
  dark: "#341111",
  cream: "#fff7ea",
  green: "#239547",
  orange: "#eb6324",
  yellow: "#fff967",
} as const;

export const alt =
  "AGILA CATalog — adopt or foster a campus cat from Ateneo de Manila University, Quezon City";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Cat paw built from primitives — no asset, no SVG parsing, no fetch. */
function Paw({ color }: { color: string }) {
  const toes = [
    { left: 6, top: 74, w: 56, h: 72, r: -18 },
    { left: 76, top: 22, w: 58, h: 76, r: -7 },
    { left: 150, top: 22, w: 58, h: 76, r: 7 },
    { left: 220, top: 74, w: 56, h: 72, r: 18 },
  ];
  return (
    <div style={{ display: "flex", position: "relative", width: 282, height: 268 }}>
      {toes.map((t, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            position: "absolute",
            left: t.left,
            top: t.top,
            width: t.w,
            height: t.h,
            borderRadius: "50%",
            backgroundColor: color,
            transform: `rotate(${t.r}deg)`,
          }}
        />
      ))}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 44,
          top: 140,
          width: 194,
          height: 138,
          borderRadius: "50%",
          backgroundColor: color,
        }}
      />
    </div>
  );
}

export default async function OpengraphImage() {
  const fonts = join(process.cwd(), "public", "fonts");
  const [aveton, laPura] = await Promise.all([
    readFile(join(fonts, "AvetonRegular-MARon.ttf")),
    readFile(join(fonts, "SFC La Pura.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: BRAND.dark,
          fontFamily: "Aveton",
          overflow: "hidden",
        }}
      >
        {/* Soft warmth in the corner — a gradient, not a disc, so it has no
            hard edge to read as a shape competing with the badge. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 0,
            top: 0,
            width: 760,
            height: 630,
            backgroundImage: `radial-gradient(circle at 72% 46%, ${BRAND.green}59, ${BRAND.dark}00 62%)`,
          }}
        />

        {/* Cream badge — the app's own idiom: a rounded light surface sitting
            on a coloured field, the same shape every card in the UI uses. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 86,
            top: 131,
            width: 368,
            height: 368,
            borderRadius: 184,
            backgroundColor: BRAND.cream,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Paw color={BRAND.green} />
        </div>

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "74px 80px",
            width: 830,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                display: "flex",
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: BRAND.orange,
              }}
            />
            <div
              style={{
                display: "flex",
                fontFamily: "La Pura",
                fontSize: 40,
                color: BRAND.cream,
                letterSpacing: 1,
              }}
            >
              AGILA CATalog
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: 96,
                lineHeight: 1.04,
                color: BRAND.cream,
                letterSpacing: -1,
              }}
            >
              Adopt a Cat
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 96,
                lineHeight: 1.04,
                color: BRAND.yellow,
                letterSpacing: -1,
              }}
            >
              From Ateneo
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 28,
                fontSize: 34,
                color: BRAND.cream,
                opacity: 0.82,
              }}
            >
              Campus cats looking for homes.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                width: 132,
                height: 9,
                borderRadius: 5,
                backgroundColor: BRAND.orange,
                marginBottom: 24,
              }}
            />
            <div
              style={{
                display: "flex",
                fontSize: 27,
                color: BRAND.cream,
                opacity: 0.7,
              }}
            >
              Ateneo de Manila University · Quezon City
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Aveton", data: aveton, style: "normal", weight: 400 },
        { name: "La Pura", data: laPura, style: "normal", weight: 400 },
      ],
    },
  );
}
