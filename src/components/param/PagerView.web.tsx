// web 端 PagerView shim：react-native-pager-view 是原生模块，web 无法直接打包。
// 这里用横向分页 ScrollView 模拟 ViewPager 的核心 API（initialPage / onPageSelected / ref.setPage），
// 仅用于 web 端预览验证；真机/模拟器仍走原生 PagerView。
import { forwardRef, useImperativeHandle, useRef, useState, Children } from 'react';
import { View, ScrollView, StyleSheet, LayoutChangeEvent, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

export interface PagerViewOnPageSelectedEvent {
	nativeEvent: { position: number };
}

export interface PagerViewProps {
	initialPage?: number;
	onPageSelected?: (event: PagerViewOnPageSelectedEvent) => void;
	style?: any;
	children?: React.ReactNode;
}

export interface PagerViewHandle {
	setPage: (index: number) => void;
}

export const PagerView = forwardRef<PagerViewHandle, PagerViewProps>(function PagerView(
	{ initialPage = 0, onPageSelected, style, children },
	ref,
) {
	const scrollRef = useRef<ScrollView>(null);
	const [containerWidth, setContainerWidth] = useState(0);
	const pageRef = useRef(initialPage);

	useImperativeHandle(ref, () => ({
		setPage: (index: number) => {
			pageRef.current = index;
			scrollRef.current?.scrollTo({ x: index * containerWidth, animated: true });
			onPageSelected?.({ nativeEvent: { position: index } });
		},
	}));

	const onLayout = (e: LayoutChangeEvent) => {
		const width = e.nativeEvent.layout.width;
		setContainerWidth(width);
		if (pageRef.current > 0 && width > 0) {
			// 初始页在 layout 后再校准一次，避免宽高未知时起始页错位
			scrollRef.current?.scrollTo({ x: pageRef.current * width, animated: false });
		}
	};

	const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
		if (!containerWidth) return;
		const index = Math.round(e.nativeEvent.contentOffset.x / containerWidth);
		if (index !== pageRef.current) {
			pageRef.current = index;
			onPageSelected?.({ nativeEvent: { position: index } });
		}
	};

	return (
		<ScrollView
			ref={scrollRef}
			style={style}
			horizontal
			pagingEnabled
			showsHorizontalScrollIndicator={false}
			onLayout={onLayout}
			onMomentumScrollEnd={onMomentumScrollEnd}
		>
			{Children.map(children, (child, i) => (
				<View key={i} style={[styles.page, containerWidth > 0 && { width: containerWidth }]}>
					{child}
				</View>
			))}
		</ScrollView>
	);
});

const styles = StyleSheet.create({
	page: {
		flexShrink: 0,
		flexGrow: 0,
	},
});

export default PagerView;