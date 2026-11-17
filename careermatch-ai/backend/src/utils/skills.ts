const ALIASES: Record<string, string> = {
  js: "javascript", "node": "node.js", nodejs: "node.js", "node js": "node.js", reactjs: "react", "react.js": "react",
  ts: "typescript", postgres: "postgresql", psql: "postgresql", mongo: "mongodb", py: "python", "c++": "c++",
  "express": "express.js", expressjs: "express.js", "vue.js": "vue", vuejs: "vue", "next": "next.js", nextjs: "next.js",
  "tailwind": "tailwind css", tailwindcss: "tailwind css", ml: "machine learning", "k8s": "kubernetes", "amazon web services": "aws",
  "html5": "html", "css3": "css", golang: "go", "rest": "rest apis", "rest api": "rest apis", "restful apis": "rest apis",
  "dsa": "data structures", "data structures and algorithms": "data structures", "ci/cd": "ci/cd", sklearn: "scikit-learn",
};

export const normSkill = (s: string) => {
  const k = s.trim().toLowerCase().replace(/\s+/g, " ");
  return ALIASES[k] ?? k;
};

export const normSkills = (arr: string[]) => Array.from(new Set(arr.map(normSkill).filter(Boolean)));

/** Trim, drop blanks, de-duplicate case-insensitively (first spelling wins). */
export const cleanList = (arr: string[], max = 60) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const s = raw.trim();
    const k = s.toLowerCase();
    if (!s || seen.has(k)) continue;
    seen.add(k); out.push(s);
  }
  return out.slice(0, max);
};
