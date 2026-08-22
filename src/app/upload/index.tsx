// 「上传进度」页：显示当前选中任务对应的上传文件实时进度（读取/哈希/上传）。
// 全部上传完成后自动跳转「选择预设」页；出错时提供手动继续入口。
import { useCallback, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSnapshot } from 'valtio';
import { appStore } from '@/stores/appStore';
import { UploadFile } from '@/types';
import { colors } from '@/common/theme';
import { formatSize } from '@/common/formatUtils';

// 上传状态 → 中文标签
const STATUS_LABEL: Record<UploadFile['status'], string> = {
	waiting: '等待中',
	reading: '读取中',
	hashing: '计算哈希',
	uploading: '上传中',
	paused: '已暂停',
	finished: '已完成',
	error: '出错',
};

export default function UploadScreen() {
	const router = useRouter();
	const snap = useSnapshot(appStore);
	const server = snap.currentServer;
	const selected = snap.selectedTask;

	// 只显示本次添加任务对应的上传文件（通过 selectedTask 关联）
	const files = useMemo(() => {
		return (server?.data.uploadFiles ?? []).filter((f) => selected?.has(f.taskId));
	}, [server?.data.uploadFiles, selected]);

	const allFinished = files.length > 0 && files.every((f) => f.status === 'finished');
	const hasError = files.some((f) => f.status === 'error');

	// 全部完成后自动进入「选择预设」页
	useEffect(() => {
		if (!allFinished) return;
		const timer = setTimeout(() => {
			router.replace('/preset');
		}, 500);
		return () => clearTimeout(timer);
	}, [allFinished, router]);

	const goPreset = useCallback(() => {
		router.replace('/preset');
	}, [router]);

	const goBack = useCallback(() => {
		appStore.selectedTask = undefined;
		router.back();
	}, [router]);

	const renderItem = ({ item }: { item: UploadFile }) => {
		const read = item.chunks.reduce((prev, curr) => prev + curr.size, 0);
		const hashed = item.chunks.reduce((prev, curr) => prev + (curr.hash ? curr.size : 0), 0);
		const uploaded = item.chunks.reduce((prev, curr) => prev + (curr.transferred ?? 0), 0);
		console.log(`上传进度 ${uploaded}`, item.chunks.map((c) => c.transferred));
		const overallProgress = (read * 0.1 + hashed * 0.1 + uploaded * 0.8) / (item.size ?? 0);
		return (
			<View style={styles.item}>
				<View style={styles.itemRow}>
					<Ionicons name="document-outline" size={18} color={colors.textSub} />
					<Text style={styles.itemName} numberOfLines={1}>{item.fileBaseName}</Text>
					{/* <Text style={styles.itemStatus}>{STATUS_LABEL[item.status]}</Text> */}
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

			{files.length === 0 ? (
				<View style={styles.center}>
					<Text style={styles.emptyText}>暂无可显示的上传任务</Text>
					<TouchableOpacity style={styles.primaryBtn} onPress={goPreset}>
						<Text style={styles.primaryBtnText}>去选择预设</Text>
					</TouchableOpacity>
				</View>
			) : (
				<FlatList
					style={styles.list}
					data={files as unknown as UploadFile[]}
					keyExtractor={(item) => String(item.taskId)}
					renderItem={renderItem}
					contentContainerStyle={styles.listContent}
					ListFooterComponent={
						<View style={styles.footer}>
							{allFinished ? (
								<>
									<Text style={styles.footerHint}>全部上传完成，正在前往选择预设…</Text>
									<TouchableOpacity style={styles.primaryBtn} onPress={goPreset}>
										<Text style={styles.primaryBtnText}>继续</Text>
									</TouchableOpacity>
								</>
							) : hasError ? (
								<>
									<Text style={[styles.footerHint, { color: colors.red }]}>部分文件上传出错，可重试或继续</Text>
									<TouchableOpacity style={styles.primaryBtn} onPress={goPreset}>
										<Text style={styles.primaryBtnText}>继续到预设</Text>
									</TouchableOpacity>
								</>
							) : (
								<Text style={styles.footerHint}>上传完成后将自动进入「选择预设」页</Text>
							)}
						</View>
					}
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
	list: { flex: 1 },
	listContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 24 },
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
	footer: { alignItems: 'center', paddingVertical: 12, gap: 12 },
	footerHint: { fontSize: 13, color: colors.textSub },
	primaryBtn: {
		height: 44,
		minWidth: 160,
		borderRadius: 10,
		backgroundColor: colors.primary,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 24,
	},
	primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
