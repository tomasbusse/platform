import { describe, expect, it } from "vitest";

import * as generateBlocks from "../generateBlocks";

describe("generation block type pools", () => {
  it("accepts offer types for explicit generation but excludes them from sampling", () => {
    const moduleExports = generateBlocks as unknown as {
      ALL_BLOCK_TYPES?: readonly string[];
      SAMPLING_BLOCK_TYPES?: readonly string[];
    };

    expect(moduleExports.ALL_BLOCK_TYPES).toEqual(
      expect.arrayContaining(["offerLetter", "offerSection"]),
    );
    expect(moduleExports.SAMPLING_BLOCK_TYPES).not.toContain("offerLetter");
    expect(moduleExports.SAMPLING_BLOCK_TYPES).not.toContain("offerSection");
  });
});
