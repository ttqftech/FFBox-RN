// 预设存取：移动端用 AsyncStorage 存储预设（对齐 FFBox 桌面端 electron-store 的 `presets.${name}` 键，
// 此处改为单个 `presets` 键存放「预设名 → OutputParams」映射）。
// 注：步骤 5 将在此之上实现完整的预设列表编辑页；本模块提供基础的增删查。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OutputParams } from './types';
import { defaultParams } from './defaultParams';

const PRESETS_KEY = 'presets';

/** 预设名 → OutputParams 映射 */
export type PresetMap = Record<string, OutputParams>;

/** 读取全部预设映射（不存在或解析失败时返回空对象） */
export async function loadPresetMap(): Promise<PresetMap> {
	try {
		const raw = await AsyncStorage.getItem(PRESETS_KEY);
		return raw ? (JSON.parse(raw) as PresetMap) : {};
	} catch {
		return {};
	}
}

/** 获取可用预设名称列表（不含内置「默认配置」） */
export async function getPresetList(): Promise<string[]> {
	const presets = await loadPresetMap();
	return Object.keys(presets);
}

/**
 * 按名称载入预设。
 * 「默认配置」为内置预设，返回 defaultParams 的深拷贝；其余从存储读取。
 */
export async function loadPreset(name: string): Promise<OutputParams | undefined> {
	if (name === '默认配置') {
		return JSON.parse(JSON.stringify(defaultParams));
	}
	const presets = await loadPresetMap();
	return presets[name];
}

/** 保存预设（深拷贝存储，避免引用共享导致后续修改互相污染） */
export async function savePreset(name: string, params: OutputParams): Promise<void> {
	const presets = await loadPresetMap();
	presets[name] = JSON.parse(JSON.stringify(params));
	await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

/** 删除预设 */
export async function deletePreset(name: string): Promise<void> {
	const presets = await loadPresetMap();
	delete presets[name];
	await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}
