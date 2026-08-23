// 「上传进度」页：全局上传任务列表（读取/哈希/上传实时进度）。
// 顶部 tab 切换：默认显示「全部任务」，可切换到「当前已选」任务的上传任务。
// 本页不再自动跳转「选择预设」；上传流程为 主界面选文件 → 预设页 → 本页。
import { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSnapshot } from 'valtio';
import { appStore } from '@/stores/appStore';
import { UploadFile } from '@/types';
import { colors } from '@/common/theme';
import { formatSize } from '@/common/formatUtils';

type Filter = 'all' | 'selected';
const FILTER_LABEL: Record<Filter, string> = {
	all: '全部任务',
	selected: '当前已选',
};

export default function UploadScreen() {
	const router = useRouter();
	const snap = useSnapshot(appStore);
	const server = snap.currentServer;
	const selected = snap.selectedTask;

	// 上传进度 tab：默认「全部任务」
	const [filter, setFilter] = useState<Filter>('all');

	// 全部上传文件（valtio 快照转为可变类型供 FlatList 使用）
	const allFilesArr = useMemo(() => (server?.data.uploadFiles ?? []) as UploadFile[], [server?.data.uploadFiles]);

	const files = useMemo(() => {
		return filter === 'all'
			? allFilesArr
			: (allFilesArr ?? []).filter((f) => selected?.has(f.taskId));
	}, [filter, allFilesArr, selected]);

	const goBack = useCallback(() => {
		// 返回主界面并清除选中，避免停留在多选模式
		appStore.selectedTask = undefined;
		router.back();
	}, [router]);

	const renderItem = ({ item }: { item: UploadFile }) => {
		const read = item.chunks.reduce((prev, curr) => prev + curr.size, 0);
		const hashed = item.chunks.reduce((prev, curr) => prev + (curr.hash ? curr.size : 0), 0);
		const uploaded = item.chunks.reduce((prev, curr) => prev + (curr.transferred ?? 0), 0);
		// console.log(`上传进度 ${uploaded}`, item.chunks.map((c) => c.transferred));
		const overallProgress = item.size ? (read * 0.1 + hashed * 0.1 + uploaded * 0.8) / item.size : 0;
		return (
			<View style={styles.item}>
				<View style={styles.itemRow}>
					<Ionicons name="document-outline" size={18} color={colors.textSub} />
					<Text style={styles.itemName} numberOfLines={1}>{item.fileBaseName}</Text>
					<Text style={styles.itemStatus}>{item.status}</Text>
				</View>
				<View style={styles.progressTrack}>
					<View style={[styles.progressFill, { width: `${Math.round(overallProgress * 100)}%` }]} />
				</View>
				<View style={styles.itemMeta}>
					<Text style={styles.itemMetaText}>
						{`读取 ${formatSize(read)} · 哈希 ${formatSize(hashed)} · 上传 ${formatSize(uploaded)}`}
					</Text>
					<Text style={styles.itemMetaText}>
						{(overallProgress * 100).toFixed(1)}%
					</Text>
				</View>
			</View>
		);
	};

	return (
		<SafeAreaView style={styles.safeArea}>
			<View style={styles.header}>
				<TouchableOpacity style={styles.btn} onPress={goBack} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
					<Ionicons name="arrow-back" size={24} color={colors.textMain} />
				</TouchableOpacity>
				<Text style={styles.headerTitle} numberOfLines={1}>上传进度</Text>
				<View style={styles.btn} />
			</View>

			{/* tab 切换：全部任务 / 当前已选 */}
			<View style={styles.tabBar}>
				{(Object.keys(FILTER_LABEL) as Filter[]).map((key) => (
					<TouchableOpacity
						key={key}
						style={[styles.tab, filter === key && styles.tabActive]}
						onPress={() => setFilter(key)}
					>
						<Text style={[styles.tabText, filter === key && styles.tabTextActive]}>{FILTER_LABEL[key]}</Text>
					</TouchableOpacity>
				))}
			</View>

			{files.length === 0 ? (
				<View style={styles.center}>
					<Text style={styles.emptyText}>暂无可显示的上传任务</Text>
				</View>
			) : (
				<FlatList
					style={styles.list}
					data={files}
					keyExtractor={(item) => String(item.taskId)}
					renderItem={renderItem}
					contentContainerStyle={styles.listContent}
				/>
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: { flex: 1, backgroundColor: colors['bg92'] },
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		height: 54,
		paddingHorizontal: 12,
		backgroundColor: colors['bg97'],
		boxShadow: `0 3px 2px -2px ${colors['highlight']} inset, 0 20px 20px 0px rgba(0, 0, 0, 0.02), 0 6px 6px 0px rgba(0, 0, 0, 0.02)`,
	},
	btn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
	headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.textMain, paddingHorizontal: 6 },
	tabBar: {
		flexDirection: 'row',
		marginHorizontal: 12,
		marginTop: 10,
		marginBottom: 2,
		backgroundColor: colors['bg97'],
		borderRadius: 8,
		padding: 3,
		overflow: 'hidden',
	},
	tab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 6 },
	tabActive: { backgroundColor: colors.card },
	tabText: { fontSize: 14, color: colors.textSub },
	tabTextActive: { color: colors.textMain, fontWeight: '600' },
	list: { flex: 1 },
	listContent: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 24 },
	item: {
		backgroundColor: colors.card,
		borderRadius: 3,
		paddingHorizontal: 12,
		paddingVertical: 12,
		marginBottom: 10,
		boxShadow: `0 0 1px 2px ${colors['bg98']}, 0 2px 6px 0 rgba(0, 0, 0, 0.2)`,
	},
	itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	itemName: { flex: 1, fontSize: 15, color: colors.textMain },
	itemStatus: { fontSize: 12, color: colors.textSub },
	progressTrack: {
		height: 6,
		borderRadius: 3,
		backgroundColor: colors['bg93'],
		marginTop: 10,
		overflow: 'hidden',
	},
	progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
	itemMeta: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 6,
	},
	itemMetaText: {
		fontSize: 11,
		color: colors.textSub,
	},
	center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
	emptyText: { fontSize: 14, color: colors.textSub },
});
