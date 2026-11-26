// Closed grammar for y = f(x): numbers, x, pi, e, + - * / ^, parentheses and a few
// named functions. Mirrors parseExpr in the backend (ailearning/figure_expr.go).
type Fn = (x: number) => number;

const FUNCS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
};

export function parseFigureExpr(source: string): Fn | null {
  const s = source.replace(/\s+/g, "").replace(/−/g, "-");
  let i = 0;
  let depth = 0;
  const peek = () => (i < s.length ? s[i] : "");
  const fail = (): never => {
    throw new Error("expr");
  };
  const isLetter = (c: string) => c >= "a" && c <= "z";

  function sum(): Fn {
    let left = product();
    while (peek() === "+" || peek() === "-") {
      const op = s[i++];
      const l = left;
      const r = product();
      left = op === "+" ? (x) => l(x) + r(x) : (x) => l(x) - r(x);
    }
    return left;
  }
  function product(): Fn {
    let left = unary();
    for (;;) {
      const c = peek();
      const implicit = c === "(" || isLetter(c);
      if (c !== "*" && c !== "/" && !implicit) return left;
      if (c === "*" || c === "/") i++;
      const l = left;
      const r = unary();
      left = c === "/" ? (x) => l(x) / r(x) : (x) => l(x) * r(x);
    }
  }
  function unary(): Fn {
    if (peek() === "-" || peek() === "+") {
      const neg = s[i++] === "-";
      const inner = unary();
      return neg ? (x) => -inner(x) : inner;
    }
    return power();
  }
  function power(): Fn {
    const base = atom();
    if (peek() === "^") {
      i++;
      const exp = unary();
      return (x) => Math.pow(base(x), exp(x));
    }
    return base;
  }
  function atom(): Fn {
    if (++depth > 24) fail();
    try {
      const c = peek();
      if (c === "(") {
        i++;
        const inner = sum();
        if (peek() !== ")") fail();
        i++;
        return inner;
      }
      if ((c >= "0" && c <= "9") || c === ".") {
        const start = i;
        while ((peek() >= "0" && peek() <= "9") || peek() === ".") i++;
        const v = Number(s.slice(start, i));
        if (!Number.isFinite(v)) fail();
        return () => v;
      }
      if (isLetter(c)) {
        const start = i;
        while (isLetter(peek())) i++;
        const name = s.slice(start, i);
        if (name === "x") return (x) => x;
        if (name === "pi") return () => Math.PI;
        if (name === "e") return () => Math.E;
        const fn = FUNCS[name];
        if (!fn || peek() !== "(") fail();
        i++;
        const inner = sum();
        if (peek() !== ")") fail();
        i++;
        return (x) => fn(inner(x));
      }
      return fail();
    } finally {
      depth--;
    }
  }

  try {
    const node = sum();
    return i === s.length ? node : null;
  } catch {
    return null;
  }
}
