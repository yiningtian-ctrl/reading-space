# Android 触控体验版

本测试版为独立安装包 `space.readspace.android.preview`，名称“ReadSpace 体验版”，与正式版 `space.readspace.android` 并存。它只信任 `https://preview-mobile-touch.reading-space-a42.pages.dev`，用于检查手机触控、动画和阅读弹窗；数据与正式网站及正式 APK 独立。测试站未绑定生产数据库，不能登录正式账号，也不应导入真实个人备份。

测试的界面变更位于 `app/styles/android-touch.css`：底部弹层、段落辅助触控区域、导航反馈、简短入场动画与减少动态效果回退。文本选择沿用系统行为；所有学习功能的保存规则与原站一致，但记录只保存在体验版自己的存储中。

构建时复制 `android/` 到不受版本控制的临时目录，排除构建输出；将 applicationId 设置为 `space.readspace.android.preview`，应用名设为“ReadSpace 体验版”，Activity 类名保持 `space.readspace.android.MainActivity`，仅将 `UrlPolicy.ORIGIN` 和可信主机改为测试站。用本地已保管的 ReadSpace 签名构建，确保密钥及密码不会进入源码或 APK。生产构建的包名、来源和数据库配置不改变。

测试仅使用 Chromium 手机尺寸模拟、Android 构建和签名静态检查，不等于实机测试。确认效果后再决定是否将界面调整推广到正式应用；不将测试版 APK 和测试地址作为正式版本发布。
