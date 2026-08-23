// 「选择预设」页（步骤 4 简化版）。
// 复用步骤 5 的预设列表（presetStorage），本步仅做「选中预设 → applyPresetToTasks → 跳转上传进度页」。
// 完整预设编辑（新建/重命名/删除、参数编辑器）在步骤 5 实现。
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSnapshot } from 'valtio';
import { appStore } from '@/stores/appStore';
import { loadPreset } from '@/common/presetStorage';
import { colors } from '@/common/theme';

export default function PresetScreen() {
	const router = useRouter();
	const snap = useSnapshot(appStore);
	const [applying, setApplying] = useState(false);

	// 进入页面时刷新预设列表
	useEffect(() => {
		appStore.loadPresetList();
	}, []);

	// 预设列表：内置「默认配置」置顶，其后为本地保存的预设
	const presets = ['默认配置', ...(snap.availablePresets ?? [])];
	const targetCount = snap.selectedTask?.size ?? 0;

	const leave = useCallback(() => {
		// 未选择预设直接返回：回到主界面并清除选中，避免停留在多选模式
		appStore.selectedTask = undefined;
		router.back();
	}, [router]);

	const handleSelect = useCallback(async (name: string) => {
		const params = await loadPreset(name);
		if (!params) {
			Alert.alert('提示', `预设「${name}」不存在或已损坏`);
			return;
		}
		const taskIds = snap.selectedTask ? [...snap.selectedTask] : [];
		if (!taskIds.length) {
			Alert.alert('提示', '当前没有选中的任务');
			return;
		}
		setApplying(true);
		try {
			await appStore.applyPresetToTasks(taskIds, params);
			appStore.pushMsg(`已应用预设「${name}」到 ${taskIds.length} 个任务`, 1 /* NotificationLevel.ok */);
		} catch (e: any) {
			console.warn('[PresetScreen] 应用预设失败', e);
			Alert.alert('应用失败', e?.message || '未知错误');
		} finally {
			setApplying(false);
		}
	}, [snap.selectedTask]);

	return (
		<SafeAreaView style={styles.safeArea}>
			<View style={styles.header}>
				<TouchableOpacity style={styles.btn} onPress={leave} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
					<Ionicons name="arrow-back" size={24} color={colors.textMain} />
				</TouchableOpacity>
				<Text style={styles.headerTitle} numberOfLines={1}>选择预设</Text>
				<View style={styles.btn} />
			</View>

			<View style={styles.hintRow}>
				<Text style={styles.hint}>将应用到 {targetCount} 个任务{targetCount ? '' : '（未选中任务）'}</Text>
			</View>

			<FlatList
				style={styles.list}
				data={presets}
				keyExtractor={(item) => item}
				renderItem={({ item }) => (
					<TouchableOpacity
						style={styles.item}
						disabled={applying}
						onPress={() => handleSelect(item)}
					>
						<Ionicons name="albums-outline" size={20} color={colors.primary} />
						<View style={styles.itemBody}>
							<Text style={styles.itemName} numberOfLines={1}>{item}</Text>
							<Text style={styles.itemDesc} numberOfLines={1}>
								{item === '默认配置' ? '内置预设' : '本地保存的预设'}
							</Text>
						</View>
						<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
					</TouchableOpacity>
				)}
				ListEmptyComponent={
					<View style={styles.empty}>
						<Text style={styles.emptyText}>暂无自定义预设（完整预设编辑在后续版本提供）</Text>
					</View>
				}
				contentContainerStyle={styles.listContent}
			/>
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
	hintRow: { paddingHorizontal: 16, paddingVertical: 10 },
	hint: { fontSize: 13, color: colors.textSub },
	list: { flex: 1 },
	listContent: { paddingHorizontal: 12, paddingBottom: 24 },
	item: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		backgroundColor: colors.card,
		borderRadius: 3,
		paddingHorizontal: 12,
		paddingVertical: 14,
		marginBottom: 10,
		boxShadow: `0 0 1px 2px ${colors['bg98']}, 0 2px 6px 0 rgba(0, 0, 0, 0.2)`,
	},
	itemBody: { flex: 1 },
	itemName: { fontSize: 16, color: colors.textMain },
	itemDesc: { fontSize: 12, color: colors.textSub, marginTop: 2 },
	empty: { alignItems: 'center', paddingVertical: 32 },
	emptyText: { fontSize: 13, color: colors.textSub },
});
