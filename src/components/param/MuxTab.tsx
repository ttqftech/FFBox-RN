// 「封装」标签页：封装格式 / 快速启动 / 复用器细节参数。
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '@/common/theme';
import { OutputParams_mux } from '@/common/types';
import { getMenuItemByValue } from '@/common/menu';
import { builtInMuxers, Muxer } from '@/common/params/formats';
import { Dropdown, ParamSwitch } from '@/components/param/ParamControls';
import { renderParams } from '@/components/param/renderParams';
import { ParamText } from '@/components/param/ParamControls';

export function getMuxDetail(format: string): Muxer | undefined {
	if (!format || format === '无') return undefined;
	const item = getMenuItemByValue(builtInMuxers, format) as any;
	return item?.extra as Muxer;
}

export default function MuxTab(props: {
	mux: OutputParams_mux;
	patch: (path: string[], value: any) => void;
}) {
	const { mux, patch } = props;
	const detail = getMuxDetail(mux.format);

	const onDetailPatch = (name: string, value: any) => {
		if (value === undefined) {
			const next = { ...mux.detail };
			delete next[name];
			patch(['detail'], next);
		} else {
			patch(['detail.' + name], value);
		}
	};

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<Dropdown label="封装格式"
				value={mux.format}
				options={builtInMuxers}
				onChange={(format) => { patch(['format'], format); patch(['detail'], {}); }} />
			<ParamSwitch label="快速启动（+faststart）"
				value={mux.moveflags}
				onChange={(v) => patch(['moveflags'], v)} />

			{detail?.parameters?.length ? renderParams(detail.parameters, mux.detail, onDetailPatch) : (
				<View style={styles.hintCard}>
					<Text style={styles.hint}>该封装器暂无可用细节参数</Text>
				</View>
			)}

			<ParamText label="自定义封装参数"
				value={mux.custom ?? ''}
				onChange={(v) => patch(['custom'], v || undefined)} />
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	content: { padding: 12, paddingBottom: 40 },
	hintCard: { paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8, backgroundColor: colors.card, borderRadius: 3 },
	hint: { fontSize: 13, color: colors.textSub },
});