// 移植自 FFBox `StatusBar.vue` + `ActionBar.vue` + `TitleBar.vue`（标题栏）。
// 移动端标题栏：左上 IP + 统计信息，中间 FFBox + 队列总进度（形如 PC 端 `FFBox - 100%`），右上 开始/暂停、多选、更多。
// 改动点（相对步骤 2）：原本位于画面底部的「队列总进度 footer」移除，进度改在标题栏中间的 FFBox 处展示。
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSnapshot } from 'valtio';
import { appStore } from '../stores/appStore';
import { ServiceBridgeStatus } from '../bridges/serviceBridge';
import { colors } from '../common/theme';

interface Props {
	/** 点击「⋯」更多按钮（由主界面打开操作菜单） */
	onMorePress: () => void;
}

export function HeaderBar({ onMorePress }: Props) {
	const snap = useSnapshot(appStore);
	const server = snap.currentServer;
	const data = server?.data;
	const connected = server?.entity.status === ServiceBridgeStatus.Connected;
	const running = data?.workingStatus === 'running';
	const progress = data?.progress ?? -1;
	// 队列总进度：progress >= 0 时形如 `FFBox - 100%`，否则仅显示 `FFBox`
	const title = progress >= 0 ? `FFBox - ${Math.round(progress * 100)}%` : 'FFBox';

	const handleStartPause = () => {
		if (connected) appStore.startNpause();
	};
	const handleMultiSelect = () => {
		// 非选择模式 → 进入多选模式；选择模式 → 反选（0 则自动退出）
		if (snap.multiSelect) {
			appStore.invertSelection();
		} else {
			appStore.toggleMultiSelect();
		}
	};

	return (
		<View style={styles.header}>
			<View style={styles.left}>
				<Text style={styles.ip} numberOfLines={1}>
					{server?.entity.ip || '未连接'}
				</Text>
				<Text style={styles.stats} numberOfLines={1}>
					任务 {data?.totalCount ?? 0} · 信息 {data?.notifications?.length ?? 0} · 异步 {data?.asyncList?.length ?? 0}
				</Text>
			</View>
			<Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
				{title}
			</Text>
			<View style={styles.right}>
				<TouchableOpacity style={styles.btn} onPress={handleStartPause} disabled={!connected} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
					<Ionicons name={running ? 'pause' : 'play'} size={22} color={connected ? colors.primary : colors.textMuted} />
				</TouchableOpacity>
				<TouchableOpacity style={[styles.btn, styles.textBtn]} onPress={handleMultiSelect} hitSlop={{ top: 6, bottom: 6 }}>
					<Text style={styles.btnText}>{snap.multiSelect ? '反选' : '多选'}</Text>
				</TouchableOpacity>
				<TouchableOpacity style={styles.btn} onPress={onMorePress} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
					<Ionicons name="ellipsis-horizontal" size={24} color={colors.textMain} />
				</TouchableOpacity>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		height: 54,
		paddingHorizontal: 12,
		backgroundColor: colors.card,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	left: {
		flexShrink: 1,
		maxWidth: '42%',
	},
	ip: { fontSize: 16, fontWeight: '600', color: colors.textMain },
	stats: { fontSize: 11, color: colors.textSub, marginTop: 2 },
	title: {
		flex: 1,
		textAlign: 'center',
		fontSize: 15,
		fontWeight: '600',
		color: colors.textMain,
		paddingHorizontal: 6,
	},
	right: {
		flexShrink: 1,
		flexDirection: 'row',
		alignItems: 'center',
	},
	btn: {
		width: 34,
		height: 34,
		alignItems: 'center',
		justifyContent: 'center',
	},
	textBtn: { width: 'auto', paddingHorizontal: 6 },
	btnText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
});
