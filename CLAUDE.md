# Project Instructions

## Git & 部署

- 每次 git push 后，必须立即执行 `npx wrangler pages deploy . --project-name=ziwei --commit-dirty=true --commit-hash="$(git rev-parse HEAD)"` 部署到 Cloudflare Pages
- 部署完成后主动告知用户"网页端已更新"并附上最新 commit hash
- 线上地址：https://ziwei-e0i.pages.dev/（Cloudflare Pages，Direct Upload 模式，无 Git 自动部署）
- **每次修改代码后必须同步更新线上网页**：git push + wrangler deploy 缺一不可
- 修复或功能变更后，使用浏览器打开 https://ziwei-e0i.pages.dev/ 实际验证
- GitHub Pages 已弃用

## 紫微斗数排盘铁律

### 晚子时规则
- **晚子时（23:00–24:00）属于当天**，农历日不进一，年月日均不变
- 只有晚子时后半段即**早子时（00:00–01:00）才属于下一天**（农历日进一）
- 晚子时与早子时的地支均为子（hourBrIdx=0），区别仅在于日期归属
- 排盘时：晚子时用当日农历日安紫微，不得换日

### 知识来源铁律
- **补充或修改排盘功能时，必须且只能基于用户提供的书籍/资料**
- 不允许使用 Claude 自身命理学知识储备来补充或修正排盘逻辑
- 不允许联网查找紫微斗数相关资料作为排盘依据
- 若用户未提供某规则的书籍出处，应主动询问而非自行补充
