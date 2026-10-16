// ─────────────────────────────────────────────────────────────────────────────
// 极小公式表达式引擎（移植自 opus-5-5-motion-gallery/v14 的思路，不是抄代码）
//
// v14 那条片最值钱的机制不是「画了个光学实验」，而是：**画面里每一个数字、每一行字
// 都是同一个纯函数的即时读数**。写死文案的科普动画一改口径就得逐处找，公式驱动的
// 只要换掉那一个函数，θc、REFLECTED、大字幕里的 48.8° 全跟着变，绝不会自相矛盾。
//
// 所以这里把「一个公式」做成组件的入参：分镜里写 "n * sin(theta1) > 1"，
// 引擎按当前自变量取值算出读数，同时画在公式卡上。支持
//   + - * / ^ 括号  比较 > < >= <= = !=  函数 sin cos tan asin acos sqrt abs
//   min max pow round floor ceil exp log10  常量 pi e  变量任意标识符
// ─────────────────────────────────────────────────────────────────────────────

type Node =
  | { k: "num"; v: number }
  | { k: "var"; v: string }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "un"; op: string; a: Node }
  | { k: "call"; name: string; args: Node[] };

const FNS: Record<string, (...a: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  exp: Math.exp,
  log: Math.log,
  log10: Math.log10,
  sign: Math.sign,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, deg: Math.PI / 180, rad: 180 / Math.PI };

const tokenize = (src: string) => {
  const out: { t: string; v?: string; n?: number }[] = [];
  let i = 0;
  const two = ["<=", ">=", "!=", "=="];
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9._eE+-]/.test(src[j])) {
        // 只让 e/E 后面紧跟数字时才算指数，免得吃掉变量名
        if (/[eE]/.test(src[j]) && !/[0-9]/.test(src[j + 1] ?? "")) break;
        if (/[+-]/.test(src[j]) && !/[eE]/.test(src[j - 1] ?? "")) break;
        j++;
      }
      out.push({ t: "num", n: parseFloat(src.slice(i, j).replace(/_/g, "")) });
      i = j;
      continue;
    }
    if (/[A-Za-z_\u4e00-\u9fa5]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_\u4e00-\u9fa5]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    const pair = src.slice(i, i + 2);
    const twoOp = two.find((op) => pair === op);
    if (twoOp) {
      out.push({ t: "op", v: twoOp });
      i += 2;
      continue;
    }
    if ("+-*/^(),%".includes(c)) {
      out.push({ t: c });
      i++;
      continue;
    }
    if ("<>=".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
      continue;
    }
    throw new Error(`公式里有认不出的字符「${c}」`);
  }
  return out;
};

