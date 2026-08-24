// 移植自 FFBox `src/common/getFFmpegParaArray.ts`。
// 关键差异：移动端不实现滤镜图（filter 恒为空）与多输出文件循环，仅保留单输入单输出的核心逻辑。
// getInputFFmpegParam / getVideoFFmpegParam / getAudioFFmpegParam / getMuxFFmpegParam 等核心逻辑依赖的
// builtInVcodecs/Acodecs/Muxers 与 RateControl 结构均已移植到 src/common/params/*。
import path from './path';
import { getInputFFmpegParam, builtInMuxers, allMuxers, getMuxFFmpegParam } from './params/formats';
import { getVideoFFmpegParam } from './params/vcodecs';
import { getAudioFFmpegParam } from './params/acodecs';
import { applyFilePathReplace } from './params/fileReplace';
import { getMenuItemByValue } from './menu';
import { OutputParams } from '@/common/types';

const { trimExt, dirname, basename } = path;

/**
 * 获取命令行参数
 * 如果不提供 outputFileName 或 outputDir，则自动从 outputParams.input.files[0].filePath 中提取
 * 移动端无多输出/滤镜，filter 恒为空；未实现的多输出与滤镜分支保留为注释（见下方 filter 相关说明）。
 */
export function getFFmpegParaArray(params: { outputParams: OutputParams, withQuotes?: boolean, inputDir?: string, outputFileName?: string, outputDir?: string, overrideFilePaths?: string[], taskId?: number, taskIndex?: number, runIndex?: number }) {
	const ret: Array<string> = [];
	const { outputParams, withQuotes, inputDir, outputFileName, outputDir, overrideFilePaths, taskId, taskIndex, runIndex } = params;

	// 以第一个输入文件定目录与输出文件名（此处仅用于预览占位，实际输出路径在任务运行时生成）
	const inputFilePath = outputParams.input.files[0]?.filePath;
	const resolvedFileName = outputFileName || trimExt(basename(inputFilePath || '[输出文件名]'));
	// 当存在 overrideFilePaths 时，输出文件名/目录由其完全接管，此处仅取 dirname 用于其它占位（如无文件列表则为空）
	const resolvedOutputDir = (overrideFilePaths?.[0] ? dirname(overrideFilePaths[0]) : undefined) || outputDir || dirname(inputFilePath || '[输出目录]');

	ret.push('-hide_banner');
	ret.push(...getInputFFmpegParam(outputParams.input, withQuotes, inputDir));

	// 移动端不实现滤镜图：filter 恒为空（nodes/lines 均为空数组），因此跳过 associateNodesAndLines / getFilterParam，
	// 不会产生 -filter_complex 与 -map（输出节点 out_\d+ 不存在）。
	//
	// FFBox 原文（多输出 + 滤镜图分支，移动端保留注释）：
	// if (!outputParams.filter?.nodes || !outputParams.filter?.lines) outputParams.filter = { nodes: [], lines: [] };
	// associateNodesAndLines(outputParams.filter.nodes, outputParams.filter.lines);
	// const filterStr = getFilterParam(outputParams.filter.nodes, outputParams.filter.lines);
	// if (filterStr) {
	// 	ret.push('-filter_complex', withQuotes ? `"${filterStr}"` : filterStr);
	// }
	// const outputNodes = outputParams.filter.nodes.filter((node) => node.name.match(/^out_\d+$/));
	// if (outputNodes.length) {
	// 	for (let outputIndex = 0; outputIndex < outputNodes.length; outputIndex++) {
	// 		const outputNode = outputNodes[outputIndex];
	// 		for (let outputNodeIndex = 0; outputNodeIndex < outputNode.prevs!.length; outputNodeIndex++) {
	// 			const line = outputNode.prevs![outputNodeIndex];
	// 			if (line) {
	// 				ret.push('-map');
	// 				ret.push(line.name.match(/^\d+(:[vasdt])?(:\d+)?$/) ? line.name : `[${line.name}]`);
	// 			}
	// 		}
	// 		if (outputNode.prevs?.length) {
	// 			ret.push(...getVideoFFmpegParam(outputParams.outputs[outputIndex].video));
	// 			ret.push(...getAudioFFmpegParam(outputParams.outputs[outputIndex].audio));
	// 			ret.push(...getMuxFFmpegParam(outputParams.outputs[outputIndex].mux, resolvedOutputDir, resolvedFileName, withQuotes, overrideFilePaths?.[outputIndex], { taskId, taskIndex, runIndex, outputIndex }));
	// 		}
	// 	}
	// } else {
	if (!outputParams.outputs.length) {
		// 默认情况下数量最低为 1，不允许再删除。但如果后面代码真允许删除，那参数就到此为止了
		return ret;
	}
	// 单输入单输出（移动端）
	ret.push(...getVideoFFmpegParam(outputParams.outputs[0].video));
	ret.push(...getAudioFFmpegParam(outputParams.outputs[0].audio));
	ret.push(...getMuxFFmpegParam(outputParams.outputs[0].mux, resolvedOutputDir, resolvedFileName, withQuotes, overrideFilePaths?.[0], { taskId, taskIndex, runIndex, outputIndex: 0 }));
	// }  ← 对应上方注释的 else 结束
	ret.push('-y');
	return ret;
}

/**
 * 对于本地文件，直接按配置返回 task.outputFiles。
 * 移动端主要用于预览/占位：输入文件路径未知时以占位符给出。
 */
export function genTaskOutputFiles(outputParams: OutputParams, remoteDownloadDir?: string, context?: { taskId?: number; taskIndex?: number; runIndex?: number }): string[] {
	// 本地任务：取第一个输入文件路径作为输出 basename（若没有输入文件则使用占位符）
	const inputFilePath = outputParams.input.files[0]?.filePath || '[输出文件名]';
	const localOutputDir = trimExt(dirname(inputFilePath || '[输出目录]'));
	const localOutputFileName = basename(inputFilePath);

	return outputParams.outputs.map((output, outputIndex) => {
		let extension = '';

		if (output.mux.format?.length && output.mux.format !== '无') {
			let formatItem = getMenuItemByValue(builtInMuxers, output.mux.format) as any;
			if (!formatItem) {
				formatItem = getMenuItemByValue(allMuxers, output.mux.format) as any;
			}
			extension = formatItem ? (formatItem.value as string).match(/(.+) \(.+\)/)?.[1] || formatItem.value : output.mux.format;
		}

		if (remoteDownloadDir !== undefined) {
			// 联机任务：直接拼路径和固定占位名（移动端不在此展开，此处保留注释）
			const randomBase = `${Date.now()}`;
			const filename = extension ? `${randomBase}_out.${extension}` : randomBase;
			return `${remoteDownloadDir ? remoteDownloadDir + '/' : ''}${filename}`;
		} else {
			return applyFilePathReplace(output.mux.filePath, {
				fileDir: localOutputDir,
				fileName: localOutputFileName,
				fileExt: extension,
				taskId: context?.taskId,
				taskIndex: context?.taskIndex,
				runIndex: context?.runIndex,
				outputIndex,
			});
		}
	});
}