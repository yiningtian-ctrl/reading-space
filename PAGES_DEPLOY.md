# 使用免费子域名部署 ReadSpace

适用域名：reading-space.githubpage.com，由 LOCALHOST 提供 DNS 管理。

这是 Cloudflare Pages + Functions 部署，不是 GitHub Pages。阅读器、图书馆、词句本、复习、导出和现有三个服务端接口仍保留。原 Worker 无需删除。

## 第一步：提交适配文件到原仓库

将本包 reading-space 文件夹里的内容复制到 GitHub Desktop 中 reading-space 仓库的根目录，替换同名文件；保留原有 .git。也可以仅应用附带的五文件补丁。

在 Desktop 中填写 Summary（例如 Add Cloudflare Pages deployment），点击 Commit，再点击 Push origin。

## 第二步：创建 Cloudflare Pages 项目

1. 回到 Cloudflare 的 Workers & Pages 总列表，点击创建应用，找到 Pages 入口（可能位于“Looking to deploy Pages?”或“Get started”链接下）。不要在原 Worker 的 Domains 页继续添加。
2. 选择通过 Git 导入，连接现有 GitHub 仓库 yiningtian-ctrl/reading-space。
3. 生产分支选 main；框架预设选 None。
4. 构建命令填写：node scripts/build-pages.mjs
5. 构建输出目录填写：dist/pages
6. 根目录保留仓库根目录；构建环境变量 NODE_VERSION 填 24。
7. 保存并部署。该构建会生成 Pages 的运行配置、Node.js 兼容标志及服务端入口，不需要单独填写 Workers 的部署命令。
8. 记录 Cloudflare 实际分配给项目的 xxx.pages.dev 地址，名称不一定就是 reading-space.pages.dev。后续 DNS 以控制台显示的实际地址为准。

## 第三步：在 Pages 里添加子域名

打开新 Pages 项目 → Custom domains → Set up a custom domain，填写 reading-space.githubpage.com。按提示开始验证。必须先关联 Pages 项目，再添加 DNS；不能只加 CNAME 而跳过关联。

## 第四步：在 LOCALHOST 添加 DNS

回到你截图中的子域名管理页面，点击“添加记录”。

- 类型：CNAME。
- 主机记录：如果平台要求相对于 reading-space.githubpage.com 填写，使用 @；如果要求完整域名，填写 reading-space.githubpage.com。以界面展示的最终完整名称为准，避免重复拼接 reading-space。
- 目标／记录值：第二步控制台实际显示的 xxx.pages.dev，只填主机名，不加 https:// 或末尾 /。
- TTL：默认。
- 若有代理开关，先使用“仅 DNS / DNS only”。

保存后回到 Pages 等待自定义域名和证书激活，再访问 https://reading-space.githubpage.com/。若提示记录冲突，先确认冲突项属于这个子域名，不要删除其他人的域名记录。

## 验证与边界

2026-10-21 本地验证：24 项单元测试、TypeScript 检查、Pages 构建及重复构建通过；在 Wrangler Pages 运行环境中验证首页、9 个 JS/CSS 资源、图片、查词中英释义与在线失败回退、发现接口（37 篇文章 / 7 个来源报告）、导入安全限制及服务端文件不可公开访问。浏览器自动化因本机 Edge 启动失败而未完成；本次不修改应用界面或学习数据格式。

构建成功与自定义域名生效是两步。DNS、证书和实际网络可达性仍需上线后验证，不保证所有网络都能访问。三个 API 保留原有公开来源、超时、失败回退和导入限制。

学习记录依旧只保存在浏览器的当前站点中，换域名不会自动迁移。先在旧网站“我的”导出 JSON，再到新域名导入备份。

本地验证：在项目根目录执行 node scripts/build-pages.mjs，再执行 npx wrangler pages dev dist/pages。Pages 会自动读取构建生成的 wrangler.jsonc。

官方参考：

- 外部 DNS 子域名：https://developers.cloudflare.com/pages/configuration/custom-domains/#add-a-custom-subdomain
- Pages Functions：https://developers.cloudflare.com/pages/functions/advanced-mode/
