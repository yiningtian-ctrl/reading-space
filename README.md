# ReadSpace

Discover, Read, Remember. 为四级备考打造、手机优先的个人英文阅读空间。

## GitHub 上传

部署到 Cloudflare Pages + Functions、并绑定 LOCALHOST 免费子域名时，请按 [PAGES_DEPLOY.md](PAGES_DEPLOY.md) 操作。构建命令为 `node scripts/build-pages.mjs`，输出目录为 `dist/pages`。这保留服务端接口，和纯静态 GitHub Pages 不同。

本文件夹是仓库根目录，详见 [GITHUB_UPLOAD.md](GITHUB_UPLOAD.md)。请上传解压后的源码和隐藏目录，不要只上传 ZIP。这个项目有服务端接口，GitHub Pages 无法直接运行完整功能。

## 账号与跨设备同步

支持用户名与密码登录，使用 Cloudflare D1 保存学习记录，浏览器保留离线副本。上线数据库配置、旧记录迁移、恢复码与同步规则见 [ACCOUNTS.md](ACCOUNTS.md)。生产数据库绑定由 cloudflare-d1.json 与 Pages 构建脚本生成，预览分支不共享生产资料。

## 邮箱验证码
每个账号必须绑定验证邮箱，新注册需邮箱验证码，支持邮箱验证码登录；老账号先使用原密码登录后绑定邮箱，原云端数据保留。发信由配置在 Cloudflare 机密中的 163 SMTP 客户端授权码支持，详见 [EMAIL_LOGIN.md](EMAIL_LOGIN.md)。

## 本地运行

需要 Node.js 22.18+。运行 `npm install`，再运行 `npm run dev`，打开终端显示的本地地址。`npm run build` 构建 Cloudflare Worker；`npm start` 预览构建产物。技术采用 TypeScript、React、Next.js App Router 兼容的 Vinext、Tailwind CSS 及 localStorage。

## 五个入口

- 首页：仅保留继续阅读入口与附原作出处的名言，没有文章推荐流或统计面板。首次使用可从这里选择第一篇文章。
- 图书馆：顶部书架放置已收藏文章，下方浏览全部训练文章、真实来源和个人导入；支持关键词、来源、主题、难度与时长筛选。
- Reader：点词中英释义、保存原句、文本高亮批注、每段预编写的词汇提示／结构解析／译文、纸色／字体／行距／宽度设置、阅读进度续读和阅读计时。
- 词句本：生词／句子切换，单词保留音标（如有）、中英释义、原句与掌握状态；阅读高亮与批注自动归入句子，可编辑个人理解并返回原文。
- 复习：单词与句子分别进入复习流程，支持查看释义／个人理解、标记掌握与继续巩固；本周复习记录只统计实际答题的本地日期。每次最多 20 项，不含自动间隔复习算法。
- 我的：阅读积累统计、学习目标、生词 CSV 导出、句子与批注 Markdown 导出、完整 JSON 备份及恢复。
- 备份：本地 JSON 导出和严格校验后恢复。未登录时记录仅保存在当前浏览器；登录后会同步已确认的云端版本。未同步的离线修改仍依赖本机缓存，请保留备份。

## 内容与辅助的边界

6 篇 ReadSpace 训练文章为本项目原创、由 AI 辅助编写，非四六级真题，难度标签不是官方等级评估。词汇提示、段落结构解析和译文预先编写，不是实时 AI 调用。自行导入文章不伪造解析或翻译，可查词和批注。支持账号与云同步；没有实时 AI 解析或自动出题。

真实来源使用官方 RSS 元数据和跳转链接，当前包含 BBC、VOA、Breaking News English、Science News、Smithsonian 和 The Guardian 的 7 条订阅，上游失败时保留已有内容及 British Council 精选。图书馆打开时检查更新，停留期间每 5 分钟检查，阅读器内不轮询。来源清单见 `lib/article-feeds.ts`。

公开正文导入仅支持 `lib/article-import-policy.mjs` 指定的 VOA、Science News、Smithsonian、The Guardian 文章路径，保留来源并在用户浏览器保存，读取失败时可手动粘贴；不会绕过订阅、登录或验证，也不承诺任意网站全文提取。BBC 和 Breaking News English 目前只提供原站入口与手动导入。

学习数据仍使用 `readspace.study.v1`。新增的 `review` 历史和单词音标都是可选字段；旧记录不重置、旧 JSON 备份仍可恢复。句子复习引用已有高亮批注 ID，不复制或改写原句，也不会将个人批注当作机器翻译。

中文释义优先使用本项目简短学习注解，再由服务端内置的 [ECDICT](https://github.com/skywind3000/ECDICT) 子集查询，包含 7,974 个基础／四六级／常见词条及 11,824 个词形映射。此子集固定于提交 `bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b`，保留完整中文释义和 MIT 许可，见 `vendor/ECDICT.LICENSE` 和 `/licenses/ecdict.txt`；仅词典接口打包此词库，浏览器首屏不下载整个词库。使用 `scripts/prepare-dictionary.mjs` 可从该版本的原始 CSV 重建子集。

查词弹窗即时显示中文，并通过独立请求补充 [Free Dictionary API](https://dictionaryapi.dev/) 的按词性分组的英文义项、原词典例句、近义词和反义词。相同单词在当前页面最多缓存 100 条成功查询；服务端响应可缓存一小时。可以展开全部义项，选择适合原句的一项保存；生词本与复习卡片保留所选英文释义及来源许可。修改已有收藏会更新原记录，不重复添加，也不重置掌握状态。

ECDICT 子集同时保留 7,881 个词条的原始英文释义，用于即时展示与在线补充失败时的回退。在线补充最多等待 6.5 秒，词形未收录时尝试词库中的原形。缺少例句或近反义词时不生成补齐。中文释义的手动编辑不会被后台查询覆盖；旧的本地记录和备份仍兼容。没有接入牛津词典。

公开词典服务不承诺可用性；使用返回的原词条链接和许可证，分别标注中、英文来源。在线未收录时仍可填写个人释义并保存原句。

图片来自 Unsplash，已下载至 `public/images`，无需依赖远程图片服务：forest（photo-1441974231531-c6227db76b6e）、study（photo-1499750310107-5fef28a66643）、city（photo-1486406146926-c627a92ad1ab）、nature（photo-1500530855697-b586d89ba3ee）。

## 检查

推荐 Node.js 24。`npm test` 覆盖阅读功能、账号与同步的单元测试；`npm run typecheck` 检查类型；`npm run build` 检查生产构建。`node scripts/qa.mjs`（也可运行 `scripts/qa-five-tabs.mjs`）验收五入口、书架、词句编辑、两种复习、真实周记录、三种导出、旧备份、阅读器与 320／390／768／1440px 布局。浏览器脚本需要 `playwright-core` 和 Chromium / Edge；可通过 `EDGE_PATH` 指定浏览器，通过 `QA_URL` 指定预览地址。

增强词典的专项检查：`node --test scripts/dictionary.test.mjs` 验证多义项、词形回退和上游失败；`node scripts/qa-dictionary.mjs` 验证手机上的义项选择、输入保护、收藏更新、复习和真实词典响应。浏览器测试使用独立临时上下文，不访问用户现有的个人文章或学习记录。
