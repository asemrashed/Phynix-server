import { describe, expect, test } from "bun:test"
import { getCoursePublishIssues } from "../src/lib/course-publish-validation"

const baseLesson = {
  title: "Introduction",
  type: "VIDEO",
  videoProvider: "YOUTUBE",
  videoRef: "dQw4w9WgXcQ",
  vimeoId: null,
  content: null,
  duration: 600,
  isFree: false,
}

describe("getCoursePublishIssues", () => {
  test("passes a complete course", () => {
    const issues = getCoursePublishIssues({
      thumbnailUrl: "https://example.com/thumb.jpg",
      description: "A long enough course description.",
      price: 99,
      sections: [{ title: "Section 1", lessons: [baseLesson] }],
    })
    expect(issues).toEqual([])
  })

  test("blocks missing thumbnail and lessons", () => {
    const issues = getCoursePublishIssues({
      thumbnailUrl: null,
      description: "Too short",
      price: 0,
      sections: [],
    })
    expect(issues).toContain("Course thumbnail is missing")
    expect(issues).toContain("Add at least one section")
    expect(issues).toContain("Add at least one lesson")
  })

  test("blocks video lessons without a source", () => {
    const issues = getCoursePublishIssues({
      thumbnailUrl: "/thumb.jpg",
      description: "Valid description here.",
      price: 50,
      sections: [
        {
          title: "Section 1",
          lessons: [{ ...baseLesson, videoRef: null, vimeoId: null }],
        },
      ],
    })
    expect(issues.some((issue) => issue.includes("missing a video source"))).toBe(true)
  })
})
