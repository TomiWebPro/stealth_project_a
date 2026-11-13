import { describe, expect, it } from "vitest";

import { ApiError, errorMessage } from "./errors";

describe("ApiError", () => {
  it("preserves status and code", () => {
    const error = new ApiError("Not found", { status: 404, code: "not_found" });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
    expect(error.message).toBe("Not found");
    expect(error.status).toBe(404);
    expect(error.code).toBe("not_found");
  });
});

describe("errorMessage", () => {
  it("returns the message of an ApiError", () => {
    const error = new ApiError("Unauthorized", { status: 401, code: "unauthorized" });

    expect(errorMessage(error)).toBe("Unauthorized");
  });

  it("returns the message of a plain Error", () => {
    expect(errorMessage(new Error("Boom"))).toBe("Boom");
  });

  it("falls back for unknown values", () => {
    expect(errorMessage("nope")).toBe("Something went wrong.");
    expect(errorMessage(undefined)).toBe("Something went wrong.");
  });
});
