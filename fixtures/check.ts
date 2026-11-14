// TypeScript widens strings and arrays imported from JSON. Check the imported
// structure here; the literal check documented in CONTRACT.md checks each value.
import pass from "./run-pass.json";
import fail from "./run-fail.json";
import syntax from "./run-syntax-error.json";
import unavailable from "./run-unavailable.json";
import report from "./report.json";
import type { RunResult, Report } from "../lib/contract";

type JsonShape<T> = T extends string ? string
  : T extends Array<infer E> ? JsonShape<E>[]
  : T extends object ? { [K in keyof T]: JsonShape<T[K]> }
  : T;

[pass, fail] satisfies JsonShape<Extract<RunResult, { status: "completed" }>>[];
[syntax, unavailable] satisfies JsonShape<Extract<RunResult, { status: "error" }>>[];
report satisfies JsonShape<Report>;
