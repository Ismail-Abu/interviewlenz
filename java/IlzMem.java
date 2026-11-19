import com.sun.source.tree.*;
import com.sun.source.util.*;
import javax.tools.*;
import java.io.*;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.*;

// Java runner for the browser (CheerpJ library mode; see lib/javaRunner.ts).
// JS calls IlzMem.run(solution, harness, timeLimitMs) and gets a JSON string:
//   {"kind":"completed","cases":[CaseResult...]}   (built by the generated harness)
//   {"kind":"error","code":"syntax_error"|"timeout"|"runner_unavailable","message":...,"line":N?}
//
// Everything happens in memory (no CheerpJ filesystem): the candidate's code is
// parsed, instrumented with a time guard, compiled with javac, and loaded in a
// FRESH class loader so a re-run never sees classes from an earlier run.
//
// Why the guard: CheerpJ runs Java on the page's main thread, so an infinite
// loop would freeze the tab and nothing on the JS side could stop it. The guard
// inserts `IlzGuard.tick();` at the start of every loop body and method body
// (on the same line, so compiler line numbers are unchanged). tick() throws
// IlzTimeout once the deadline passes, which ends the run as a timeout.
//
// Build: node scripts/build-java-runner.mjs (writes public/cheerpj/ilz-runner.jar).
public class IlzMem {
  static final String GUARD =
      "final class IlzGuard {\n"
    + "  static long deadline = Long.MAX_VALUE, nextYield = 0;\n"
    + "  static int n = 0;\n"
    + "  static void start(long ms) { deadline = System.currentTimeMillis() + ms; nextYield = 0; n = 0; }\n"
    + "  static void tick() {\n"
    + "    if ((++n & 255) != 0) return;\n"
    + "    long now = System.currentTimeMillis();\n"
    + "    if (now > deadline) throw new IlzTimeout();\n"
    // Briefly yield every 50 ms so the browser can repaint and handle input
    // while long-running code (or a runaway loop) is still going.
    + "    if (now >= nextYield) { nextYield = now + 50; try { Thread.sleep(1); } catch (InterruptedException e) { Thread.currentThread().interrupt(); } }\n"
    + "  }\n"
    + "}\n"
    + "final class IlzTimeout extends Error { IlzTimeout() { super(\"time limit\", null, false, false); } }\n";

  public static String run(String solution, String harness, int timeLimitMs) {
    try {
      return compileAndRun(solution, harness, timeLimitMs);
    } catch (Throwable t) {
      return error("runner_unavailable", String.valueOf(t), 0);
    }
  }

  static final class Src extends SimpleJavaFileObject {
    final String code;
    Src(String name, String code) { super(URI.create("string:///" + name + ".java"), Kind.SOURCE); this.code = code; }
    @Override public CharSequence getCharContent(boolean ignore) { return code; }
  }

  static final class Out extends SimpleJavaFileObject {
    final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    Out(String name) { super(URI.create("mem:///" + name.replace('.', '/') + ".class"), Kind.CLASS); }
    @Override public OutputStream openOutputStream() { return bytes; }
  }

  static String compileAndRun(String solution, String harness, int timeLimitMs) throws Exception {
    JavaCompiler javac = ToolProvider.getSystemJavaCompiler();
    if (javac == null) return error("runner_unavailable", "No Java compiler in this runtime", 0);

    // 1. Parse the candidate's code alone: syntax errors are reported against
    //    their own source, before any instrumentation.
    DiagnosticCollector<JavaFileObject> parseDiags = new DiagnosticCollector<>();
    Src original = new Src("Solution", solution);
    JavacTask parseTask = (JavacTask) javac.getTask(null, javac.getStandardFileManager(parseDiags, null, StandardCharsets.UTF_8),
        parseDiags, Arrays.asList("-proc:none"), null, Collections.singletonList(original));
    Iterable<? extends CompilationUnitTree> units = parseTask.parse();
    String firstError = firstError(parseDiags, original);
    if (firstError != null) return firstError;

    // 2. Insert the time guard.
    String guarded = instrument(solution, units, Trees.instance(parseTask).getSourcePositions());

    // 3. Compile the guarded code, the harness, and the guard together.
    DiagnosticCollector<JavaFileObject> diags = new DiagnosticCollector<>();
    Map<String, Out> classes = new HashMap<>();
    JavaFileManager fm = new ForwardingJavaFileManager<JavaFileManager>(javac.getStandardFileManager(diags, null, StandardCharsets.UTF_8)) {
      @Override public JavaFileObject getJavaFileForOutput(Location loc, String name, JavaFileObject.Kind kind, FileObject sibling) {
        Out o = new Out(name);
        classes.put(name, o);
        return o;
      }
    };
    Src sol = new Src("Solution", guarded);
    boolean ok = javac.getTask(null, fm, diags, Arrays.asList("-proc:none", "-g:none"), null,
        Arrays.asList(sol, new Src("IlzHarness", harness), new Src("IlzGuard", GUARD))).call();
    if (!ok) {
      String err = firstError(diags, sol);
      return err != null ? err : error("syntax_error", "Compilation failed", 0);
    }

    // 4. Load in a fresh class loader and run the harness under the deadline.
    ClassLoader loader = new ClassLoader(IlzMem.class.getClassLoader()) {
      @Override protected Class<?> findClass(String name) throws ClassNotFoundException {
        Out o = classes.get(name);
        if (o == null) throw new ClassNotFoundException(name);
        byte[] b = o.bytes.toByteArray();
        return defineClass(name, b, 0, b.length);
      }
    };
    Method start = Class.forName("IlzGuard", true, loader).getDeclaredMethod("start", long.class);
    start.setAccessible(true); // IlzGuard is package-private
    start.invoke(null, (long) timeLimitMs);
    Method run = Class.forName("IlzHarness", true, loader).getMethod("run");
    try {
      return (String) run.invoke(null);
    } catch (InvocationTargetException e) {
      Throwable cause = e.getCause();
      if (cause != null && cause.getClass().getName().equals("IlzTimeout")) {
        return error("timeout", "Execution exceeded the " + (timeLimitMs / 1000) + " second limit", 0);
      }
      throw e;
    }
  }

