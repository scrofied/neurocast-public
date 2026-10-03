// 真品牌标识查找：组件拿一个中文/英文的「叫法」，能解析出这个产品的真 logo 文件时就用真的，
// 解析不到才回退到通用线条图标（src/lib/icons.tsx）。
// 数据来自 src/lib/brands.generated.ts —— 由 `node scripts/brands.mjs sync` 从 brands/library.json
// + public/brands/ 里真实存在的文件生成，所以这里的查找结果保证文件在盘上。
import { BRANDS, type Brand } from "./brands.generated";

const norm = (s: string) => s.toLowerCase().replace(/[\s._\-·/]+/g, "");

// alias -> brand，长别名优先（避免 "gpt" 抢走 "chatgpt"）
const ALIAS: [string, Brand][] = BRANDS
  .flatMap((b) => b.aliases.map((a) => [norm(a), b] as [string, Brand]))
  .sort((x, y) => y[0].length - x[0].length);

/** 文案里的叫法（"Claude"/"剪映"/"用 gpt 写文案"）→ 牌子；没有真 logo 文件时返回 undefined */
export const findBrand = (text?: string): Brand | undefined => {
  if (!text) return undefined;
  const t = norm(text);
  if (!t) return undefined;
  const exact = ALIAS.find(([a]) => a === t);
  if (exact) return exact[1];
  // 包含匹配要设门槛：短 ASCII（"hf"、"pr"）会把无关词吃掉，太通用的中文词（"仓库"）会把隐喻判成产品。
  // 所以只允许「含中文的别名」或「3 个字符以上的 ASCII 别名」做包含匹配。
  for (const [a, b] of ALIAS) {
    const cjk = /[\u4e00-\u9fa5]/.test(a);
    if ((cjk || a.length >= 3) && t.includes(a)) return b;
  }
  return undefined;
};

/** Icon 的 name 可以是 "brand:claude"（显式指定）或直接是叫法（"Claude"、"剪映"） */
export const brandForName = (name?: string): Brand | undefined => {
  if (!name) return undefined;
  if (name.startsWith("brand:")) return BRANDS.find((b) => b.key === name.slice(6));
  const t = norm(name);
  return ALIAS.find(([a]) => a === t)?.[1] ?? findBrand(name);
};

export const brandLabel = (b?: Brand) => b?.label;
export const KNOWN_BRANDS = BRANDS;
