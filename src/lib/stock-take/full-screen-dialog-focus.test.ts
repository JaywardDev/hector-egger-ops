import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/components/ui/full-screen-dialog.tsx", "utf8");

test("FullScreenDialog keeps latest inline onClose callback without tying it to focus effects", () => {
  assert.match(source, /const onCloseRef = useRef\(onClose\);/);
  assert.match(source, /useEffect\(\(\) => \{\s*onCloseRef\.current = onClose;\s*\}, \[onClose\]\);/);
  assert.match(source, /if \(event\.key === "Escape"\) onCloseRef\.current\(\);/);
});

test("FullScreenDialog Escape and body overflow effect depends only on open", () => {
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*if \(!open\) return;[\s\S]*document\.body\.style\.overflow = "hidden";[\s\S]*document\.removeEventListener\("keydown", onKey\);\s*\};\s*\}, \[open\]\);/,
  );
  assert.doesNotMatch(source, /document\.addEventListener\("keydown", onKey\);[\s\S]*\}, \[open, onClose\]\);/);
});

test("FullScreenDialog focuses the panel only on a closed-to-open transition", () => {
  assert.match(source, /const wasOpenRef = useRef\(false\);/);
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*const wasOpen = wasOpenRef\.current;\s*wasOpenRef\.current = open;\s*if \(!open \|\| wasOpen\) return;[\s\S]*panel\.focus\(\);\s*\}, \[open\]\);/,
  );
  assert.doesNotMatch(source, /panelRef\.current\?\.focus\(\);/);
});

test("FullScreenDialog does not steal focus from active inputs already inside the panel", () => {
  assert.match(source, /const panel = panelRef\.current;/);
  assert.match(source, /if \(!panel \|\| panel\.contains\(document\.activeElement\)\) return;/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby=\{titleId\}/);
  assert.match(source, /aria-describedby=\{hasDescription \? descriptionId : undefined\}/);
});
