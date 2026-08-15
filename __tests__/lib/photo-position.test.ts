import {
  DEFAULT_PHOTO_POSITION,
  isIdentityPosition,
  positionFromCat,
  getOffsetBounds,
  clampPosition,
  getPhotoTransformStyle,
  normalizeRotation,
} from "@/lib/photo-position";

describe("isIdentityPosition", () => {
  it("true for the default identity", () => {
    expect(isIdentityPosition(DEFAULT_PHOTO_POSITION)).toBe(true);
    expect(
      isIdentityPosition({ zoom: 1, offsetX: 0, offsetY: 0, rotation: 0 }),
    ).toBe(true);
  });

  it("false when any component is non-default", () => {
    expect(
      isIdentityPosition({ zoom: 1.5, offsetX: 0, offsetY: 0, rotation: 0 }),
    ).toBe(false);
    expect(
      isIdentityPosition({ zoom: 1, offsetX: 3, offsetY: 0, rotation: 0 }),
    ).toBe(false);
    expect(
      isIdentityPosition({ zoom: 1, offsetX: 0, offsetY: -2, rotation: 0 }),
    ).toBe(false);
  });
});

describe("positionFromCat", () => {
  it("reads stored values", () => {
    expect(
      positionFromCat({ photo_zoom: 2, photo_offset_x: 10, photo_offset_y: -5 }),
    ).toEqual({ zoom: 2, offsetX: 10, offsetY: -5, rotation: 0 });
  });

  it("falls back to identity for null/undefined columns (legacy rows)", () => {
    expect(positionFromCat({})).toEqual(DEFAULT_PHOTO_POSITION);
    expect(
      positionFromCat({ photo_zoom: null, photo_offset_x: null, photo_offset_y: null }),
    ).toEqual(DEFAULT_PHOTO_POSITION);
  });
});

describe("getOffsetBounds", () => {
  it("square image: no pan room at zoom 1, symmetric room when zoomed", () => {
    expect(getOffsetBounds({ width: 100, height: 100 }, 1)).toEqual({ x: 0, y: 0 });
    expect(getOffsetBounds({ width: 100, height: 100 }, 2)).toEqual({ x: 50, y: 50 });
  });

  it("landscape image: horizontal pan room even at zoom 1", () => {
    // 2:1 normalizes the short side to 1, long side to 2 -> ((2-1)/2)*100 = 50
    expect(getOffsetBounds({ width: 200, height: 100 }, 1)).toEqual({ x: 50, y: 0 });
  });

  it("offsets can legitimately exceed 100 when zoomed (server clamp must allow it)", () => {
    // 2:1 at zoom 3 -> long side normalized to 6 -> ((6-1)/2)*100 = 250
    expect(getOffsetBounds({ width: 200, height: 100 }, 3).x).toBe(250);
  });

  it("returns a safe default when size is unknown", () => {
    expect(getOffsetBounds(null, 1)).toEqual({ x: 50, y: 50 });
  });
});

describe("clampPosition", () => {
  it("clamps zoom into [1,3]", () => {
    expect(
      clampPosition(
        { zoom: 0.2, offsetX: 0, offsetY: 0, rotation: 0 },
        { x: 50, y: 50 },
      ).zoom,
    ).toBe(1);
    expect(
      clampPosition(
        { zoom: 9, offsetX: 0, offsetY: 0, rotation: 0 },
        { x: 50, y: 50 },
      ).zoom,
    ).toBe(3);
  });

  it("clamps offsets to the supplied bounds", () => {
    expect(
      clampPosition(
        { zoom: 2, offsetX: 999, offsetY: -999, rotation: 0 },
        { x: 50, y: 40 },
      ),
    ).toEqual({ zoom: 2, offsetX: 50, offsetY: -40, rotation: 0 });
  });
});

describe("getPhotoTransformStyle", () => {
  it("identity with unknown size falls back to centered cover", () => {
    const s = getPhotoTransformStyle(null, DEFAULT_PHOTO_POSITION);
    expect(s.left).toBe("50%");
    expect(s.top).toBe("50%");
    expect(s.width).toBe("100%");
    expect(s.height).toBe("100%");
    expect(s.objectFit).toBe("cover");
    expect(s.transform).toContain("scale(1)");
  });

  it("landscape image sizes by aspect and applies offset + zoom", () => {
    const s = getPhotoTransformStyle(
      { width: 200, height: 100 },
      { zoom: 1, offsetX: 0, offsetY: 0, rotation: 0 },
    );
    expect(s.width).toBe("200%");
    expect(s.height).toBe("100%");
    expect(s.left).toBe("calc(50% + 0%)");
    expect(s.transform).toBe("translate(-50%, -50%) scale(1) rotate(0deg)");
  });

  it("portrait image sizes by aspect", () => {
    const s = getPhotoTransformStyle(
      { width: 100, height: 200 },
      { zoom: 1.5, offsetX: 5, offsetY: -5, rotation: 0 },
    );
    expect(s.width).toBe("100%");
    expect(s.height).toBe("200%");
    expect(s.transform).toContain("scale(1.5)");
  });

  it("re-clamps an out-of-bounds stored offset to the true image bounds (display safety)", () => {
    // A square at zoom 1 has zero pan room, so any stored offset collapses to 0.
    const s = getPhotoTransformStyle(
      { width: 100, height: 100 },
      { zoom: 1, offsetX: 500, offsetY: 500, rotation: 0 },
    );
    expect(s.left).toBe("calc(50% + 0%)");
    expect(s.top).toBe("calc(50% + 0%)");
  });
});

