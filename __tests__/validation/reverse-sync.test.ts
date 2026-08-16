import {
  parseSheetRow,
  parseUnknownSheetRow,
  sheetRowSchema,
} from "@/lib/validation/reverse-sync";

const UUID = "11111111-1111-4111-8111-111111111111";

/** Build a 25-element sheet row (indices 0–24). Pass column→value overrides. */
function mkRow(overrides: Record<number, string>): string[] {
  const row = new Array<string>(25).fill("");
  for (const [idx, val] of Object.entries(overrides)) {
    row[Number(idx)] = val;
  }
  return row;
}

describe("parseSheetRow (standard region layout)", () => {
  it("returns null when col Y (UUID) is missing", () => {
    expect(parseSheetRow(mkRow({ 2: "Bella" }))).toBeNull();
  });

  describe("condition matrix (sick=col I[8], injured=col J[9])", () => {
    it("??? in either column → null (explicitly unknown)", () => {
      expect(parseSheetRow(mkRow({ 24: UUID, 8: "???", 9: "NO" }))?.condition).toBeNull();
      expect(parseSheetRow(mkRow({ 24: UUID, 8: "NO", 9: "???" }))?.condition).toBeNull();
    });

    it("YES + YES → Sick and Injured", () => {
      expect(parseSheetRow(mkRow({ 24: UUID, 8: "YES", 9: "YES" }))?.condition).toBe("Sick and Injured");
    });

    it("only sick → Sick, only injured → Injured", () => {
      expect(parseSheetRow(mkRow({ 24: UUID, 8: "YES", 9: "NO" }))?.condition).toBe("Sick");
      expect(parseSheetRow(mkRow({ 24: UUID, 8: "NO", 9: "YES" }))?.condition).toBe("Injured");
    });

    it("neither → Healthy", () => {
      expect(parseSheetRow(mkRow({ 24: UUID, 8: "NO", 9: "NO" }))?.condition).toBe("Healthy");
    });

    it("is case-insensitive", () => {
      expect(parseSheetRow(mkRow({ 24: UUID, 8: "yes", 9: "no" }))?.condition).toBe("Sick");
    });

    it("a blank column is null, not Healthy — absence is not a clean bill of health", () => {
      expect(parseSheetRow(mkRow({ 24: UUID, 8: "", 9: "NO" }))?.condition).toBeNull();
      expect(parseSheetRow(mkRow({ 24: UUID, 8: "NO", 9: "" }))?.condition).toBeNull();
      expect(parseSheetRow(mkRow({ 24: UUID }))?.condition).toBeNull();
    });

    it("an unrecognised value is null", () => {
      expect(parseSheetRow(mkRow({ 24: UUID, 8: "maybe", 9: "NO" }))?.condition).toBeNull();
    });
  });

  describe("neutered (col G[6])", () => {
    it("YES → true, NO → false, anything else → null", () => {
      expect(parseSheetRow(mkRow({ 24: UUID, 6: "YES" }))?.is_neutered).toBe(true);
      expect(parseSheetRow(mkRow({ 24: UUID, 6: "NO" }))?.is_neutered).toBe(false);
      expect(parseSheetRow(mkRow({ 24: UUID, 6: "???" }))?.is_neutered).toBeNull();
      expect(parseSheetRow(mkRow({ 24: UUID, 6: "" }))?.is_neutered).toBeNull();
    });
  });

  describe("enum whitelisting (invalid → null)", () => {
    it("keeps valid values", () => {
      const r = parseSheetRow(
        mkRow({ 24: UUID, 3: "Calico", 4: "Adult", 5: "Female", 7: "Feral", 11: "MIA" }),
      );
      expect(r).toMatchObject({
        color: "Calico",
        age: "Adult",
        sex: "Female",
        sociability: "Feral",
        cat_status: "MIA",
      });
    });

    it("rejects invalid values to null", () => {
      const r = parseSheetRow(
        mkRow({ 24: UUID, 3: "Purple", 4: "Ancient", 5: "Other", 7: "Shy", 11: "Sleeping" }),
      );
      expect(r).toMatchObject({
        color: null,
        age: null,
        sex: null,
        sociability: null,
        cat_status: null,
      });
    });
  });

  describe("adoptable (col K[10])", () => {
    it("YES → true (case-insensitive)", () => {
      expect(parseSheetRow(mkRow({ 24: UUID, 10: "YES" }))?.is_adoptable).toBe(true);
      expect(parseSheetRow(mkRow({ 24: UUID, 10: "yes" }))?.is_adoptable).toBe(true);
    });

    it("NO → false", () => {
      expect(parseSheetRow(mkRow({ 24: UUID, 10: "NO" }))?.is_adoptable).toBe(false);
    });

    it("??? is null — the dropdown's own unknown option, not a negative", () => {
      expect(parseSheetRow(mkRow({ 24: UUID, 10: "???" }))?.is_adoptable).toBeNull();
    });

    it("a blank cell is null", () => {
      expect(parseSheetRow(mkRow({ 24: UUID, 10: "" }))?.is_adoptable).toBeNull();
    });
  });

  describe("N/A handling for free-text + dates", () => {
    it("treats 'N/A' as null for name/caretaker/notes/place/dates", () => {
      const r = parseSheetRow(
        mkRow({ 24: UUID, 2: "N/A", 12: "N/A", 14: "N/A", 15: "N/A", 16: "N/A", 17: "N/A" }),
      );
      expect(r).toMatchObject({
        name: null,
        caretaker: null,
        spot_last_seen: null,
        notes: null,
        neuter_date: null,
        vaccination_date: null,
      });
    });

    it("passes real values through", () => {
      const r = parseSheetRow(
        mkRow({ 24: UUID, 2: "Bella", 12: "Juan", 14: "Gate 3", 15: "1/2/2024", 17: "shy" }),
      );
      expect(r).toMatchObject({
        name: "Bella",
        caretaker: "Juan",
        spot_last_seen: "Gate 3",
        neuter_date: "1/2/2024",
        notes: "shy",
      });
    });
  });

  describe("date_last_seen (col N[13])", () => {
    it("reads a real date string from col N", () => {
      expect(parseSheetRow(mkRow({ 24: UUID, 13: "1/2/2024" }))?.date_last_seen).toBe("1/2/2024");
    });

    it("treats blank and 'N/A' as null", () => {
      expect(parseSheetRow(mkRow({ 24: UUID, 13: "" }))?.date_last_seen).toBeNull();
      expect(parseSheetRow(mkRow({ 24: UUID, 13: "N/A" }))?.date_last_seen).toBeNull();
    });
  });

  describe("intervention signals (col T[19] TNVR, col U[20] Vet)", () => {
    it("maps the exact 'Will have ...' strings to will_have", () => {
      const r = parseSheetRow(
        mkRow({ 24: UUID, 19: "Will have TNVR intervention", 20: "Will have Vet intervention" }),
      );
      expect(r).toMatchObject({ tnvr_signal: "will_have", vet_signal: "will_have" });
    });

    it("maps 'Will not have intervention' to will_not_have", () => {
      const r = parseSheetRow(mkRow({ 24: UUID, 19: "Will not have intervention" }));
      expect(r?.tnvr_signal).toBe("will_not_have");
    });

    it("maps anything else (incl. 'Had ...' / blank / typo) to ignore", () => {
      const r = parseSheetRow(
        mkRow({ 24: UUID, 19: "Had TNVR intervention", 20: "will have vet" }),
      );
      expect(r).toMatchObject({ tnvr_signal: "ignore", vet_signal: "ignore" });
    });
  });
});