  // Wrap every loop body as `{IlzGuard.tick();<body>}` and start every method
  // body with `IlzGuard.tick();`. Constructors are skipped (a this()/super()
  // call must come first). No newlines are added, so line numbers hold.
  static String instrument(String src, Iterable<? extends CompilationUnitTree> units, SourcePositions pos) {
    final List<long[]> edits = new ArrayList<>(); // {position, kind}: 0 = "{IlzGuard.tick();", 1 = "}", 2 = "IlzGuard.tick();"
    for (CompilationUnitTree unit : units) {
      new TreeScanner<Void, Void>() {
        void wrap(StatementTree body) {
          if (body == null) return;
          long s = pos.getStartPosition(unit, body), e = pos.getEndPosition(unit, body);
          if (s < 0 || e < 0) return;
          edits.add(new long[] { s, 0 });
          edits.add(new long[] { e, 1 });
        }
        @Override public Void visitForLoop(ForLoopTree t, Void v) { wrap(t.getStatement()); return super.visitForLoop(t, v); }
        @Override public Void visitEnhancedForLoop(EnhancedForLoopTree t, Void v) { wrap(t.getStatement()); return super.visitEnhancedForLoop(t, v); }
        @Override public Void visitWhileLoop(WhileLoopTree t, Void v) { wrap(t.getStatement()); return super.visitWhileLoop(t, v); }
        @Override public Void visitDoWhileLoop(DoWhileLoopTree t, Void v) { wrap(t.getStatement()); return super.visitDoWhileLoop(t, v); }
        @Override public Void visitMethod(MethodTree t, Void v) {
          if (t.getBody() != null && !t.getName().contentEquals("<init>")) {
            long s = pos.getStartPosition(unit, t.getBody());
            if (s >= 0) edits.add(new long[] { s + 1, 2 }); // just after the opening brace
          }
          return super.visitMethod(t, v);
        }
      }.scan(unit, null);
    }
    // Apply from the end so earlier positions stay valid. At one position a
    // closing brace goes before an opening one.
    edits.sort((a, b) -> a[0] != b[0] ? Long.compare(b[0], a[0]) : Long.compare(a[1] == 1 ? 1 : 0, b[1] == 1 ? 1 : 0));
    StringBuilder out = new StringBuilder(src);
    for (long[] e : edits) {
      String text = e[1] == 0 ? "{IlzGuard.tick();" : e[1] == 1 ? "}" : "IlzGuard.tick();";
      out.insert((int) e[0], text);
    }
    return out.toString();
  }

  static String firstError(DiagnosticCollector<JavaFileObject> diags, JavaFileObject solution) {
    for (Diagnostic<? extends JavaFileObject> d : diags.getDiagnostics()) {
      if (d.getKind() != Diagnostic.Kind.ERROR) continue;
      boolean inSolution = d.getSource() == solution;
      return error("syntax_error", d.getMessage(Locale.ENGLISH), inSolution ? d.getLineNumber() : 0);
    }
    return null;
  }

  static String error(String code, String message, long line) {
    return "{\"kind\":\"error\",\"code\":\"" + code + "\",\"message\":" + q(message) + (line > 0 ? ",\"line\":" + line : "") + "}";
  }

  public static String q(String s) {
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c == '\n') b.append("\\n");
      else if (c == '\t') b.append("\\t");
      else if (c >= 32) b.append(c);
    }
    return b.append('"').toString();
  }
}
