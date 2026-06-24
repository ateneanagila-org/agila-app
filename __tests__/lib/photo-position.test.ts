import {
  DEFAULT_PHOTO_POSITION,
  isIdentityPosition,
  positionFromCat,
  getOffsetBounds,
  clampPosition,
  getPhotoTransformStyle,
} from "@/lib/photo-position";

describe("isIdentityPosition", () => {
  it("true for the default identity", () => {
    expect(isIdentityPosition(DEFAULT_PHOTO_POSITION)).toBe(true);
    expect(isIdentityPosition({ zoom: 1, offsetX: 0, offsetY: 0 })).toBe(true);
  });

  it("false when any component is non-default", () => {
    expect(isIdentityPosition({ zoom: 1.5, offsetX: 0, offsetY: 0 })).toBe(false);
    expect(isIdentityPosition({ zoom: 1, offsetX: 3, offsetY: 0 })).toBe(false);
    expect(isIdentityPosition({ zoom: 1, offsetX: 0, offsetY: -2 })).toBe(false);
  });
});

describe("positionFromCat", () => {
  it("reads stored values", () => {
    expect(
      positionFromCat({ photo_zoom: 2, photo_offset_x: 10, photo_offset_y: -5 }),
    ).toEqual({ zoom: 2, offsetX: 10, offsetY: -5 });
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
    expect(clampPosition({ zoom: 0.2, offsetX: 0, offsetY: 0 }, { x: 50, y: 50 }).zoom).toBe(1);
    expect(clampPosition({ zoom: 9, offsetX: 0, offsetY: 0 }, { x: 50, y: 50 }).zoom).toBe(3);
  });

  it("clamps offsets to the supplied bounds", () => {
    expect(
      clampPosition({ zoom: 2, offsetX: 999, offsetY: -999 }, { x: 50, y: 40 }),
    ).toEqual({ zoom: 2, offsetX: 50, offsetY: -40 });
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
      { zoom: 1, offsetX: 0, offsetY: 0 },
    );
    expect(s.width).toBe("200%");
    expect(s.height).toBe("100%");
    expect(s.left).toBe("calc(50% + 0%)");
    expect(s.transform).toBe("translate(-50%, -50%) scale(1)");
  });

  it("portrait image sizes by aspect", () => {
    const s = getPhotoTransformStyle(
      { width: 100, height: 200 },
      { zoom: 1.5, offsetX: 5, offsetY: -5 },
    );
    expect(s.width).toBe("100%");
    expect(s.height).toBe("200%");
    expect(s.transform).toContain("scale(1.5)");
  });

  it("re-clamps an out-of-bounds stored offset to the true image bounds (display safety)", () => {
    // A square at zoom 1 has zero pan room, so any stored offset collapses to 0.
    const s = getPhotoTransformStyle(
      { width: 100, height: 100 },
      { zoom: 1, offsetX: 500, offsetY: 500 },
    );
    expect(s.left).toBe("calc(50% + 0%)");
    expect(s.top).toBe("calc(50% + 0%)");
  });
});
