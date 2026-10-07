# -*- coding: utf-8 -*-
"""把 GitHub 仓库改为公开（用户要求「开源到github」）。
凭据走 git 自己的 credential helper（= 平时 push 用的那份，GitHub Desktop 存的），
脚本**不打印任何令牌**，只打印响应里的关键字段。
"""
import json, os, subprocess, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GIT = os.path.join(ROOT, "tools", "git.cmd")
REPO = "horodeapple-ai/whale-rhythm2"

env = dict(os.environ, GIT_TERMINAL_PROMPT="0")
try:
    proc = subprocess.run([GIT, "credential", "fill"], cwd=ROOT, env=env, timeout=60,
                          input="protocol=https\nhost=github.com\n\n",
                          capture_output=True, text=True, encoding="utf-8", errors="replace")
except subprocess.TimeoutExpired:
    print("取凭据超时（credential helper 可能在等输入）"); sys.exit(2)
creds = {}
for line in (proc.stdout or "").splitlines():
    if "=" in line:
        k, v = line.split("=", 1)
        creds[k.strip()] = v.strip()
tok = creds.get("password")
user = creds.get("username")
print("凭据：username=%s  令牌长度=%d（不打印内容）" % (user, len(tok or "")))
if not tok:
    print("没拿到令牌，无法调用 API"); sys.exit(2)

def call(method, path, body=None):
    req = urllib.request.Request(
        "https://api.github.com" + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + tok, "Accept": "application/vnd.github+json",
                 "User-Agent": "whale-rhythm2-publish", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8", "replace") or "{}")

code, d = call("GET", "/repos/" + REPO)
print("改前：HTTP %s  private=%s  visibility=%s" % (code, d.get("private"), d.get("visibility")))
if code != 200:
    print("读取仓库失败：", d.get("message")); sys.exit(3)

if d.get("private") is False:
    print("已经是公开仓库，无需改动")
else:
    code, d2 = call("PATCH", "/repos/" + REPO, {"private": False})
    print("改后：HTTP %s  private=%s  visibility=%s" % (code, d2.get("private"), d2.get("visibility")))
    if code != 200:
        print("改动失败：", d2.get("message"))
        if "scope" in (d2.get("message") or "").lower():
            print("（令牌权限不足，需要带 repo 权限的经典令牌；可改用网页 Settings → Change visibility）")
        sys.exit(4)
    d = d2
print("仓库页面：", d.get("html_url"))
print("描述：", d.get("description") or "（空）", "| 默认分支：", d.get("default_branch"), "| 大小：%s KB" % d.get("size"))
