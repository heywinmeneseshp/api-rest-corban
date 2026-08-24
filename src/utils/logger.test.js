import { describe, it, expect } from "vitest";
import { logger } from "./logger.js";

describe("logger", () => {
  it("expone info, warn y error", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("no lanza al loguear", () => {
    expect(() => logger.info("test info")).not.toThrow();
    expect(() => logger.warn("test warn")).not.toThrow();
  });
});
