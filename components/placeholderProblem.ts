import type { Problem } from "@/lib/contract";

// Local placeholder copied from docs/CONTRACT.md. Replace with Ismail's
// lib/problems.ts export once it is merged.
export const placeholderProblem: Problem = {
  id: "contains-duplicate",
  title: "Contains Duplicate",
  prompt:
    "Given a list of integers `nums`, return **True** if any integer occurs more than once, and **False** if every element is distinct.",
  examples: [
    { input: [1, 2, 3, 1], output: true, explanation: "1 occurs twice." },
    { input: [1, 2, 3, 4], output: false, explanation: "Every element is distinct." },
  ],
  constraints: ["The input is a list of integers.", "The list may be empty."],
  functionName: "contains_duplicate",
  starterCode: "def contains_duplicate(nums):\n    pass",
  cases: [
    { id: "c1", args: [[1, 2, 3, 1]], expected: true },
    { id: "c2", args: [[1, 2, 3, 4]], expected: false },
    { id: "c3", args: [[]], expected: false },
    { id: "c4", args: [[1, 1, 1, 3, 3, 4, 3, 2, 4, 2]], expected: true },
  ],
};