describe("normalizeRotation", () => {
  it("passes through the four allowed angles", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(180)).toBe(180);
    expect(normalizeRotation(270)).toBe(270);
  });

  it("falls back to 0 for anything else", () => {
    expect(normalizeRotation(45)).toBe(0);
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(-90)).toBe(0);
    expect(normalizeRotation("90")).toBe(0);
    expect(normalizeRotation(null)).toBe(0);
    expect(normalizeRotation(undefined)).toBe(0);
    expect(normalizeRotation(NaN)).toBe(0);
  });
});

describe("isIdentityPosition with rotation", () => {
  it("false when only rotation is non-zero", () => {
    expect(
      isIdentityPosition({ zoom: 1, offsetX: 0, offsetY: 0, rotation: 90 }),
    ).toBe(false);
  });

  it("true when rotation is 0 and the rest is identity", () => {
    expect(isIdentityPosition(DEFAULT_PHOTO_POSITION)).toBe(true);
    expect(DEFAULT_PHOTO_POSITION.rotation).toBe(0);
  });
});

describe("positionFromCat with rotation", () => {
  it("reads a stored rotation", () => {
    expect(
      positionFromCat({
        photo_zoom: 2,
        photo_offset_x: 10,
        photo_offset_y: -5,
        photo_rotation: 270,
      }),
    ).toEqual({ zoom: 2, offsetX: 10, offsetY: -5, rotation: 270 });
  });

  it("treats a null or absent photo_rotation as 0 (legacy rows)", () => {
    expect(positionFromCat({}).rotation).toBe(0);
    expect(positionFromCat({ photo_rotation: null }).rotation).toBe(0);
  });
});

describe("clampPosition preserves rotation", () => {
  it("carries rotation through untouched", () => {
    const clamped = clampPosition(
      { zoom: 5, offsetX: 999, offsetY: -999, rotation: 180 },
      { x: 10, y: 10 },
    );
    expect(clamped.rotation).toBe(180);
    expect(clamped.zoom).toBe(3);
    expect(clamped.offsetX).toBe(10);
    expect(clamped.offsetY).toBe(-10);
  });
});

describe("getOffsetBounds with rotation", () => {
  it("swaps width and height at 90 and 270", () => {
    const landscape = { width: 200, height: 100 };
    const at0 = getOffsetBounds(landscape, 1, 0);
    const at90 = getOffsetBounds(landscape, 1, 90);
    const at270 = getOffsetBounds(landscape, 1, 270);
    // Unrotated 2:1 landscape has horizontal pan room and none vertically.
    expect(at0.x).toBeCloseTo(50);
    expect(at0.y).toBeCloseTo(0);
    // Rotated a quarter turn, that room moves to the vertical axis.
    expect(at90.x).toBeCloseTo(0);
    expect(at90.y).toBeCloseTo(50);
    expect(at270).toEqual(at90);
  });

  it("does not swap at 0 and 180", () => {
    const landscape = { width: 200, height: 100 };
    expect(getOffsetBounds(landscape, 1, 180)).toEqual(
      getOffsetBounds(landscape, 1, 0),
    );
  });

  it("defaults to no rotation when the argument is omitted", () => {
    const landscape = { width: 200, height: 100 };
    expect(getOffsetBounds(landscape, 1)).toEqual(
      getOffsetBounds(landscape, 1, 0),
    );
  });
});

describe("getPhotoTransformStyle rotation coverage", () => {
  // The invariant: at zoom 1 the rendered image must fully cover the square
  // frame at every angle. Frame is 1x1 in these units; width/height come back
  // as percentage strings of that frame.
  const pct = (v: unknown) => Number(String(v).replace("%", ""));

  const covers = (
    imageSize: { width: number; height: number },
    rotation: number,
  ) => {
    const style = getPhotoTransformStyle(imageSize, {
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      rotation,
    });
    const w = pct(style.width);
    const h = pct(style.height);
    // Post-rotation footprint: a quarter turn swaps the axes.
    const swapped = rotation === 90 || rotation === 270;
    const footprintW = swapped ? h : w;
    const footprintH = swapped ? w : h;
    return footprintW >= 99.99 && footprintH >= 99.99;
  };

  it.each([0, 90, 180, 270])("landscape source covers at %i degrees", (r) => {
    expect(covers({ width: 200, height: 100 }, r)).toBe(true);
  });

  it.each([0, 90, 180, 270])("portrait source covers at %i degrees", (r) => {
    expect(covers({ width: 100, height: 200 }, r)).toBe(true);
  });

  it.each([0, 90, 180, 270])("square source covers at %i degrees", (r) => {
    expect(covers({ width: 150, height: 150 }, r)).toBe(true);
  });

  it("preserves the image's natural aspect ratio in the CSS box", () => {
    const style = getPhotoTransformStyle(
      { width: 200, height: 100 },
      { zoom: 1, offsetX: 0, offsetY: 0, rotation: 90 },
    );
    expect(pct(style.width) / pct(style.height)).toBeCloseTo(2);
  });

  it("includes a rotate() in the transform when rotated", () => {
    const style = getPhotoTransformStyle(
      { width: 200, height: 100 },
      { zoom: 1.5, offsetX: 0, offsetY: 0, rotation: 90 },
    );
    expect(String(style.transform)).toContain("rotate(90deg)");
    expect(String(style.transform)).toContain("scale(1.5)");
  });

  it("omits rotate() work at 0 degrees but still returns a valid transform", () => {
    const style = getPhotoTransformStyle(
      { width: 200, height: 100 },
      { zoom: 1, offsetX: 0, offsetY: 0, rotation: 0 },
    );
    expect(String(style.transform)).toContain("rotate(0deg)");
  });

  it("falls back to centered cover before the natural size is known", () => {
    const style = getPhotoTransformStyle(null, {
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      rotation: 90,
    });
    expect(style.objectFit).toBe("cover");
    expect(String(style.transform)).toContain("rotate(90deg)");
  });
});
