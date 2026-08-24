// 「编辑预设」页（参考 FFBox ParaBox）。
// 关键差异：FFa0x 修改参数后点「保存」才写入预设，不影响现有任务；
// 点「返回」丢弃草稿。所有修改只作用于本地草稿 draftParams。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PagerView } from '@/components/param/PagerView';
import { useSnapshot } from 'valtio';
import { colors } from '@/common/theme';
import { OutputParams } from '@/common/types';
import { defaultParams } from '@/common/defaultParams';
import { loadPreset, savePreset } from '@/common/presetStorage';
import { getFFmpegParaArray } from '@/common/getFFmpegParaArray';
import { appStore } from '@/stores/appStore';
import { NotificationLevel } from '@/common/types';
import InputTab from '@/components/param/InputTab';
import VideoTab from '@/components/param/VideoTab';
import AudioTab from '@/components/param/AudioTab';
import MuxTab from '@/components/param/MuxTab';

const TABS = [
	{ key: 'input', label: '输入' },
	{ key: 'video', label: '视频' },
	{ key: 'audio', label: '音频' },
	{ key: 'mux', label: '封装' },
];

// 不可变更新：按路径写入（value 为 undefined 时删除该键）。路径元素可含 "."，会自动拆层。
function setAt<T>(obj: T, path: string[], value: any): T {
	const clone: any = JSON.parse(JSON.stringify(obj));
	const segs: string[] = [];
	for (const p of path) segs.push(...p.split('.'));
	const key = segs.pop()!;
	let cur = clone;
	for (const s of segs) cur = cur[s];
	if (value === undefined) delete cur[key];
	else cur[key] = value;
	return clone;
}

