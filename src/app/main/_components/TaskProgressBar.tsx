// 任务条渐变进度条：按进度百分比横向填充整个任务条宽度，颜色随任务状态在绿/黄/灰/红/蓝渐变间平滑过渡。
// 状态变化（颜色变化）通过叠加两层 LinearGradient 交叉淡入淡出实现；进度变化（宽度变化）通过 Reanimated 平滑过渡。
import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { TaskStatus } from '@/common/types';
import { colors } from '@/common/theme';

interface Props {
	status: TaskStatus;
	progress: number;	// 0..1
	style?: ViewStyle;
}

type StatusColorKey = 'green' | 'yellow' | 'gray' | 'red' | 'blue';

// 任务状态 → 渐变基色（对齐 TaskItem.getProgressColor 的绿/黄/灰/红/蓝分组）
function getBaseColorKey(status: TaskStatus): StatusColorKey {
	switch (status) {
		case TaskStatus.running:
		case TaskStatus.finishing:
			return 'green';
		case TaskStatus.paused:
		case TaskStatus.paused_queued:
		case TaskStatus.stopping:
			return 'yellow';
		case TaskStatus.finished:
		case TaskStatus.idle:
			return 'gray';
		case TaskStatus.error:
			return 'red';
		default:
			return 'blue';
	}
}

// 颜色工具：hex → rgb，向白/黑混合，构造 [上边偏浅, 下边偏深] 渐变。从主题基色派生，自动跟随明/暗主题。
// function hexToRgb(hex: string): [number, number, number] {
// 	const h = hex.replace('#', '');
// 	const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
// 	const n = parseInt(full, 16);
// 	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
// }
// function mix(rgb: [number, number, number], target: [number, number, number], amount: number): string {
// 	const r = Math.round(rgb[0] + (target[0] - rgb[0]) * amount);
// 	const g = Math.round(rgb[1] + (target[1] - rgb[1]) * amount);
// 	const b = Math.round(rgb[2] + (target[2] - rgb[2]) * amount);
// 	return `rgb(${r}, ${g}, ${b})`;
// }
function getGradient(base: string, theme = 'light'): [string, string] {
	if (theme === 'light') {
		return [
			['rgb(204, 217, 255)', 'rgb(153, 179, 255)'],	// hwb(225 80% 0% / 0.7), hwb(225 60% 0% / 0.7)
			['rgb(179, 255, 179)', 'rgb(128, 255, 128)'],	// hwb(120 70% 0% / 0.7), hwb(120 50% 0% / 0.7)
			['rgb(255, 238, 153)', 'rgb(255, 230, 102)'],	// hwb(50 60% 0% / 0.7), hwb(50 40% 0% / 0.7)
			['rgb(255, 191, 191)', 'rgb(255, 140, 140)'],	// hwb(0 75% 0% / 0.7), hwb(0 55% 0% / 0.7)
			['rgb(237, 237, 237)', 'rgb(222, 222, 222)'],	// hwb(0 93% 7% / 0.7), hwb(0 87% 13% / 0.7)
		][['blue', 'green', 'yellow', 'red', 'gray'].indexOf(base)] as [string, string];
	} else {
		return [
			['rgb(51, 83, 179)', 'rgb(64, 102, 217)'],	// hwb(225 20% 30% / 0.7), hwb(225 25% 15% / 0.7)
			['rgb(26, 179, 26)', 'rgb(38, 204, 38)'],	// hwb(120 10% 30% / 0.7), hwb(120 15% 20% / 0.7)
			['rgb(191, 159, 0)', 'rgb(217, 183, 13)'],	// hwb(50 0% 25% / 0.7), hwb(50 5% 15% / 0.7)
			['rgb(179, 51, 51)', 'rgb(217, 64, 64)'],	// hwb(0 20% 30% / 0.7), hwb(0 25% 15% / 0.7)
			['rgb(89, 89, 89)', 'rgb(64, 64, 64)'],	//hwb(0 35% 65% / 0.7), hwb(0 25% 75% / 0.7)
		][['blue', 'green', 'yellow', 'red', 'gray'].indexOf(base)] as [string, string];
	}
}

const TRANSITION_MS = 200;	// 颜色过渡时长
const PROGRESS_MS = 300;	// 宽度过渡时长
const FILL_OPACITY = 0.7;	// 整体透明度：作为背景层，保证前景文字可读

interface Layer {
	id: number;
	colors: [string, string];
	visible: boolean;
}

// 单个渐变层：自管 opacity，根据 visible 在 0/1 间过渡，实现交叉淡入淡出。
function GradientLayer({ colors: layerColors, visible }: { colors: [string, string]; visible: boolean }) {
	const opacity = useSharedValue(visible ? 1 : 0);
	useEffect(() => {
		opacity.value = withTiming(visible ? 1 : 0, { duration: TRANSITION_MS, easing: Easing.out(Easing.ease) });
	}, [visible]);
	const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
	return (
		<Animated.View style={[StyleSheet.absoluteFill, animStyle]}>
			<LinearGradient
				colors={layerColors}
				start={{ x: 0, y: 0 }}
				end={{ x: 0, y: 1 }}
				style={StyleSheet.absoluteFill}
			/>
		</Animated.View>
	);
}

export const TaskProgressBar = function TaskProgressBar({ status, progress, style }: Props) {
	// 渐变层栈：始终以最后一层为当前颜色；状态变化时推入新层（淡入），旧层标记为不可见（淡出）。
	const [layers, setLayers] = useState<Layer[]>(() => [
		{ id: 0, colors: getGradient(getBaseColorKey(status)), visible: true },
	]);
	const idRef = useRef(0);
	const lastStatusRef = useRef(status);

	// 容器宽度：onLayout 测量，用于把百分比换算成像素宽度以数值化动画（避免百分比字符串动画的兼容问题）。
	const [containerWidth, setContainerWidth] = useState(0);
	const widthSV = useSharedValue(0);

	// 状态变化：推入新渐变层并淡入，旧层淡出。
	useEffect(() => {
		if (lastStatusRef.current === status) return;
		lastStatusRef.current = status;
		const newColors = getGradient(getBaseColorKey(status));
		const nextId = ++idRef.current;
		setLayers(prev => [
			...prev.map(l => ({ ...l, visible: false })),
			{ id: nextId, colors: newColors, visible: true },
		]);
	}, [status]);

	// 过渡结束后清理已淡出的层，避免无限堆积。
	useEffect(() => {
		if (layers.length <= 1) return;
		const timer = setTimeout(() => {
			setLayers(prev => prev.filter(l => l.visible));
		}, TRANSITION_MS + 10);
		return () => clearTimeout(timer);
	}, [layers]);

	// 进度变化：平滑过渡到新宽度。
	useEffect(() => {
		if (containerWidth <= 0) return;
		const target = Math.max(0, Math.min(1, progress)) * containerWidth;
		widthSV.value = withTiming(target, { duration: PROGRESS_MS, easing: Easing.out(Easing.quad) });
	}, [progress, containerWidth]);

	const fillStyle = useAnimatedStyle(() => ({ width: widthSV.value }));

	const onLayout = (event: LayoutChangeEvent) => {
		const width = event.nativeEvent.layout.width;
		if (width > 0) setContainerWidth(width);
	};

	return (
		<View onLayout={onLayout} style={[StyleSheet.absoluteFill, { opacity: FILL_OPACITY }, style]}>
			<Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0 }, fillStyle]}>
				{layers.map((layer) => (
					<GradientLayer key={layer.id} colors={layer.colors} visible={layer.visible} />
				))}
			</Animated.View>
		</View>
	);
};