describe("parseUnknownSheetRow (UNKNOWN region layout)", () => {
  it("returns null when col Y (UUID) is missing", () => {
    expect(parseUnknownSheetRow(mkRow({ 1: "near gate" }))).toBeNull();
  });

  it("reads loc from B[1], paws from C[2], dates from L[11]/M[12]", () => {
    const r = parseUnknownSheetRow(
      mkRow({ 24: UUID, 1: "near gate", 2: "PAWS-9", 11: "1/2/2024", 12: "3/4/2024" }),
    );
    expect(r).toMatchObject({
      spot_last_seen: "near gate",
      paws_id: "PAWS-9",
      neuter_date: "1/2/2024",
      vaccination_date: "3/4/2024",
    });
  });

  it("always nulls name/caretaker/notes/status and ignores intervention signals", () => {
    const r = parseUnknownSheetRow(mkRow({ 24: UUID, 1: "spot" }));
    expect(r).toMatchObject({
      name: null,
      caretaker: null,
      notes: null,
      cat_status: null,
      tnvr_signal: "ignore",
      vet_signal: "ignore",
    });
  });

  it("uses 'N/A' as the blank sentinel for loc but empty-string for paws_id", () => {
    // Documents the intentional divergence: spot_last_seen filters "N/A",
    // paws_id filters only "" (an "N/A" paws value is kept as-is).
    expect(parseUnknownSheetRow(mkRow({ 24: UUID, 1: "N/A" }))?.spot_last_seen).toBeNull();
    expect(parseUnknownSheetRow(mkRow({ 24: UUID, 2: "" }))?.paws_id).toBeNull();
    expect(parseUnknownSheetRow(mkRow({ 24: UUID, 2: "N/A" }))?.paws_id).toBe("N/A");
  });

  it("shares the same condition matrix as standard rows, including the blank case", () => {
    expect(parseUnknownSheetRow(mkRow({ 24: UUID, 8: "YES", 9: "YES" }))?.condition).toBe("Sick and Injured");
    expect(parseUnknownSheetRow(mkRow({ 24: UUID, 8: "???", 9: "NO" }))?.condition).toBeNull();
    expect(parseUnknownSheetRow(mkRow({ 24: UUID }))?.condition).toBeNull();
  });

  describe("adoptable (col K[10]) — same YES/NO/??? convention as standard rows", () => {
    it("YES → true, NO → false", () => {
      expect(parseUnknownSheetRow(mkRow({ 24: UUID, 10: "YES" }))?.is_adoptable).toBe(true);
      expect(parseUnknownSheetRow(mkRow({ 24: UUID, 10: "NO" }))?.is_adoptable).toBe(false);
    });

    it("??? and blank are both null — neither is a negative", () => {
      expect(parseUnknownSheetRow(mkRow({ 24: UUID, 10: "???" }))?.is_adoptable).toBeNull();
      expect(parseUnknownSheetRow(mkRow({ 24: UUID, 10: "" }))?.is_adoptable).toBeNull();
    });
  });
});

