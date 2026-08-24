// 「输入」标签页：移动端无文件列表（文件列表永远是添加任务时的唯一文件），仅展示单文件参数。
// 参考 ParaBox InputView 中 InputFile 的 hwaccel / skipFrame / readrate / custom / demuxer。
import { ScrollView, StyleSheet } from 'react-native';
import { InputFile } from '@/common/types';
import { builtInDemuxers, hwaccels, skipFrame } from '@/common/params/formats';
import { Dropdown } from '@/components/param/ParamControls';
import { ParamText } from '@/components/param/ParamControls';

export default function InputTab(props: {
	file: InputFile | undefined;
	patch: (path: string[], value: any) => void;
}) {
	const { file, patch } = props;
	const f: InputFile = file ?? { filePath: '', demuxer: '自动' };

	const setField = (name: string, value: any) => {
		// 通用写法：直接写入 file 对象（path 由页面统一带上前缀 input.files.0）
		if (value === undefined || value === '') patch([name], undefined);
		else patch([name], value);
	};

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<Dropdown label="解复用器"
				value={f.demuxer ?? '自动'}
				options={builtInDemuxers}
				onChange={(v) => setField('demuxer', v)} />
			<Dropdown label="硬件解码"
				value={f.hwaccel ?? '不使用'}
				options={hwaccels}
				onChange={(v) => setField('hwaccel', v === '不使用' ? undefined : v)} />
			<Dropdown label="跳过帧"
				value={f.skipFrame ?? ''}
				options={skipFrame}
				onChange={(v) => setField('skipFrame', v || undefined)} />
			<ParamText label="读取速度"
				value={f.readrate ?? ''}
				onChange={(v) => setField('readrate', v)} />
			<ParamText label="自定义输入参数"
				value={f.custom ?? ''}
				onChange={(v) => setField('custom', v)} />
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	content: { padding: 12, paddingBottom: 40 },
});