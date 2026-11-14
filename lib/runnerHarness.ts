// The Python side of the browser runner. It is kept in its own module so the
// exact same source can be loaded by the Web Worker (lib/runner.worker.ts) and
// exercised directly by the dev check (dev/runner-check.mjs). Single source of
// truth: there is no second copy of this logic to drift out of sync.
//
// `_run_harness` receives a JSON string of { source, functionName, cases } and
// returns a JSON string shaped like the completed/error output in
// docs/CONTRACT.md and fixtures/run-*.json:
//   - syntax error  -> { "kind": "error", "error": { code: "syntax_error", ... } }
//   - otherwise      -> { "kind": "completed", "cases": [ CaseResult, ... ] }
// Display strings are Python repr (True/False, lists like "[1, 2, 3]"). stdout
// is captured per case and only included when non-empty. A raised exception in
// one case fails only that case and records its error text.
export const RUNNER_HARNESS = `
import ast
import io
import json
import sys


def _run_harness(payload_json):
    payload = json.loads(payload_json)
    source = payload["source"]
    function_name = payload["functionName"]
    cases = payload["cases"]

    # Parse first so a syntax error is reported with its line number and never
    # reaches execution.
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        return json.dumps({
            "kind": "error",
            "error": {
                "code": "syntax_error",
                "message": exc.msg or "Invalid syntax",
                "retryable": False,
                "line": exc.lineno,
            },
        })

    # Take parameter names from the AST so each case input renders ("nums = ...")
    # even if top-level execution later fails.
    param_names = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == function_name:
            param_names = [arg.arg for arg in node.args.args]
            break

    student_globals = {}
    setup_error = None
    try:
        exec(compile(tree, "<student>", "exec"), student_globals)
    except Exception as exc:
        setup_error = "{}: {}".format(type(exc).__name__, exc)

    target = student_globals.get(function_name)
    if target is None and setup_error is None:
        setup_error = "NameError: function '{}' is not defined".format(function_name)

    results = []
    for case in cases:
        args = case["args"]
        expected = case["expected"]

        rendered = []
        for index, value in enumerate(args):
            name = param_names[index] if index < len(param_names) else "arg{}".format(index + 1)
            rendered.append("{} = {!r}".format(name, value))

        entry = {
            "caseId": case["id"],
            "input": ", ".join(rendered),
            "expected": repr(expected),
        }

        if setup_error is not None:
            entry["actual"] = None
            entry["pass"] = False
            entry["error"] = setup_error
            results.append(entry)
            continue

        buffer = io.StringIO()
        saved_stdout = sys.stdout
        sys.stdout = buffer
        try:
            actual_value = target(*args)
            entry["actual"] = repr(actual_value)
            entry["pass"] = bool(actual_value == expected)
        except Exception as exc:
            entry["actual"] = None
            entry["pass"] = False
            entry["error"] = "{}: {}".format(type(exc).__name__, exc)
        finally:
            sys.stdout = saved_stdout

        captured = buffer.getvalue()
        if captured:
            entry["stdout"] = captured

        results.append(entry)

    return json.dumps({"kind": "completed", "cases": results})
`;
