# 提交到 reading-space：从这里开始

这是 ReadSpace 的完整源码包。仓库名称改成 reading-space，网站内的 ReadSpace 品牌名称保留。包内有 179 个项目文件，隐藏配置已包含。

## 1. 准备两个不同的文件夹

1. 解压 ReadingSpace-Complete-20261021.zip，打开里面的 reading-space。这是“源码文件夹”，直接包含 package.json、app、components 等。
2. 安装 GitHub Desktop（https://desktop.github.com/），登录你创建 reading-space 仓库使用的 GitHub 账号。
3. 在 GitHub Desktop 点击 File → Clone repository → URL，填入新仓库的 HTTPS 地址。按之前的用户名，地址应为：https://github.com/yiningtian-ctrl/reading-space.git 。请以你自己仓库页面 Code 按钮显示的 HTTPS 地址为准。
4. Local path 选择一个新的、尚未使用的文件夹，例如 Documents/GitHub/reading-space。不要选第 1 步的解压目录。点击 Clone。空仓库出现 empty repository 提示属于正常情况，继续下一步。
5. 克隆结束后，在 Desktop 点击 Repository → Show in Explorer，打开“仓库文件夹”。确认 Current Repository 为 reading-space。

## 2. 将完整源码复制进去

1. 在 Windows 文件资源管理器打开“查看 → 显示 → 隐藏的项目”。
2. 打开解压后的“源码文件夹”reading-space，在里面按 Ctrl+A、Ctrl+C。
3. 进入刚克隆的“仓库文件夹”，按 Ctrl+V。若有同名文件，选择替换。保留克隆生成的 .git 文件夹。
4. 检查仓库根目录直接包含 package.json，并且能找到 .github/workflows/check.yml、.openai/hosting.json。不要多套一层 reading-space/reading-space。

## 3. 提交并上传

1. 回到 GitHub Desktop 的 Changes 页面，检查并选中全部项目文件的变更。若远端原本只有 README，新增文件数会与空仓库略有不同，不必强求界面必须显示 179 个变更。
2. 左下角 Summary 填：Add complete ReadSpace project。
3. 点击 Commit to main。如果你的默认分支名字不同，按钮会显示实际分支名。
4. 再点顶部 Push origin；如果首次推送显示 Publish branch，则点 Publish branch，将当前分支推送到已克隆的 reading-space 仓库。
5. Commit 保存到本机，Push/Publish branch 才上传到 GitHub。不要再点击 Publish repository 创建另一个仓库。

## 4. 上传成功的判断方法

打开你新建的 reading-space 仓库，刷新 Code 页面，确认：

- 根目录直接有 package.json、package-lock.json、vite.config.ts。
- .github/workflows/check.yml 存在。
- .openai/hosting.json 存在。
- components/word-english.tsx 和 scripts/run-framework.mjs 存在。

再打开 Actions，检查最新一次 Check。工作流依次安装依赖、运行测试、类型检查和生产构建。Queued 表示等待运行器，不是未上传成功；失败时点进报错步骤查看日志。无需选择 Actions 模板。

## 常见问题

- 网页显示 This file is hidden：这个提示来自网页上传入口。本次用 Desktop 提交，隐藏目录按正常源码一起保留。
- 仓库页面显示 404：先用浏览器登录创建仓库的账号，确认仓库页面能打开，并从 Code 复制实际 HTTPS 地址。Desktop 也需登录同一账号；私有仓库无需改成公开。
- 包内已经有 hosting.json，不需要再手写。它位于 .openai 文件夹内，根目录不应另建一个替代它。
- 本包不包含 .git、node_modules、登录凭据、原站点部署身份和个人学习记录。仓库登录由 Desktop 完成，个人记录可在原站“我的”页面单独导出 JSON。
- ZIP 是交付包。上传 ZIP 本身只会保存一个压缩文件，不会自动展开成能构建的项目。
- 项目超过 100 个文件，这次使用 Desktop 一次提交，不要再在网页中批量拖拽源码。
- Check 通过说明检查与构建成功。网站上线仍需另行部署，含服务端接口的完整项目不能直接在纯静态 GitHub Pages 上运行。

## 可选：本地运行

提交到 GitHub 不需要先安装项目依赖。如需在电脑上运行，安装 Node.js 24，在有 package.json 的仓库目录执行：

    npm ci
    npm run dev

然后打开终端显示的本地地址。检查命令为 npm test、npm run typecheck、npm run build。

## GitHub 官方帮助

- 克隆仓库：https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-a-repository-from-github-to-github-desktop
- 提交并推送：https://docs.github.com/en/desktop/making-changes-in-a-branch/committing-and-reviewing-changes-to-your-project-in-github-desktop