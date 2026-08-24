// 「预设」页，支持两种模式（通过路由 query `mode=manage` 区分）：
//   - 选择预设模式（默认）：点列表项 → 应用到选中的任务 → 返回
//   - 管理预设模式（预设管理入口）：点列表项也进入编辑；支持新建/编辑/删除
// 供两类场景复用：任务「选择预设」→ 选择模式；主界面「预设管理」→ 管理模式。
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSnapshot } from 'valtio';
import { appStore } from '@/stores/appStore';
import { loadPreset, deletePreset } from '@/common/presetStorage';
import { NotificationLevel } from '@/common/types';
import { colors } from '@/common/theme';

export default function PresetScreen() {
	const router = useRouter();
	const snap = useSnapshot(appStore);
	const params = useLocalSearchParams<{ mode?: string }>();
	const isManage = params.mode === 'manage';
	const [applying, setApplying] = useState(false);

	useEffect(() => {
		appStore.loadPresetList();
	}, []);

	const presets = ['默认配置', ...(snap.availablePresets ?? [])];
	const targetCount = snap.selectedTask?.size ?? 0;

	const renderRow = useCallback(({ item }: { item: string }) => {
		const isDefault = item === '默认配置';
		const handlePress = () => {
			if (isManage) {
				// 管理模式：进入编辑（默认配置作为新建底稿）
				router.push({ pathname: '/preset-edit', params: isDefault ? {} : { name: item } });
			} else {
				applyPreset(item);
			}
		};
		const handleDelete = () => {
			Alert.alert('删除预设', `确定删除预设「${item}」？`, [
				{ text: '取消', style: 'cancel' },
				{
					text: '删除', style: 'destructive', onPress: async () => {
						try {
							await deletePreset(item);
							await appStore.loadPresetList();
							appStore.pushMsg(`已删除预设「${item}」`, NotificationLevel.ok);
						} catch (e) {
							console.warn('[Preset] 删除失败', e);
						}
					},
				},
			]);
		};
		return (
			<View style={styles.item}>
				<TouchableOpacity style={styles.itemMain} disabled={applying} onPress={handlePress}>
					<Ionicons name={isDefault ? 'shield-checkmark-outline' : 'albums-outline'} size={20} color={colors.primary} />
					<View style={styles.itemBody}>
						<Text style={styles.itemName} numberOfLines={1}>{item}</Text>
						<Text style={styles.itemDesc} numberOfLines={1}>
							{isDefault ? '内置预设（只读，点编辑可另存新预设）' : (isManage ? '长按无操作，点右侧编辑/删除' : '点选应用到任务')}
						</Text>
					</View>
					<Ionicons name={isManage ? 'create-outline' : 'chevron-forward'} size={18} color={colors.textMuted} />
				</TouchableOpacity>
				{isManage && (
					<View style={styles.itemActions}>
						<TouchableOpacity style={styles.iconBtn} onPress={handlePress} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
							<Ionicons name="pencil" size={18} color={colors.primary} />
						</TouchableOpacity>
						{!isDefault && (
							<TouchableOpacity style={styles.iconBtn} onPress={handleDelete} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
								<Ionicons name="trash-outline" size={18} color={colors.red} />
							</TouchableOpacity>
						)}
					</View>
				)}
			</View>
		);
	}, [isManage, applying, snap.selectedTask, router]);

	return (
		<SafeAreaView style={styles.safeArea}>
			<View style={styles.header}>
				<TouchableOpacity style={styles.btn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
					<Ionicons name="arrow-back" size={24} color={colors.textMain} />
				</TouchableOpacity>
				<Text style={styles.headerTitle} numberOfLines={1}>{isManage ? '管理预设' : '选择预设'}</Text>
				{isManage ? (
					<TouchableOpacity style={styles.newBtn} onPress={() => router.push('/preset-edit')}>
						<Text style={styles.newBtnText}>新建</Text>
					</TouchableOpacity>
				) : <View style={styles.btn} />}
			</View>

			{!isManage && (
				<View style={styles.hintRow}>
					<Text style={styles.hint}>将应用到 {targetCount} 个任务{targetCount ? '' : '（未选中任务）'}</Text>
				</View>
			)}

			<FlatList
				style={styles.list}
				data={presets}
				keyExtractor={(item) => item}
				renderItem={renderRow}
				ListEmptyComponent={
					<View style={styles.empty}>
						<Text style={styles.emptyText}>暂无预设</Text>
					</View>
				}
				contentContainerStyle={styles.listContent}
			/>
		</SafeAreaView>
	);

	async function applyPreset(name: string) {
		const server = appStore.currentServer;
		if (!server && !snap.selectedTask) {
			Alert.alert('提示', '当前没有选中的任务');
			return;
		}
		const params_ = await loadPreset(name);
		if (!params_) {
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
			await appStore.applyPresetToTasks(taskIds, params_);
			appStore.pushMsg(`已应用预设「${name}」到 ${taskIds.length} 个任务`, NotificationLevel.ok);
			appStore.selectedTask = undefined;
			router.back();
		} catch (e: any) {
			console.warn('[Preset] 应用预设失败', e);
			Alert.alert('应用失败', e?.message || '未知错误');
		} finally {
			setApplying(false);
		}
	}
}

const styles = StyleSheet.create({
	safeArea: { flex: 1, backgroundColor: colors['bg92'] },
	header: {
		flexDirection: 'row', alignItems: 'center', height: 54, paddingHorizontal: 12,
		backgroundColor: colors['bg97'],
		boxShadow: `0 3px 2px -2px ${colors['highlight']} inset, 0 20px 20px 0px rgba(0,0,0,0.02), 0 6px 6px 0px rgba(0,0,0,0.02)`,
	},
	btn: { width: 40, height: 34, alignItems: 'center', justifyContent: 'center' },
	headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.textMain, paddingHorizontal: 6 },
	newBtn: { backgroundColor: colors.primary, borderRadius: 5, paddingHorizontal: 12, paddingVertical: 6 },
	newBtnText: { color: colors.ff, fontWeight: '600', fontSize: 14 },
	hintRow: { paddingHorizontal: 16, paddingVertical: 10 },
	hint: { fontSize: 13, color: colors.textSub },
	list: { flex: 1 },
	listContent: { paddingHorizontal: 12, paddingBottom: 24 },
	item: {
		flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 3,
		paddingHorizontal: 12, paddingVertical: 12, marginBottom: 10,
		boxShadow: `0 0 1px 2px ${colors['bg98']}, 0 2px 6px 0 rgba(0,0,0,0.2)`,
	},
	itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
	itemBody: { flex: 1 },
	itemName: { fontSize: 16, color: colors.textMain },
	itemDesc: { fontSize: 12, color: colors.textSub, marginTop: 2 },
	itemActions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
	iconBtn: { padding: 6 },
	empty: { alignItems: 'center', paddingVertical: 32 },
	emptyText: { fontSize: 13, color: colors.textSub },
});