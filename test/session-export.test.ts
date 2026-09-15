import { describe, expect, it } from "vitest"

import {
  buildComparisonFilename,
  buildContactSheetFilename,
  buildIndividualViewFilename,
  countContactSheetExports,
  createContactSheetExportedEvent,
  createDefaultSessionName,
  sanitizeFilenameSegment,
} from "../src/domain/session-export"

describe("local session export metadata", () => {
  it("creates a local-time default session name and safe patient-aware filenames", () => {
    // Given: a fixed local time and an opt-in patient label.
    const sessionName = createDefaultSessionName(new Date(2026, 7, 31, 9, 5))

    // When: the session metadata is converted into local download filenames.
    const contactSheet = buildContactSheetFilename({ patientLabel: "김/테스트", sessionName })
    const individual = buildIndividualViewFilename({
      index: 3,
      patientLabel: "김/테스트",
      sessionName,
      viewLabel: "좌측 45도",
    })

    // Then: only filenames receive the optional label; the data contract has no remote identifier.
    expect(sessionName).toBe("2026-08-31_0905")
    expect(contactSheet).toBe("2026-08-31_0905_김-테스트_contact-sheet.png")
    expect(individual).toBe("2026-08-31_0905_김-테스트_3_좌측 45도.png")
    expect(sanitizeFilenameSegment("  a:::b  ")).toBe("a-b")
  })

  it("counts only local contact-sheet exported events in the current session", () => {
    const first = createContactSheetExportedEvent("2026-08-31_0905")
    const second = createContactSheetExportedEvent("2026-08-31_0905")

    expect(countContactSheetExports([first, second])).toBe(2)
  })

  it("builds the fixed local-time comparison filename without session metadata", () => {
    expect(buildComparisonFilename(new Date(2026, 8, 5, 14, 7))).toBe(
      "sevenview-before-after-2026-09-05_1407.png",
    )
  })
})
