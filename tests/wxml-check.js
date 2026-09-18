// wxml 标签配对校验 v3（正确处理属性值中的 < > 与自闭合标签）
const fs = require("fs");
const path = require("path");
// 自动发现全部 wxml —— 新增页面无需手动登记，避免漏检
// （旧版为硬编码清单，曾漏掉 pages/bills/*.wxml 与 pages/zzj/*.wxml）
function walk(dir, out) {
  fs.readdirSync(dir).forEach(function (name) {
    if (name === "node_modules" || name === "miniprogram_npm") return;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.wxml$/.test(name)) out.push(full);
  });
  return out;
}
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
const files = walk(path.join(root, "miniprogram"), []);
for (const f of files) {
  const res = validate(f);
  console.log(path.relative(root, f).split(path.sep).join("/") + " => " + res);
  if (res !== "OK") allOk = false;
}
console.log(allOk ? ("ALL BALANCED（" + files.length + " 个 wxml）") : "HAS ERRORS");
