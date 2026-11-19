// Compiles java/IlzMem.java into public/cheerpj/ for the in-browser Java runner
// (lib/javaRunner.ts loads it with CheerpJ library mode from /app/cheerpj/).
// Needs a local JDK 21+ (`javac` on PATH). The compiled classes are committed,
// because the deployment build has no JDK.
//
// Run: node scripts/build-java-runner.mjs

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "cheerpj");
// A JAR, not loose .class files: CheerpJ checks that a classpath directory
// exists by fetching it, and the Next server answers a directory with 404.
const JAR = join(OUT, "ilz-runner.jar");

const classes = mkdtempSync(join(tmpdir(), "ilz-runner-"));
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith(".class") || f.endsWith(".jar")) rmSync(join(OUT, f));
// --release 21 matches cheerpjInit({ version: 21 }) in lib/javaRunner.ts.
execFileSync("javac", ["--release", "21", "-Xlint:-options", "-d", classes, join(ROOT, "java", "IlzMem.java")], { stdio: "inherit" });
// `jar` is often missing from PATH even when java is on it (e.g. the Windows
// javapath shim); the same tool runs as a module of the JDK.
const jarArgs = ["--create", "--file", JAR, "-C", classes, "."];
try {
  execFileSync("jar", jarArgs, { stdio: "inherit" });
} catch {
  execFileSync("java", ["--module", "jdk.jartool/sun.tools.jar.Main", ...jarArgs], { stdio: "inherit" });
}
rmSync(classes, { recursive: true, force: true });
console.log(`built: ${JAR} (${statSync(JAR).size} bytes)`);
