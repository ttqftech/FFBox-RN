// 移植自 FFBox `src/common/limitaions.ts` + `renderer/.../limitations.ts`。
// 移除了对 Pinia store 的依赖：这里直接传入 functionLevel。

export type LimitationType = 'maxMediaDuration' | 'maxWorkingDuration' | 'maxUploadSizeGB' | 'maxTaskListCount' | 'maxThreads' | 'maxUploadListCount' | 'maxFilterNodeCount';

export const limitations: { type: LimitationType; pairs: [number, number | undefined][] }[] = [
	{ type: 'maxMediaDuration', pairs: [
		[0, 671],
		[50, undefined],
	]},
	{ type: 'maxWorkingDuration', pairs: [
		[0, 671],
		[45, 40271],
	]},
	{ type: 'maxUploadSizeGB', pairs: [
		[0, 1],
		[15, 4],
		[30, 10],
		[45, 32],
		[65, 1024],
	]},
	{ type: 'maxTaskListCount', pairs: [
		[0, 20],
		[20, 99],
		[35, 256],
		[50, 2048],
		[65, 66666],
		[80, 11111111],
	]},
	{ type: 'maxThreads', pairs: [
		[0, 1],
		[10, 4],
		[25, 9],
		[40, 99],
		[70, 256],
	]},
	{ type: 'maxUploadListCount', pairs: [
		[0, 20],
		[25, 66],
		[55, 256],
		[75, 999],
	]},
	{ type: 'maxFilterNodeCount', pairs: [
		[0, 20],
		[20, 66],
		[40, 99],
		[60, 999],
	]},
];

/**
 * 根据 functionLevel 取某项限制的当前值。
 * 在 pairs 中找到最后一个阈值 <= functionLevel 的项并返回其值。
 */
export function getLimitation(type: LimitationType, functionLevel: number): number | undefined {
	const entry = limitations.find((e) => e.type === type);
	if (!entry || entry.pairs.length === 0) return undefined;
	let result = entry.pairs[0][1];
	for (const [threshold, value] of entry.pairs) {
		if (functionLevel >= threshold) {
			result = value;
		} else {
			break;
		}
	}
	return result;
}
