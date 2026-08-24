// 「音频」标签页：编码器 / 码率控制 / 编码器细节参数。
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '@/common/theme';
import { OutputParams_audio } from '@/common/types';
import { getMenuItemByValue } from '@/common/menu';
import { builtInAcodecs, ACodecDetail } from '@/common/params/acodecs';
import { Dropdown } from '@/components/param/ParamControls';
import RateControlEditor from '@/components/param/RateControl';
import { renderParams } from '@/components/param/renderParams';
import { ParamText, ParamPlaceholder } from '@/components/param/ParamControls';

const SPECIAL_ACODECS = [
	{ label: '自动', value: '自动' },
	{ label: '禁用（不输出音频）', value: '禁用' },
	{ label: 'copy（直接复制）', value: 'copy' },
];

export function getAudioCodecDetail(acodec: string): ACodecDetail | undefined {
	if (acodec === '自动' || acodec === '禁用' || acodec === 'copy') return undefined;
	const item = getMenuItemByValue(builtInAcodecs, acodec) as any;
	return item?.extra as ACodecDetail;
}

export default function AudioTab(props: {
	audio: OutputParams_audio;
	patch: (path: string[], value: any) => void;
}) {
	const { audio, patch } = props;
	const detail = getAudioCodecDetail(audio.acodec);

	const onCodecChange = (codec: string) => {
		patch(['acodec'], codec);
		if (codec === '禁用' || codec === 'copy' || codec === '自动') {
			patch(['ratecontrol'], undefined);
			patch(['detail'], {});
			return;
		}
		const d = getAudioCodecDetail(codec);
		const firstRC = d?.rateControl.find((it) => it.type === 'normal') as any;
		const newDetail = firstRC ? { ...(firstRC.extra.defaultDetail as Record<string, any>) } : {};
		patch(['ratecontrol'], firstRC ? firstRC.value : undefined);
		patch(['detail'], newDetail);
	};

	const onDetailPatch = (name: string, value: any) => {
		if (value === undefined) {
			const next = { ...audio.detail };
			delete next[name];
			patch(['detail'], next);
		} else {
			patch(['detail.' + name], value);
		}
	};

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<Dropdown label="音频编码器"
				value={audio.acodec}
				options={[...SPECIAL_ACODECS, ...builtInAcodecs]}
				onChange={onCodecChange} />

			{audio.acodec === '禁用' && <ParamPlaceholder label="音频输出" />}
			{audio.acodec === 'copy' && <ParamPlaceholder label="音频流将直接复制" />}
			{audio.acodec === '禁用' || audio.acodec === 'copy' ? null : (
				detail ? (
					<>
						<RateControlEditor
							rateControl={detail.rateControl}
							ratecontrol={audio.ratecontrol ?? ''}
							detail={audio.detail}
							onRateControlChange={(mode) => patch(['ratecontrol'], mode)}
							onDetailPatch={onDetailPatch} />
						{renderParams(detail.parameters, audio.detail, onDetailPatch)}
					</>
				) : (
					<View style={styles.hintCard}>
						<Text style={styles.hint}>该编码器暂无可用细节参数</Text>
					</View>
				)
			)}

			<ParamText label="自定义音频参数"
				value={audio.custom ?? ''}
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