export default function PresetEditScreen() {
	const router = useRouter();
	const snap = useSnapshot(appStore);
	const params = useLocalSearchParams<{ name?: string }>();
	const originalName = (params.name && params.name !== '默认配置') ? params.name : '';

	const [draftName, setDraftName] = useState(originalName);
	const [draft, setDraft] = useState<OutputParams | undefined>(undefined);
	const [page, setPage] = useState(0);
	const pagerRef = useRef<PagerView>(null);
	const [saving, setSaving] = useState(false);

	// 载入：编辑已有预设 → loadPreset；新建 / 「默认配置」→ 以默认参数作底稿
	useEffect(() => {
		let cancelled = false;
		(async () => {
			const loaded = originalName
				? await loadPreset(originalName)
				: JSON.parse(JSON.stringify(defaultParams));
			if (!cancelled) setDraft(loaded || JSON.parse(JSON.stringify(defaultParams)));
		})();
		return () => { cancelled = true; };
	}, [originalName]);

	const patch = (prefix: string[]) => (path: string[], value: any) => {
		setDraft((d) => {
			if (!d) return d;
			const next = setAt(d, [...prefix, ...path], value);
			return next;
		});
	};
	const patchVideo = patch(['outputs', '0', 'video']);
	const patchAudio = patch(['outputs', '0', 'audio']);
	const patchMux = patch(['outputs', '0', 'mux']);
	const patchInput = patch(['input', 'files', '0']);

	// ffmpeg 参数预览
	const preview = useMemo(() => {
		if (!draft) return '';
		try {
			return getFFmpegParaArray({ outputParams: draft }).join(' ');
		} catch (e) {
			return '';
		}
	}, [draft]);

	const handleSave = async () => {
		const name = draftName.trim();
		if (!name) {
			Alert.alert('提示', '请先输入预设名称');
			return;
		}
		if (!draft) return;
		setSaving(true);
		try {
			await savePreset(name, draft);
			await appStore.loadPresetList();
			appStore.pushMsg(`已保存预设「${name}」`, NotificationLevel.ok);
			router.back();
		} catch (e: any) {
			console.warn('[PresetEdit] 保存失败', e);
			Alert.alert('保存失败', e?.message || '未知错误');
		} finally {
			setSaving(false);
		}
	};

	if (!draft) {
		return (
			<SafeAreaView style={styles.loadingWrap}>
				<ActivityIndicator size="large" color={colors.primary} />
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.safeArea}>
			{/* 标题栏 */}
			<View style={styles.header}>
				<Pressable style={styles.headerBtn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 4 }}>
					<Ionicons name="arrow-back" size={24} color={colors.textMain} />
				</Pressable>
				<Text style={styles.headerTitle} numberOfLines={1}>{originalName ? '编辑预设' : '新建预设'}</Text>
				<Pressable style={[styles.headerBtn, styles.saveBtn]} onPress={handleSave} disabled={saving}>
					{saving
						? <ActivityIndicator size="small" color={colors.ff} />
						: <Text style={styles.saveText}>保存</Text>}
				</Pressable>
			</View>

			{/* 预设名 + ffmpeg 预览 */}
			<View style={styles.topArea}>
				<View style={styles.nameRow}>
					<Text style={styles.nameLabel}>预设名</Text>
					<TextInput
						style={styles.nameInput}
						value={draftName}
						onChangeText={setDraftName}
						placeholder="输入预设名称"
						placeholderTextColor={colors.textMuted}
					/>
				</View>
				<View style={styles.previewCard}>
					<View style={styles.previewHeader}>
						<Ionicons name="terminal" size={14} color={colors.textSub} />
						<Text style={styles.previewTitle}>ffmpeg 参数预览</Text>
					</View>
					<ScrollView horizontal showsHorizontalScrollIndicator>
						<Text style={styles.previewText}>{preview || '（无法生成预览）'}</Text>
					</ScrollView>
				</View>
			</View>

			{/* 左右滑动标签页 */}
			<View style={styles.tabBar}>
				{TABS.map((tab, i) => (
					<Pressable key={tab.key} style={[styles.tabItem, i === page && styles.tabItemActive]}
						onPress={() => { setPage(i); pagerRef.current?.setPage(i); }}>
						<Text style={[styles.tabText, i === page && styles.tabTextActive]}>{tab.label}</Text>
					</Pressable>
				))}
			</View>

			<PagerView style={styles.pager} initialPage={0}
				onPageSelected={(e) => setPage(e.nativeEvent.position)} ref={pagerRef}>
				<View key="input" collapsable={false} style={styles.pagerPage}>
					<InputTab file={draft.input.files[0]} patch={patchInput} />
				</View>
				<View key="video" collapsable={false} style={styles.pagerPage}>
					<VideoTab video={draft.outputs[0]?.video ?? { vcodec: '自动', detail: {} }} patch={patchVideo} />
				</View>
				<View key="audio" collapsable={false} style={styles.pagerPage}>
					<AudioTab audio={draft.outputs[0]?.audio ?? { acodec: '自动', detail: {} }} patch={patchAudio} />
				</View>
				<View key="mux" collapsable={false} style={styles.pagerPage}>
					<MuxTab mux={draft.outputs[0]?.mux ?? { format: '', moveflags: false, filePath: '', detail: {} }} patch={patchMux} />
				</View>
			</PagerView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: { flex: 1, backgroundColor: colors['bg92'] },
	loadingWrap: { flex: 1, backgroundColor: colors['bg92'], alignItems: 'center', justifyContent: 'center' },
	header: {
		flexDirection: 'row', alignItems: 'center', height: 54, paddingHorizontal: 12,
		backgroundColor: colors['bg97'],
		boxShadow: `0 3px 2px -2px ${colors['highlight']} inset, 0 20px 20px 0px rgba(0,0,0,0.02), 0 6px 6px 0px rgba(0,0,0,0.02)`,
	},
	headerBtn: { width: 40, height: 34, alignItems: 'center', justifyContent: 'center' },
	saveBtn: { backgroundColor: colors.primary, borderRadius: 5, paddingHorizontal: 6 },
	saveText: { color: colors.ff, fontWeight: '600', fontSize: 14 },
	headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.textMain, paddingHorizontal: 6 },
	topArea: { paddingHorizontal: 12, paddingTop: 10 },
	nameRow: {
		flexDirection: 'row', alignItems: 'center', gap: 10,
		backgroundColor: colors.card, borderRadius: 3, paddingHorizontal: 12, paddingVertical: 8,
	},
	nameLabel: { fontSize: 14, color: colors.textMain },
	nameInput: { flex: 1, fontSize: 14, color: colors.textMain, paddingVertical: 4 },
	previewCard: { marginTop: 8, backgroundColor: colors.card, borderRadius: 3, padding: 10 },
	previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
	previewTitle: { fontSize: 12, color: colors.textSub },
	previewText: { fontSize: 11, color: colors.textSub, fontFamily: 'monospace' },
	tabBar: {
		flexDirection: 'row', marginTop: 10, backgroundColor: colors['bg95'],
		borderRadius: 3, marginHorizontal: 12, overflow: 'hidden',
	},
	tabItem: { flex: 1, alignItems: 'center', paddingVertical: 9 },
	tabItemActive: { backgroundColor: colors.primary },
	tabText: { fontSize: 14, color: colors.textSub },
	tabTextActive: { color: colors.ff, fontWeight: '600' },
	pager: { flex: 1, marginTop: 8 },
	pagerPage: { flex: 1 },
});