# Project Instructions

## Git & 部署

- 每次 git push 后，必须立即执行 `npx wrangler pages deploy . --project-name=ziwei --commit-dirty=true --commit-hash="$(git rev-parse HEAD)"` 部署到 Cloudflare Pages
- 部署完成后主动告知用户"网页端已更新"并附上最新 commit hash
- 线上地址：https://ziwei-e0i.pages.dev/（Cloudflare Pages，Direct Upload 模式，无 Git 自动部署）
- GitHub Pages 已弃用