describe("sheetRowSchema (validation gate after parse)", () => {
  it("accepts a fully-parsed valid standard row", () => {
    const parsed = parseSheetRow(
      mkRow({ 24: UUID, 2: "Bella", 3: "Calico", 4: "Adult", 5: "Female", 6: "YES", 7: "Tame", 10: "YES" }),
    );
    expect(sheetRowSchema.safeParse(parsed).success).toBe(true);
  });

  it("rejects a row with a non-UUID id", () => {
    const parsed = parseSheetRow(mkRow({ 24: "not-a-uuid", 2: "Bella" }));
    expect(sheetRowSchema.safeParse(parsed).success).toBe(false);
  });

  it("accepts a parsed UNKNOWN row", () => {
    const parsed = parseUnknownSheetRow(mkRow({ 24: UUID, 1: "spot", 2: "PAWS-1" }));
    expect(sheetRowSchema.safeParse(parsed).success).toBe(true);
  });

  it("accepts a null is_adoptable (col K blank or ???) — the schema must allow it", () => {
    const parsed = parseSheetRow(mkRow({ 24: UUID, 2: "Bella", 10: "???" }));
    expect(parsed?.is_adoptable).toBeNull();
    expect(sheetRowSchema.safeParse(parsed).success).toBe(true);
  });
});
