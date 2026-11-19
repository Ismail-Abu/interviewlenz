// Generates IlzHarness.java for a problem's Java signature (lib/problems.ts
// `java`). Pure and dependency-free: used by lib/javaRunner.ts in the browser
// and by dev/java-runner-check.mjs.
//
// The harness calls `new Solution().<method>(...)` once per case, captures
// System.out per case, records an exception as that case's error, and returns
// {"kind":"completed","cases":[CaseResult...]} as a JSON string. Display strings
// are Java-style: true/false, [1, 2, 3], "text". A timeout (IlzTimeout, thrown by
// the guard that java/IlzMem.java inserts) is re-thrown so the whole run ends as
// a timeout, matching the Python runner.
import type { JavaSignature, JavaType, Problem } from "./contract";

function literal(value: unknown, type: JavaType): string {
  switch (type) {
    case "int":
      return String(Math.trunc(Number(value)));
    case "boolean":
      return value ? "true" : "false";
    case "String":
      return JSON.stringify(String(value));
    case "int[]":
      return `new int[]{${(value as number[]).map((n) => String(Math.trunc(n))).join(", ")}}`;
  }
}

// How a value is shown in the results panel, and compared: the harness renders
// the actual return value the same way.
export function javaDisplay(value: unknown, type: JavaType): string {
  switch (type) {
    case "int":
      return String(Math.trunc(Number(value)));
    case "boolean":
      return value ? "true" : "false";
    case "String":
      return JSON.stringify(String(value));
    case "int[]":
      return `[${(value as number[]).join(", ")}]`;
  }
}

// Java expression rendering the result variable `r` the same way as javaDisplay.
function renderActual(type: JavaType): string {
  switch (type) {
    case "int":
    case "boolean":
      return "String.valueOf(r)";
    case "String":
      return "(r == null ? \"null\" : String.valueOf((char) 34) + r + String.valueOf((char) 34))";
    case "int[]":
      return "java.util.Arrays.toString(r)";
  }
}

// Java string literal (JSON string syntax is valid Java for these values).
const lit = (s: string) => JSON.stringify(s);

export function buildJavaHarness(problem: Problem, sig: JavaSignature): string {
  const calls = problem.cases.map((c) => {
    const args = sig.params.map((p, i) => literal(c.args[i], p.type)).join(", ");
    const input = sig.params.map((p, i) => `${p.name} = ${javaDisplay(c.args[i], p.type)}`).join(", ");
    return (
      `    one(sb, ${lit(c.id)}, ${lit(input)}, ${lit(javaDisplay(c.expected, sig.returns))}, () -> {\n` +
      `      ${sig.returns} r = new Solution().${sig.methodName}(${args});\n` +
      `      return ${renderActual(sig.returns)};\n` +
      `    });`
    );
  });
  return `import java.io.*;
import java.util.concurrent.Callable;

public class IlzHarness {
  public static String run() {
    StringBuilder sb = new StringBuilder();
    sb.append('{').append(q("kind")).append(':').append(q("completed")).append(',').append(q("cases")).append(":[");
${calls.join("\n")}
    if (sb.charAt(sb.length() - 1) == ',') sb.setLength(sb.length() - 1);
    return sb.append("]}").toString();
  }

  static void one(StringBuilder sb, String id, String input, String expected, Callable<String> call) {
    PrintStream saved = System.out;
    ByteArrayOutputStream buf = new ByteArrayOutputStream();
    String actual = null, error = null;
    try {
      System.setOut(new PrintStream(buf, true, "UTF-8"));
      actual = call.call();
    } catch (Throwable t) {
      if (t.getClass().getName().equals("IlzTimeout")) throw (Error) t;
      error = t.getClass().getSimpleName() + (t.getMessage() == null ? "" : ": " + t.getMessage());
    } finally {
      System.setOut(saved);
    }
    String out = new String(buf.toByteArray(), java.nio.charset.StandardCharsets.UTF_8);
    sb.append('{').append(q("caseId")).append(':').append(q(id))
      .append(',').append(q("input")).append(':').append(q(input))
      .append(',').append(q("expected")).append(':').append(q(expected))
      .append(',').append(q("actual")).append(':').append(actual == null ? "null" : q(actual))
      .append(',').append(q("pass")).append(':').append(error == null && expected.equals(actual));
    if (error != null) sb.append(',').append(q("error")).append(':').append(q(error));
    if (!out.isEmpty()) sb.append(',').append(q("stdout")).append(':').append(q(out));
    sb.append("},");
  }

  // JSON string literal. Written with char codes: 34 = quote, 92 = backslash.
  static String q(String s) {
    StringBuilder b = new StringBuilder();
    b.append((char) 34);
    for (char c : s.toCharArray()) {
      if (c == 34 || c == 92) b.append((char) 92).append(c);
      else if (c == 10) b.append((char) 92).append('n');
      else if (c == 9) b.append((char) 92).append('t');
      else if (c >= 32) b.append(c);
    }
    return b.append((char) 34).toString();
  }
}
`;
}
