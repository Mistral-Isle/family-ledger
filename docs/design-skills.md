# 苹果风格设计参考

本项目是 Expo / React Native，不需要为接入原生控件重写为 SwiftUI。

| 技能 | 用途与本项目适配 |
| --- | --- |
| 本机 apple-design | 本次采用：系统字体、连续圆角、可打断弹簧、手势滑动、安全区与减少动态效果。 |
| [FloWritesCode / swiftui-liquid-glass](https://github.com/FloWritesCode/fwc-swiftui-skills/tree/main/skills/swiftui-liquid-glass) | 原生 Liquid Glass 的材料层级、系统版本回退、固定导航区域使用玻璃的参考；SwiftUI 代码不直接复制进 React Native。 |
| [twostraws / swiftui-pro](https://github.com/twostraws/SwiftUI-Agent-Skill) | SwiftUI 原生界面与可访问性审查；适合未来单独开发 SwiftUI 原生页面时使用。 |

没有为了配色差异安装重复依赖，也没有将外部技能当作可执行脚本运行。三种外观在应用内直接切换，预览见 [样式对照](ui-styles.html)。

原生组件使用 [expo-glass-effect](https://docs.expo.dev/versions/latest/sdk/glass-effect/)、[UISegmentedControl 封装](https://docs.expo.dev/versions/latest/sdk/segmented-control/) 与 @react-native-community/datetimepicker；采用官方 Expo SDK 57 对应版本。底部导航支持拖动选中项，玻璃只用于固定操作层。