const parse = (src: string): Node => {
  const ts = tokenize(src);
  let p = 0;
  const peek = () => ts[p];
  const eat = (v: string) => {
    const q = peek();
    if (q && (q.t === v || q.v === v)) {
      p++;
      return true;
    }
    return false;
  };
  const expect = (v: string) => {
    if (!eat(v)) throw new Error(`公式「${src}」在第 ${p} 个符号处缺 ${v}`);
  };
  // 比较：最低优先级，结果 1/0
  const cmp = (): Node => {
    let a = add();
    while (peek() && peek().t === "op" && ["<", ">", "<=", ">=", "==", "=", "!="].includes(peek().v!)) {
      const op = peek().v!;
      p++;
      a = { k: "bin", op, a, b: add() };
    }
    return a;
  };
  const add = (): Node => {
    let a = mul();
    while (peek() && (peek().t === "+" || peek().t === "-")) {
      const op = peek().t;
      p++;
      a = { k: "bin", op, a, b: mul() };
    }
    return a;
  };
  const mul = (): Node => {
    let a = unary();
    while (peek() && (peek().t === "*" || peek().t === "/" || peek().t === "%")) {
      const op = peek().t;
      p++;
      a = { k: "bin", op, a, b: unary() };
    }
    return a;
  };
  const unary = (): Node => {
    if (peek() && (peek().t === "-" || peek().t === "+")) {
      const op = peek().t;
      p++;
      return { k: "un", op, a: unary() };
    }
    return powr();
  };
  const powr = (): Node => {
    const a = atom();
    if (peek() && peek().t === "^") {
      p++;
      return { k: "bin", op: "^", a, b: unary() };
    }
    return a;
  };
  const atom = (): Node => {
    const q = peek();
    if (!q) throw new Error(`公式「${src}」结尾少了东西`);
    if (q.t === "num") {
      p++;
      return { k: "num", v: q.n! };
    }
    if (eat("(")) {
      const a = cmp();
      expect(")");
      return a;
    }
    if (q.t === "id") {
      p++;
      const name = q.v!;
      if (eat("(")) {
        const args: Node[] = [];
        if (!peek() || peek().t !== ")") {
          do {
            args.push(cmp());
          } while (eat(","));
        }
        expect(")");
        if (!FNS[name]) throw new Error(`公式里没有函数「${name}」`);
        return { k: "call", name, args };
      }
      if (CONSTS[name] !== undefined) return { k: "num", v: CONSTS[name] };
      return { k: "var", v: name };
    }
    throw new Error(`公式「${src}」在第 ${p} 个符号处读不下去`);
  };
  const root = cmp();
  if (p < ts.length) throw new Error(`公式「${src}」后面有多余的东西：${ts.slice(p).map((x) => x.v ?? x.t).join(" ")}`);
  return root;
};

const evalNode = (n: Node, vars: Record<string, number>): number => {
  switch (n.k) {
    case "num":
      return n.v;
    case "var":
      if (!(n.v in vars)) throw new Error(`公式里的「${n.v}」没有赋值（检查 vars 里有没有这个名）`);
      return vars[n.v];
    case "un":
      return n.op === "-" ? -evalNode(n.a, vars) : evalNode(n.a, vars);
    case "call":
      return FNS[n.name](...n.args.map((a) => evalNode(a, vars)));
    case "bin": {
      const a = evalNode(n.a, vars);
      const b = evalNode(n.b, vars);
      switch (n.op) {
        case "+":
          return a + b;
        case "-":
          return a - b;
        case "*":
          return a * b;
        case "/":
          return a / b;
        case "%":
          return a % b;
        case "^":
          return Math.pow(a, b);
        case ">":
          return a > b ? 1 : 0;
        case "<":
          return a < b ? 1 : 0;
        case ">=":
          return a >= b ? 1 : 0;
        case "<=":
          return a <= b ? 1 : 0;
        case "=":
        case "==":
          return a === b ? 1 : 0;
        case "!=":
          return a !== b ? 1 : 0;
        default:
          throw new Error(`认不出的运算符 ${n.op}`);
      }
    }
  }
};

export type Formula = {
  /** 按当前自变量求值；出错返回 NaN（组件会渲染成「—」而不是崩掉） */
  at: (vars: Record<string, number>) => number;
  /** 公式里用到的变量名（不含常量/函数），用来查分镜有没有漏给 */
  names: string[];
};

const collect = (n: Node, out: Set<string>) => {
  if (n.k === "var") out.add(n.v);
  else if (n.k === "bin") {
    collect(n.a, out);
    collect(n.b, out);
  } else if (n.k === "un") collect(n.a, out);
  else if (n.k === "call") n.args.forEach((a) => collect(a, out));
};

export const compile = (src: string): Formula => {
  const ast = parse(src);
  const set = new Set<string>();
  collect(ast, set);
  return {
    at: (vars) => {
      try {
        const v = evalNode(ast, vars);
        return Number.isFinite(v) ? v : NaN;
      } catch {
        return NaN;
      }
    },
    names: [...set],
  };
};

/** 给 zod refine 用：能不能解析、缺不缺变量 */
export const checkFormula = (src: string, provided: string[]) => {
  try {
    const f = compile(src);
    const missing = f.names.filter((n) => !provided.includes(n));
    return missing.length === 0 ? null : `缺变量 ${missing.join("、")}`;
  } catch (err) {
    return (err as Error).message;
  }
};
