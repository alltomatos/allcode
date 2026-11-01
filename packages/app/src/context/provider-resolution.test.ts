import { describe, expect, test } from "bun:test"
import { resolveActiveProviderModel } from "./provider-resolution"

describe("resolveActiveProviderModel hierarchy", () => {
  const corporateModel = { providerID: "9router", modelID: "auto" }
  const localModel = { providerID: "anthropic", modelID: "claude-sonnet-4" }
  const customSessionModel = { providerID: "custom-proxy", modelID: "deepseek-r1" }

  test("1. Session selection prevails when user has permission", () => {
    const result = resolveActiveProviderModel({
      sessionModel: customSessionModel,
      corporateModel,
      localModel,
      canOverrideCorporate: true,
      isAllowed: () => true,
      isValid: () => true,
    })

    expect(result).toBeDefined()
    expect(result?.source).toBe("session")
    expect(result?.model).toEqual(customSessionModel)
  })

  test("1b. Session selection is blocked when user has permissions locked and tries to override corporate", () => {
    const result = resolveActiveProviderModel({
      sessionModel: customSessionModel,
      corporateModel,
      localModel,
      canOverrideCorporate: false, // Locked down
      isAllowed: () => true,
      isValid: () => true,
    })

    // Blocked from overriding corporate with custom provider -> falls back to corporate provider
    expect(result).toBeDefined()
    expect(result?.source).toBe("corporate")
    expect(result?.model).toEqual(corporateModel)
  })

  test("1c. Session selection within the corporate provider is allowed even when canOverrideCorporate is false", () => {
    const corporateAlternativeModel = { providerID: "9router", modelID: "claude-opus-4-5-thinking" }
    const result = resolveActiveProviderModel({
      sessionModel: corporateAlternativeModel,
      corporateModel,
      localModel,
      canOverrideCorporate: false,
      isAllowed: () => true,
      isValid: () => true,
    })

    expect(result).toBeDefined()
    expect(result?.source).toBe("session")
    expect(result?.model).toEqual(corporateAlternativeModel)
  })

  test("2. Centralized corporate provider applies by default when no session override exists", () => {
    const result = resolveActiveProviderModel({
      sessionModel: null,
      corporateModel,
      localModel,
      canOverrideCorporate: true,
      isAllowed: () => true,
      isValid: () => true,
    })

    expect(result).toBeDefined()
    expect(result?.source).toBe("corporate")
    expect(result?.model).toEqual(corporateModel)
  })

  test("3. Local fallback applies when portal has no provider configured", () => {
    const result = resolveActiveProviderModel({
      sessionModel: null,
      corporateModel: null, // No portal provider
      localModel,
      canOverrideCorporate: true,
      isAllowed: () => true,
      isValid: () => true,
    })

    expect(result).toBeDefined()
    expect(result?.source).toBe("local")
    expect(result?.model).toEqual(localModel)
  })

  test("3b. Disallowed local provider is rejected by policy filter", () => {
    const result = resolveActiveProviderModel({
      sessionModel: null,
      corporateModel: null,
      localModel,
      canOverrideCorporate: true,
      isAllowed: (id) => id !== "anthropic",
      isValid: () => true,
    })

    expect(result).toBeUndefined()
  })

  test("Invalid corporate model falls back to local fallback", () => {
    const result = resolveActiveProviderModel({
      sessionModel: null,
      corporateModel,
      localModel,
      canOverrideCorporate: true,
      isAllowed: () => true,
      isValid: (m) => m.providerID !== "9router", // 9router not connected/invalid
    })

    expect(result).toBeDefined()
    expect(result?.source).toBe("local")
    expect(result?.model).toEqual(localModel)
  })
})
