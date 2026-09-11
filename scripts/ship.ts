/**
 * ship：类型检查 → 暂存指定文件 → 提交 → 推送。
 *
 * 设计意图：让「提交并推送」变成一条可重复、有门禁的命令，而不是手工敲三条 git。
 * - 类型检查不过一律不提交（防止把编译不过的代码推上去）；
 * - 只暂存显式给出的文件，避免把并发编辑中的半成品一起带上（本仓库出现过）；
 * - 不传文件时才退回「全部改动」，并显著警告。
 *
 * 用法：
 *   pnpm ship -m "<提交说明>" [-- <文件...>]
 *   pnpm ship -m "<提交说明>" --skip-checks -- <文件...>
 */
import { spawnSync } from "node:child_process";

const USAGE = '用法: pnpm ship -m "<提交说明>" [--skip-checks] [-- <文件...>]';

/** 绝不入库的路径（.gitignore 之外的兜底；显式传参也拦）。 */
const FORBIDDEN = [
  /(^|\/)\.env/,
  /(^|\/)\.dev\.vars$/,
  /^dev-data\//,
  /^\.wrangler\//,
  /^\.commandcode\//,
  /\.(pem|key|p12)$/,
  /(^|\/)id_(rsa|ed25519)$/,
];

function git(args: string[]): { ok: boolean; out: string } {
  const r = spawnSync("git", args, { encoding: "utf8" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

function die(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

function parseArgs(argv: string[]): { message: string; paths: string[]; skipChecks: boolean } {
  let message = "";
  let skipChecks = false;
  const paths: string[] = [];
  let afterSeparator = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (afterSeparator) {
      paths.push(arg);
      continue;
    }
    if (arg === "--") {
      afterSeparator = true;
    } else if (arg === "-m" || arg === "--message") {
      message = argv[++i] ?? "";
    } else if (arg.startsWith("--message=")) {
      message = arg.slice("--message=".length);
    } else if (arg === "--skip-checks") {
      skipChecks = true;
    } else if (arg === "-h" || arg === "--help") {
      console.log(USAGE);
      process.exit(0);
    } else if (arg.startsWith("-")) {
      die(`未知参数 ${arg}\n${USAGE}`);
    } else {
      paths.push(arg);
    }
  }
  return { message: message.trim(), paths, skipChecks };
}

const { message, paths, skipChecks } = parseArgs(process.argv.slice(2));

if (!message) die(`缺少提交说明\n${USAGE}`);
if (!git(["rev-parse", "--is-inside-work-tree"]).ok) die("当前目录不是 git 工作区");

const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).out;
if (!branch || branch === "HEAD") die("处于 detached HEAD，拒绝提交（请先切到分支）");

const bad = paths.filter((p) => FORBIDDEN.some((re) => re.test(p)));
if (bad.length > 0) die(`拒绝暂存敏感路径：${bad.join("、")}`);

// 门禁：整个仓库类型检查通过才允许提交。
if (!skipChecks) {
  console.log("  · 运行 pnpm typecheck …");
  const check = spawnSync("pnpm", ["typecheck"], { stdio: "inherit" });
  if (check.status !== 0) {
    die("类型检查未通过，已中止（确实要跳过：加 --skip-checks）");
  }
}

// 暂存：显式文件用 -A 以同时覆盖新增与删除；无参则退回全部改动。
if (paths.length === 0) {
  console.log("  ! 未指定文件，暂存工作区全部改动（含并发编辑，请确认无误）");
  git(["add", "-A"]);
} else {
  const status = git(["status", "--porcelain", "--", ...paths]);
  if (!status.out) die(`指定文件没有改动：${paths.join("、")}`);
  git(["add", "-A", "--", ...paths]);
}

const staged = git(["diff", "--cached", "--name-only"]).out.split("\n").filter(Boolean);
if (staged.length === 0) {
  console.log("  · 没有已暂存的改动，结束");
  process.exit(0);
}

const commit = git(["commit", "-m", message]);
if (!commit.ok) {
  console.error(commit.out);
  die("提交失败");
}
const hash = git(["rev-parse", "--short", "HEAD"]).out;

const hasUpstream = git(["rev-parse", "--abbrev-ref", `${branch}@{upstream}`]).ok;
const push = hasUpstream ? git(["push"]) : git(["push", "-u", "origin", branch]);
if (!push.ok) {
  console.error(push.out);
  die(`已提交 ${hash}，但推送失败（改动仍在本地）`);
}

console.log(`\n  ✓ ${hash} → ${branch}｜${staged.length} 个文件`);
for (const f of staged) console.log(`    ${f}`);
console.log("");
