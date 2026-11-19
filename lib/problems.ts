import type { Problem, ProblemId } from "./contract";

// The practice bank. Every problem has exactly four cases (c1–c4), because
// TestCase["id"] is that union and the results panel is built around four.
//
// Example `input` stays structured data (the argument list), not prose: the
// interviewer instruction JSON-stringifies it, so the model gets clean values.
// The panel renders it generically instead of assuming a parameter name.

export const containsDuplicate: Problem = {
  id: "contains-duplicate",
  title: "Contains Duplicate",
  prompt: "Return **True** if any integer occurs more than once.",
  examples: [
    { input: [1, 2, 3, 1], output: true, explanation: "1 occurs twice." },
    { input: [1, 2, 3, 4], output: false },
  ],
  constraints: ["The input is a list of integers."],
  functionName: "contains_duplicate",
  starterCode: "def contains_duplicate(nums):\n    pass\n",
  java: {
    methodName: "containsDuplicate",
    params: [{ name: "nums", type: "int[]" }],
    returns: "boolean",
    starterCode: "class Solution {\n    public boolean containsDuplicate(int[] nums) {\n        \n    }\n}\n",
  },
  cases: [
    { id: "c1", args: [[1, 2, 3, 1]], expected: true },
    { id: "c2", args: [[1, 2, 3, 4]], expected: false },
    { id: "c3", args: [[]], expected: false },
    { id: "c4", args: [[1, 1, 1, 3, 3, 4, 3, 2, 4, 2]], expected: true },
  ],
};

export const twoSum: Problem = {
  id: "two-sum",
  title: "Two Sum",
  prompt:
    "Return the **indices** of the two numbers that add up to `target`. " +
    "Exactly one answer exists, and you may not use the same element twice. " +
    "Return them in increasing index order.",
  examples: [
    { input: [[2, 7, 11, 15], 9], output: [0, 1], explanation: "nums, target — 2 + 7 == 9." },
    { input: [[3, 2, 4], 6], output: [1, 2] },
  ],
  constraints: ["The input is a list of integers and an integer target.", "Exactly one valid answer exists."],
  functionName: "two_sum",
  starterCode: "def two_sum(nums, target):\n    pass\n",
  java: {
    methodName: "twoSum",
    params: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }],
    returns: "int[]",
    starterCode: "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        \n    }\n}\n",
  },
  cases: [
    { id: "c1", args: [[2, 7, 11, 15], 9], expected: [0, 1] },
    { id: "c2", args: [[3, 2, 4], 6], expected: [1, 2] },
    { id: "c3", args: [[3, 3], 6], expected: [0, 1] },
    { id: "c4", args: [[-1, -2, -3, -4, -5], -8], expected: [2, 4] },
  ],
};

export const validAnagram: Problem = {
  id: "valid-anagram",
  title: "Valid Anagram",
  prompt: "Return **True** if `t` is an anagram of `s` — the same characters with the same counts.",
  examples: [
    { input: ["anagram", "nagaram"], output: true, explanation: "s, t." },
    { input: ["rat", "car"], output: false, explanation: "Different letters." },
  ],
  constraints: ["Both inputs are lowercase ASCII strings.", "Either string may be empty."],
  functionName: "is_anagram",
  starterCode: "def is_anagram(s, t):\n    pass\n",
  java: {
    methodName: "isAnagram",
    params: [{ name: "s", type: "String" }, { name: "t", type: "String" }],
    returns: "boolean",
    starterCode: "class Solution {\n    public boolean isAnagram(String s, String t) {\n        \n    }\n}\n",
  },
  cases: [
    { id: "c1", args: ["anagram", "nagaram"], expected: true },
    { id: "c2", args: ["rat", "car"], expected: false },
    { id: "c3", args: ["", ""], expected: true },
    { id: "c4", args: ["aacc", "ccac"], expected: false },
  ],
};

export const maxProfit: Problem = {
  id: "max-profit",
  title: "Best Time to Buy and Sell Stock",
  prompt:
    "Given daily prices, return the **maximum profit** from one buy and one later sell. " +
    "If no profit is possible, return `0`.",
  examples: [
    { input: [7, 1, 5, 3, 6, 4], output: 5, explanation: "Buy at 1, sell at 6." },
    { input: [7, 6, 4, 3, 1], output: 0, explanation: "Prices only fall." },
  ],
  constraints: ["The input is a list of integers.", "You must buy before you sell."],
  functionName: "max_profit",
  starterCode: "def max_profit(prices):\n    pass\n",
  java: {
    methodName: "maxProfit",
    params: [{ name: "prices", type: "int[]" }],
    returns: "int",
    starterCode: "class Solution {\n    public int maxProfit(int[] prices) {\n        \n    }\n}\n",
  },
  cases: [
    { id: "c1", args: [[7, 1, 5, 3, 6, 4]], expected: 5 },
    { id: "c2", args: [[7, 6, 4, 3, 1]], expected: 0 },
    { id: "c3", args: [[]], expected: 0 },
    { id: "c4", args: [[2, 4, 1]], expected: 2 },
  ],
};

export const problems: Problem[] = [containsDuplicate, twoSum, validAnagram, maxProfit];

export function getProblem(id: string): Problem | undefined {
  return problems.find((problem) => problem.id === id);
}

/**
 * A problem for a practice round, picked at random.
 *
 * `exclude` lets a retry avoid the problem just attempted; if excluding would
 * leave nothing, it falls back to the whole bank rather than returning
 * undefined — a student pressing "practice again" must always get a problem.
 */
export function randomProblem(exclude?: ProblemId): Problem {
  const pool = exclude ? problems.filter((p) => p.id !== exclude) : problems;
  const from = pool.length > 0 ? pool : problems;
  return from[Math.floor(Math.random() * from.length)];
}
