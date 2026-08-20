// 移动端 UI 主题：移植自 FFBox 亮色主题（src/renderer/src/App/theme.css）
// FFBox 用 LESS 变量 + hwb() 定义颜色，RN 不支持 CSS 变量层叠，故在此转成具体色值集中管理。
// HWB → RGB（hwb(H W% B%)，HWB 转 HSL 后再转 RGB）：
//   bg100: hwb(0 100% 0%)        → #FFFFFF
//   bg98:  hwb(0 98% 2%)         → #FAFAFA  卡片背景
//   bg92:  hwb(0 92% 8%)         → #F2F3F5  页面背景
//   menuItemHovered: hwb(210 80% 0%)  → #E8F2FD  悬浮选中背景
//   menuItemSelected: hwb(210 60% 0%) → #B3D6F7  激活选中背景
//   primaryColor: hwb(220 25% 10%)   → #208AEF  主色（蓝色）
//   --33: #333 / --66: #666 / --e7: #E7E7E7 / --f7: #F7F7F7 / --ff: #FFFFFF
export const colors = {
	// 背景色系（对应 FFBox --bg 系列）
	bg: '#F2F3F5',			// 页面背景（--bg92）
	card: '#FAFAFA',		// 卡片/列表背景（--bg98）
	border: '#E6E6E6',
	// 主色
	primary: '#208AEF',		// 主色（--primaryColor，按钮、进度条蓝）
	// 文字
	textMain: '#333333',	// --33
	textSub: '#999999',
	textMuted: '#c0c4cc',
	// 任务进度条/状态颜色（FFBox 设计）
	green: '#2e9e44',		// 运行中
	yellow: '#e6a23c',		// 已暂停/停止中/排队中
	gray: '#c9ccd1',		// 空闲/已完成
	red: '#d9534f',			// 出错
	blue: '#208AEF',		// 初始化/上传中
	// 菜单交互色（对应 FFBox --menuItem*）
	menuItemHovered: '#E8F2FD',
	menuItemSelected: '#B3D6F7',
};

// 阴影：RN 无 CSS box-shadow 层叠，需按组件逐一给出（对应 FFBox TaskItem.module.less 等）
export const shadows = {
	// FFBox TaskItem .backgroundWhite：
	//   box-shadow: 0 0 1px 2px hwb(var(--bg98)), 0 2px 6px 0 hwb(0 0% 100% / 0.2)
	taskItem: {
		elevation: 4,
		shadowColor: '#000',
		shadowOpacity: 0.16,
		shadowRadius: 6,
		shadowOffset: { width: 0, height: 2 },
	},
	// 标题栏下方阴影（对应 ActionBar 区域的分隔感）
	header: {
		elevation: 2,
		shadowColor: '#000',
		shadowOpacity: 0.06,
		shadowRadius: 3,
		shadowOffset: { width: 0, height: 1 },
	},
	// 卡片/菜单通用阴影
	card: {
		elevation: 8,
		shadowColor: '#000',
		shadowOpacity: 0.08,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 4 },
	},
};

// 兼容旧引用：theme.colors / theme.shadows
export const theme = { colors, shadows };
