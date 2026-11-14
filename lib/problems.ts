import type { Problem } from "./contract";

// The single demo problem, authored to match docs/CONTRACT.md exactly.
// Each case supplies positional arguments: the outer array holds one argument,
// itself a list of integers.
export const containsDuplicate: Problem = {
  id: "contains-duplicate",
  title: "Contains Duplicate",
  prompt: "Return **True** if any integer occurs more than once.",
  examples: [{ input: [1, 2, 3, 1], output: true, explanation: "1 occurs twice." }],
  constraints: ["The input is a list of integers."],
  functionName: "contains_duplicate",
  starterCode: "def contains_duplicate(nums):\n    pass",
  cases: [
    { id: "c1", args: [[1, 2, 3, 1]], expected: true },
    { id: "c2", args: [[1, 2, 3, 4]], expected: false },
    { id: "c3", args: [[]], expected: false },
    { id: "c4", args: [[1, 1, 1, 3, 3, 4, 3, 2, 4, 2]], expected: true },
  ],
};

export const problems: Problem[] = [containsDuplicate];

export function getProblem(id: string): Problem | undefined {
  return problems.find((problem) => problem.id === id);
}
