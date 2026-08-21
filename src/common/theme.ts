// 移动端 UI 主题：完整移植自 FFBox 主题系统（src/renderer/src/App/theme.css）
// 支持明/暗双主题，预留主题切换能力（colorScheme）。
// HWB → RGB 转换已通过 Python 脚本精确计算。

export type ColorScheme = 'light' | 'dark';
export let colorScheme: ColorScheme = 'light';

export interface Colors {
	// 背景色阶（对应 FFBox --bg100 ~ --bg90）
	bg100: string;
	bg99: string;
	bg98: string;
	bg97: string;
	bg96: string;
	bg95: string;
	bg94: string;
	bg93: string;
	bg92: string;
	bg91: string;
	bg90: string;
	// 反向色系（用于文字、输入框等）
	ff: string;
	f7: string;
	e7: string;
	'66': string;
	'33': string;
	// 组件交互色
	highlight: string;
	hoverLightBg: string;
	hoverShadow: string;
	opposite: string;
	opposite80: string;
	// 错误/警告色
	errorBorder: string;
	errorBgHover: string;
	errorBgActive: string;
	// 菜单交互色
	menuItemLight: string;
	menuItemHovered: string;
	menuItemSelected: string;
	// 主色
	primaryColor: string;
	// 其他
	titleText: string;
	articleBorder: string;
	articleLightBg: string;
	// 任务状态色（FFBox 任务进度条/图标）
	green: string;
	yellow: string;
	gray: string;
	red: string;
	blue: string;
	// 快捷引用（兼容现有组件）
	bg: string;       // 页面背景
	card: string;     // 卡片背景
	border: string;   // 边框
	textMain: string; // 主文字
	textSub: string;  // 次文字
	textMuted: string; // 弱化文字
	primary: string;  // 主色别名
}

// 亮色主题（themeLight）
export const lightColors: Colors = {
	bg100: '#FFFFFF',
	bg99: '#FCFCFC',
	bg98: '#FAFAFA',
	bg97: '#F7F7F7',
	bg96: '#F5F5F5',
	bg95: '#F2F2F2',
	bg94: '#F0F0F0',
	bg93: '#EDEDED',
	bg92: '#EBEBEB',
	bg91: '#E8E8E8',
	bg90: '#E6E6E6',
	ff: '#FFFFFF',
	f7: '#F7F7F7',
	e7: '#E7E7E7',
	'66': '#666666',
	'33': '#333333',
	highlight: '#FFFFFF',
	hoverLightBg: '#FFFFFF',
	hoverShadow: '#000000',
	opposite: '#FFFFFF',
	opposite80: '#CCCCCC',
	errorBorder: '#EE7777',
	errorBgHover: '#F7E7E7',
	errorBgActive: '#FFEEEE',
	menuItemLight: '#E6F0FA',
	menuItemHovered: '#CCE5FF',
	menuItemSelected: '#99CCFF',
	primaryColor: '#4077E6',
	titleText: '#2255EE',
	articleBorder: '#FFC800',
	articleLightBg: '#FFF4E0',
	green: '#2e9e44',
	yellow: '#e6a23c',
	gray: '#c9ccd1',
	red: '#d9534f',
	blue: '#4077E6',
	bg: '#EBEBEB',
	card: '#FAFAFA',
	border: '#E6E6E6',
	textMain: '#333333',
	textSub: '#999999',
	textMuted: '#c0c4cc',
	primary: '#4077E6',
};

// 暗色主题（themeDark）
export const darkColors: Colors = {
	bg100: '#333333',
	bg99: '#2E2E2E',
	bg98: '#2B2B2B',
	bg97: '#282828',
	bg96: '#242424',
	bg95: '#202020',
	bg94: '#1C1C1C',
	bg93: '#181818',
	bg92: '#141414',
	bg91: '#111111',
	bg90: '#0D0D0D',
	ff: '#000000',
	f7: '#222222',
	e7: '#333333',
	'66': '#B7B7B7',
	'33': '#DDDDDD',
	highlight: '#404040',
	hoverLightBg: '#333333',
	hoverShadow: '#000000',
	opposite: '#000000',
	opposite80: '#333333',
	errorBorder: '#DD6666',
	errorBgHover: '#472727',
	errorBgActive: '#552222',
	menuItemLight: '#4C667F',
	menuItemHovered: '#334C66',
	menuItemSelected: '#1A66B3',
	primaryColor: '#265DCC',
	titleText: '#3377FF',
	articleBorder: '#CC8C33',
	articleLightBg: '#26201A',
	green: '#44CC66',
	yellow: '#FFCC44',
	gray: '#666666',
	red: '#FF6666',
	blue: '#265DCC',
	bg: '#141414',
	card: '#2B2B2B',
	border: '#0D0D0D',
	textMain: '#DDDDDD',
	textSub: '#999999',
	textMuted: '#666666',
	primary: '#265DCC',
};

// 主题对象集合（预留主题切换功能）
export const themes: Record<ColorScheme, Colors> = {
	light: lightColors,
	dark: darkColors,
};

export const colors: Colors = themes[colorScheme];

// 获取当前主题的颜色（预留接口，后续可根据系统/用户偏好动态切换）
export function getColors(scheme: ColorScheme = 'light'): Colors {
	return themes[scheme];
}

// 兼容旧引用
export const theme = { colors };
