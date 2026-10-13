import { useState } from "react";
import { Check, Copy } from "lucide-react";
// The "light" build only includes the languages registered below. The full build
// bundles ~300 languages and makes the app about 600 kB larger.
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import c from "react-syntax-highlighter/dist/esm/languages/prism/c";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import csharp from "react-syntax-highlighter/dist/esm/languages/prism/csharp";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import docker from "react-syntax-highlighter/dist/esm/languages/prism/docker";
import go from "react-syntax-highlighter/dist/esm/languages/prism/go";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import php from "react-syntax-highlighter/dist/esm/languages/prism/php";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import ruby from "react-syntax-highlighter/dist/esm/languages/prism/ruby";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { copyToClipboard } from "../../utils/clipboard";
import styles from "./CodeBlock.module.css";

// Language name -> grammar. Aliases are the names models often put after ```.
const LANGUAGES = {
  bash,
  sh: bash,
  shell: bash,
  zsh: bash,
  console: bash,
  c,
  cpp,
  "c++": cpp,
  csharp,
  cs: csharp,
  css,
  docker,
  dockerfile: docker,
  go,
  golang: go,
  java,
  javascript,
  js: javascript,
  mjs: javascript,
  json,
  jsx,
  markdown,
  md: markdown,
  markup,
  html: markup,
  xml: markup,
  svg: markup,
  php,
  python,
  py: python,
  ruby,
  rb: ruby,
  rust,
  rs: rust,
  sql,
  tsx,
  typescript,
  ts: typescript,
  yaml,
  yml: yaml,
};

for (const [name, grammar] of Object.entries(LANGUAGES)) {
  SyntaxHighlighter.registerLanguage(name, grammar);
}

export default function CodeBlock({ language, value }) {
  // Unknown languages are shown as plain text instead of failing.
  const lang = language?.toLowerCase();
  const highlightAs = lang && lang in LANGUAGES ? lang : "text";

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (await copyToClipboard(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={styles.block}>
      <div className={styles.toolbar}>
        <span>{language || "code"}</span>
        <button type="button" onClick={handleCopy} className={styles.copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <SyntaxHighlighter
        language={highlightAs}
        style={vscDarkPlus}
        PreTag="div"
        customStyle={{ margin: 0, padding: "16px", background: "transparent", fontSize: "13.5px" }}
        codeTagProps={{ style: { fontFamily: "var(--font-mono)" } }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}
