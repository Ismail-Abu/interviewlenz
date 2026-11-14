# Shared contract

Hamza and Ismail jointly own this document and the [TypeScript definitions](../lib/contract.ts). Runner request and response definitions are pending the remainder of the specification.

## Problem and cases

Ismail supplies the problem in `lib/problems.ts`. The prompt supports Markdown. Each test supplies positional arguments: the outer array contains one argument, itself a list of integers.

```json
{
  "id": "contains-duplicate",
  "title": "Contains Duplicate",
  "prompt": "Return **True** if any integer occurs more than once.",
  "examples": [{"input": [1,2,3,1], "output": true, "explanation": "1 occurs twice."}],
  "constraints": ["The input is a list of integers."],
  "functionName": "contains_duplicate",
  "starterCode": "def contains_duplicate(nums):\n    pass",
  "cases": [
    {"id":"c1","args":[[1,2,3,1]],"expected":true},
    {"id":"c2","args":[[1,2,3,4]],"expected":false},
    {"id":"c3","args":[[]],"expected":false},
    {"id":"c4","args":[[1,1,1,3,3,4,3,2,4,2]],"expected":true}
  ]
}
```

## Common error

Every ApiError has a code, message, and retryable flag. A line number is optional. Allowed codes are syntax_error, timeout, runner_unavailable, provider_unavailable, invalid_request, and unknown_problem.

```json
{"code":"syntax_error","message":"Expected a colon","retryable":false,"line":1}
```

## Browser runner

The problem page calls `preloadRunner(): Promise<void>` when it opens. Ismail owns `lib/runner.ts` and its client-side Pyodide Web Worker. Python execution has a five-second timeout.
