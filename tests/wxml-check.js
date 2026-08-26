// wxml 标签配对校验 v3（正确处理属性值中的 < > 与自闭合标签）
const fs = require("fs");
const path = require("path");
const files = [
  "miniprogram/pages/today/today.wxml",
  "miniprogram/pages/meals/meals.wxml",
  "miniprogram/pages/prep/prep.wxml",
  "miniprogram/pages/fitness/fitness.wxml",
  "miniprogram/pages/fridge/fridge.wxml",
  "miniprogram/pages/profile/profile.wxml",
  "miniprogram/pages/onboarding/onboarding.wxml",
  "miniprogram/pages/suggest/suggest.wxml",
  "miniprogram/pages/suggestions/suggestions.wxml",
  "miniprogram/components/privacy-popup/privacy-popup.wxml",
  "miniprogram/components/tree-picker/tree-picker.wxml"
];
function validate(file) {
  const src = fs.readFileSync(file, "utf8");
  const stack = [];
  let i = 0, n = src.length, line = 1;
  while (i < n) {
    const ch = src[i];
    if (ch === "\n") { line++; i++; continue; }
    if (ch === "<") {
      let j = i + 1;
      if (j < n && /[a-zA-Z]/.test(src[j]) === false && src[j] !== "/") { i++; continue; }
      if (src[j] === "/") {
        let k = j + 1, name = "";
        while (k < n && /[a-zA-Z0-9-]/.test(src[k])) { name += src[k]; k++; }
        const top = stack.pop();
        if (!top || top.name !== name) return "L" + line + ": mismatched </" + name + "> vs " + (top ? ("<" + top.name + "@L" + top.line + ">") : "(none)") + " | " + src.slice(Math.max(0, i - 30), i + 30).replace(/\n/g, " ");
        while (k < n && src[k] !== ">") k++;
        i = k + 1; continue;
      }
      let k = j, name = "";
      while (k < n && /[a-zA-Z0-9-]/.test(src[k])) { name += src[k]; k++; }
      let inQuote = null, selfClose = false, bracketDepth = 0;
      while (k < n) {
        const c = src[k];
        if (inQuote) {
          if (c === inQuote) inQuote = null;
        } else if (c === "\"" || c === "'") inQuote = c;
        else if (c === "{" && src[k + 1] === "{") { bracketDepth++; k++; }
        else if (c === "}" && src[k + 1] === "}") { bracketDepth = Math.max(0, bracketDepth - 1); k++; }
        else if (c === ">" && bracketDepth === 0) break;
        else if (c === "/" && src[k + 1] === ">" && bracketDepth === 0) { selfClose = true; k++; break; }
        k++;
      }
      if (k >= n) return "L" + line + ": unterminated <" + name + ">";
      if (!selfClose) stack.push({ name: name, line: line });
      i = k + 1; continue;
    }
    i++;
  }
  return stack.length ? "UNCLOSED: " + stack.map(function (s) { return "<" + s.name + "@" + s.line + ">"; }).join(" ") : "OK";
}
let allOk = true;
const root = path.join(__dirname, "..");
for (const f of files) {
  const res = validate(path.join(root, f));
  console.log(f + " => " + res);
  if (res !== "OK") allOk = false;
}
console.log(allOk ? "ALL BALANCED" : "HAS ERRORS");
