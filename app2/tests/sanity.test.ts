import { describe, expect, it } from "vitest";
import { GET } from "../src/pages/api/health";

describe("GET /api/health", () => {
  it("responde 200 con body { status: ok }", () => {
    const res = GET();

    expect(res.status).toBe(200);
  });
});
