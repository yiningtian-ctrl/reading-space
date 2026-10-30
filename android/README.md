# ReadSpace Android

正式安装包：网站 `/downloads/readspace-1.0.1.apk`，包名 `space.readspace.android`，版本 1.0.1（2）。支持 Android 7.0 / API 24 及以上，系统 Android WebView 需要保持更新。没有原生 CPU 库，同一个 APK 可用于 ARM 与 x86 设备。

这是使用系统 WebView 的安卓客户端，加载正式站 `https://reading-space-a42.pages.dev/`，自动使用网站的 Material 风格。登录同一账号后获取原有云端学习记录；浏览器未同步的游客数据需要先导出备份再在应用导入。网页功能更新随正式站生效，安卓外壳的变更需要安装新版 APK。

支持系统返回、状态栏与键盘区域适配、系统文件选择器导入 JSON，以及通过系统“保存文件”对话框导出 JSON / CSV / Markdown。首次使用需要联网。离线能力依赖网站的服务工作线程与已准备好的本机缓存；安装包没有内置文章服务器。验证码、云同步和在线词典补充需要网络。

1.0.1 修复：系统返回优先关闭阅读查词、导入等对话框与展开的阅读设置，再返回上一页；应用内隐藏重复安装介绍，同时保留离线准备状态与“更新应用”。需安装新版 APK 才能获取这两项外壳修复，使用原签名可直接覆盖 1.0.0。备份导出和云端账号规则保持不变。

只声明 INTERNET 权限，不需要通讯录、短信、相机或整盘存储权限。应用内只导航到固定的正式站 HTTPS 来源；外部 HTTPS 链接交给系统浏览器；不忽略证书错误、不允许混合内容、不暴露 JavaScript Java 接口、不启用 WebView 调试。文件导出通过来源限定的 WebMessagePort，选择保存位置后才写入用户指定文件。账号缓存不进入系统云备份或设备迁移备份。

## 构建

需要 JDK 17+、Android SDK 36.1、Build Tools 36.0.0；Gradle wrapper 锁定 9.5.0（含 SHA-256 校验），Android Gradle Plugin 9.3.1。通过 ANDROID_HOME 或被忽略的 local.properties 指定 SDK。在此目录运行 `gradlew.bat :app:assembleRelease :app:testDebugUnitTest :app:lintRelease`（macOS/Linux 用 `sh gradlew`）。

发布前通过本地环境设置 `READSPACE_ANDROID_KEYSTORE` 和 `READSPACE_ANDROID_STORE_PASSWORD`，密钥别名为 `readspace`。私钥、密码、本地 SDK 路径和生成的构建目录均禁止提交。已有安装包必须使用相同密钥和更大的 versionCode 升级。当前项目签名身份保存在工作区被忽略的 `.sites-runtime/android-signing/`；请在可信位置另行备份该目录，避免失去后续覆盖升级能力。

输出 `app/build/outputs/apk/release/app-release.apk`。使用 Android Build Tools 的 `apksigner verify --verbose --print-certs` 和 `zipalign -c -P 16 -v 4` 校验后，复制到网站 public/downloads 并更新 SHA256SUMS.txt。禁止将私钥或签名密码放进 APK、源码或下载目录。

## 验证范围

Java 单元测试覆盖来源检查、外部链接策略与文件名清理。`node scripts/qa-android-shell.mjs`（项目根目录运行）使用 Chromium 验证文件导出消息通道、中文内容、重复导航连接、体积限制和隐藏网页安装入口。Android Lint 检查 API 兼容性；API 33 及以上注册 OnBackInvokedCallback，旧版 onBackPressed 仅用于 API 24–32，局部标注避免 Lint 对旧版兼容处理的误报。

这些检查不等同于实机安装测试；当前电脑没有配置可启动的 Android 虚拟设备，也没有在用户的真实手机上运行此 APK。首次实机使用请检查登录同步、返回手势、词句收藏、备份导入导出及断网重开。
