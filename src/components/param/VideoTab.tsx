// 「视频」标签页：编码器 / 分辨率 / 帧率 / 码率控制 / 编码器细节参数。
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '@/common/theme';
import { OutputParams_video } from '@/common/types';
import { getMenuItemByValue } from '@/common/menu';
import { builtInVcodecs, resolution, framerate, VCodecDetail } from '@/common/params/vcodecs';
import { Dropdown, flattenMenu } from '@/components/param/ParamControls';
import RateControlEditor from '@/components/param/RateControl';
import { renderParams } from '@/components/param/renderParams';
import { ParamText, ParamPlaceholder } from '@/components/param/ParamControls';

// 前置的特殊选项（禁用=不输出视频 vn，copy=直接复制流）
const SPECIAL_VCODECS = [
	{ label: '自动', value: '自动' },
	{ label: '禁用（不输出视频）', value: '禁用' },
	{ label: 'copy（直接复制）', value: 'copy' },
];

export function getVideoCodecDetail(vcodec: string): VCodecDetail | undefined {
	if (vcodec === '自动' || vcodec === '禁用' || vcodec === 'copy') return undefined;
	const item = getMenuItemByValue(builtInVcodecs, vcodec) as any;
	return item?.extra as VCodecDetail;
}

export default function VideoTab(props: {
	video: OutputParams_video;
	patch: (path: string[], value: any) => void;
}) {
	const { video, patch } = props;
	const detail = getVideoCodecDetail(video.vcodec);

	const onCodecChange = (codec: string) => {
		patch(['vcodec'], codec);
		if (codec === '禁用' || codec === 'copy' || codec === '自动') {
			patch(['ratecontrol'], undefined);
			patch(['detail'], {});
			return;
		}
		const d = getVideoCodecDetail(codec);
		const firstRC = d?.rateControl.find((it) => it.type === 'normal') as any;
		const newDetail = firstRC ? { ...(firstRC.extra.defaultDetail as Record<string, any>) } : {};
		patch(['ratecontrol'], firstRC ? firstRC.value : undefined);
		patch(['detail'], newDetail);
	};

	const onDetailPatch = (name: string, value: any) => {
		if (value === undefined) {
			const next = { ...video.detail };
			delete next[name];
			patch(['detail'], next);
		} else {
			patch(['detail.' + name], value);
		}
	};

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<Dropdown label="视频编码器"
				value={video.vcodec}
				options={[...SPECIAL_VCODECS, ...builtInVcodecs]}
				onChange={onCodecChange} />

			{/* copy / 禁用 时无可编码细节，提示即可 */}
			{video.vcodec === '禁用' && <ParamPlaceholder label="视频输出" />}
			{video.vcodec === 'copy' && <ParamPlaceholder label="视频流将直接复制" />}
			{video.vcodec === '禁用' || video.vcodec === 'copy' ? null : (
				<>
					<Dropdown label="分辨率"
						value={video.resolution ?? '不改变'}
						options={flattenMenu(resolution)}
						onChange={(v) => patch(['resolution'], v)} />
					<Dropdown label="帧率"
						value={video.framerate ?? '不改变'}
						options={flattenMenu(framerate)}
						onChange={(v) => patch(['framerate'], v)} />

					{detail ? (
						<>
							<RateControlEditor
								rateControl={detail.rateControl}
								ratecontrol={video.ratecontrol ?? ''}
								detail={video.detail}
								onRateControlChange={(mode) => patch(['ratecontrol'], mode)}
								onDetailPatch={onDetailPatch} />
							{renderParams(detail.parameters, video.detail, onDetailPatch)}
						</>
					) : (
						<View style={styles.hintCard}>
							<Text style={styles.hint}>该编码器暂无可用细节参数</Text>
						</View>
					)}
				</>
			)}

			<ParamText label="自定义视频参数"
				value={video.custom ?? ''}
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