// 移植自 FFBox `src/renderer/src/logic/transferManager2.ts`，适配 React Native / Expo。
// 改动点（相对 FFBox）：
//   1. 去掉 vue `reactive` → 用 valtio `proxy`（配合 store 的响应式，UI 可实时看到上传进度）。
//   2. 分片读取：nodeBridge.getLocalFileChunk → expo-file-system `File` + `FileHandle.readBytes`（直接按 offset/length 读原始字节，无需 base64 中转）。
//   3. 分片哈希：Web Worker → 原生 `expo-crypto.digest`（对原始字节算 SHA1，与 FFBox 语义完全一致，跨端秒传/去重一致）。
//   4. 上传：XHR + FormData。注意 RN 的 Blob 不支持 ArrayBuffer/ArrayBufferView，因此分片先写入 {Paths.cache} 临时文件，
//      再通过 `FormData.append('file', { uri, name, type })` 让 RN 原生读取该文件上传（xhr.upload 仍可拿到上传进度）。
//   5. 并发池 SingleTaskScheduler 纯 JS 原样保留；移动端无 hardwareConcurrency，哈希并发取固定值 4。
import { EventEmitter } from 'events';
import { proxy, ref } from 'valtio';
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { Server, UploadChunk, UploadFile } from '../types';

const globalTaskPool: { [key: string]: Set<SingleTaskScheduler> } = {};	// 当前所有正在运行的任务的实例（某一实例无论有多少个同时执行，实例都只出现一次）
const globalTaskWorkingCount: { [key: string]: number } = {};
// let globalHashTask: any[] = [];	// 调试用

export class SingleTaskScheduler extends EventEmitter {
	public concurrency!: number;
	public taskName?: string;	// 指定 taskName 后，任务的 concurrency 计算将不仅限于单个 SingleTaskScheduler 实例，而是在全局共享同名的 concurrency
	public task!: (singleTaskscheduler: this) => Promise<any>;
	public extra?: any;
	public globalPool: Set<SingleTaskScheduler> | undefined;
	private _workingCount: number;
	private _working: boolean;
	private _count: number;		// 运行计数，第一次从 0 开始

	constructor(params: { concurrency: number, taskName: string, task: (singleTaskscheduler: SingleTaskScheduler) => Promise<any>, extra?: any }) {
		super();
		Object.assign(this, params);
		this._workingCount = 0;
		this._working = false;
		this._count = 0;
		if (params.taskName) {
			// 指定了 taskName 的话统一在此处检查修复存在性，后面就不需要判断了
			if (!globalTaskPool[params.taskName]) globalTaskPool[params.taskName] = new Set();
			if (!globalTaskWorkingCount[params.taskName]) globalTaskWorkingCount[params.taskName] = 0;
			this.globalPool = globalTaskPool[params.taskName];
		}
		// (window as any).globalTaskPool = globalTaskPool;
		// (window as any).globalTaskWorkingCount = globalTaskWorkingCount;
		// (window as any).globalHashTask = globalHashTask;
	}

	get workingCount() { return this._workingCount }
	get working() { return this._working }
	get count() { return this._count }
	get globalWorkingCount() { return this.taskName ? globalTaskWorkingCount[this.taskName] : undefined }

	public start() {
		this._working = true;
		if (this.taskName && this.globalPool) this.globalPool.add(this);	// 进入运行状态后才往全局池添加
		this.queueTask();
	}
	public stop() {
		this._working = false;
		if (this.taskName && this.globalPool) this.globalPool.delete(this);
	}

	private queueTask() {
		// 每次单个任务完成后，调用此函数
		if (this.taskName) {
			/**
			 * 有任务名的情况下，工作数按全局算。
			 * 循环从池中随机选择一个任务执行 doTask，直到达到最大工作数
			 * 当任务需要停止时，会从池中删除。当池中没有任何实例时，这一系列的任务就全部停止了
			 */
			if (!this.globalPool?.size) {
				return;
			}
			for (; this.globalWorkingCount! < this.concurrency; globalTaskWorkingCount[this.taskName]++) {
				const list = [...this.globalPool];
				// const randomIndex = Math.floor(Math.random() * list.length);
				// const selectedInstance = list[randomIndex];
				const selectedInstance = list[0];
				selectedInstance.doTask();
			}
		} else {
			/**
			 * 无任务名的情况下，只按自己的工作数算
			 * 循环 doTask，直到达到最大工作数
			 * 当任务需要停止时，设置 this._working = false，这里就不会再分配任务
			 */
			if (!this.working) {
				return;
			}
			for (; this._workingCount < this.concurrency;) {
				this.doTask();
			}
		}
	}

	public async doTask() {
		this._workingCount++;	// 只需管理自己的 _workingCount 即可。全局的 workingCount 由 queueTask 管理
		// console.log(this.taskName, this.extra, '开始工作，当前工作数', this._workingCount);
		setTimeout(() => {
			this.task(this).then(async () => {
				this._workingCount--;
				// await new Promise((r) => setTimeout(r, 100));
				if (this.taskName) globalTaskWorkingCount[this.taskName]--;

				if (!this.working && !this.workingCount) {
					this.emit('allDone');	// 已停止工作，且没有其他任务，即为全部完成
				}
				// console.log(this.taskName, this.extra, '工作完成，剩余工作数', this._workingCount);
				this.queueTask();
			}).catch(() => {
				// 任务失败即不再继续后续任务，剩余所有任务均执行 workingCount-- 后，最后一个完成的检查到 workingCount === 0 即停止
				this._working = false;
				this._workingCount--;
				if (this.taskName) {
					globalTaskWorkingCount[this.taskName]--;
					this.globalPool?.delete(this);
				}
				// console.log(this.taskName, this.extra, '停止工作，剩余工作数', this._workingCount);

				if (!this._workingCount) {
					this.emit('allDone');	// 已停止工作，且没有其他任务，即为全部完成
				}
				this.queueTask();
			});

			this._count++;	// 任务开始后计数 +1（一定会在 finally 前进行）
		}, 0);
	}
}

const memLimit = 100 * 1000 * 1000;	// 已读取未哈希的数据量达到此值时转锁等待哈希；大小小于该值的文件读取完毕后无需清除

/**
 * 按 offset/length 读取文件分片的原始字节（替代 expo-file-system/legacy 的 readAsStringAsync 按位读取）。
 * FileHandle.readBytes 为同步读取，且从当前 offset 递增；因上传阶段可能并发读取不同分片，
 * 故每次独立 open/close，避免共享 handle 的 offset 状态互相干扰。
 */
function readFileChunkBytes(fileUri: string, offset: number, length: number): Uint8Array<ArrayBuffer> {
	const handle = new File(fileUri).open();
	try {
		handle.offset = offset;
		return handle.readBytes(length);
	} finally {
		handle.close();
	}
}

/**
 * 添加一个上传任务。文件大小读出后将立刻返回
 * 完成上传后此函数将自动调用 mergeUploaded，需要传入在上传前生成的占位符 inputName
 */
export async function addUploadTask(server: Server, fileUri: string, taskId: number, fileBaseName: string, inputName: string) {
	const fileRef = new File(fileUri);
	const info = fileRef.info();
	const fileSize = info.exists && info.size ? info.size : 0;
	if (fileSize === 0) {
		throw new Error('无法获取文件大小，上传失败');
	}
	// 用 valtio proxy 包装，使后台逻辑对 file/chunks 的修改能被 store 响应式跟踪（UI 实时看到上传进度）
	const file: UploadFile = proxy({
		taskId,
		fileBaseName,
		chunks: [],
		url: fileUri,
		size: fileSize,
		status: 'waiting',
	});

	const segment = fileSize < 1 * 1000 * 1000 * 1000 ? 4 * 1000 * 1000 : 20 * 1000 * 1000;	// 小文件使用小分段，便于控制续传；大文件使用大分段，提高性能
	// 基础信息收集完成，返回 file，剩余校验和上传工作在 timeout 后进行
	setTimeout(async () => {
		server.entity.setUploadStatus(taskId, true);

		// 对每个分片进行文件读取，若读取错误则直接退出
		file.status = 'reading';
		const readDoneChunkIndexes: number[] = [];	// 供下一轮 hash 进行消费
		let readDone = 'false';
		let memUsed = 0;	// 也可通过遍历列表获得。但存起来就减少开销
		const ts1 = new SingleTaskScheduler({
			concurrency: 1,
			taskName: 'readFile',
			task: async (sts) => {
				// 利用 sts.count 可以方便地通过运行次序知道自己应该读取哪一块，但这个值要在函数开始时马上存下来，否则会变
				const taskIndex = sts.count;
				const offset = taskIndex * segment;
				const chunkSize = Math.min(segment, fileSize - offset);
				if (chunkSize <= 0) {
					throw '读取任务即将结束';
				}
				if (memUsed >= memLimit) {
					await new Promise((resolve) => setTimeout(resolve, 150));	// 等待哈希转锁
				}
				const chunk: UploadChunk = proxy({
					file,
					abortController: ref(new AbortController()),	// ref 告诉 Valtio 不要给它做代理，否则在上传阶段会报错 Expected 'this' to be an 'AbortController' object, but got object
					buffer: undefined,
					status: 'reading',
					tryCount: 0,
					transferred: 0,
					size: chunkSize,
					hash: undefined,
				});
				file.chunks[taskIndex] = chunk;
				chunk.buffer = readFileChunkBytes(fileUri, offset, chunkSize);
				chunk.status = 'hashing';	// 其实是等待 hashing
				readDoneChunkIndexes.push(taskIndex);
				// console.log(`分片 ${taskIndex} 读取完成，readDone: ${readDoneChunkIndexes}`);
				memUsed += chunk.size;
				// await new Promise(r => setTimeout(r, 1000));
			},
		});
		file.readTask = ts1;
		ts1.on('allDone', () => {
			if (file.chunks.length === Math.ceil(fileSize / segment) && file.chunks.every((chunk) => chunk.status === 'hashing')) {
				readDone = 'done';
				console.log(`【${file.fileBaseName}】读取全部完成`);
			} else {
				readDone = 'cancelled';
				console.log(`【${file.fileBaseName}】读取中止或失败`);
			}
		});
		ts1.start();

		file.status = 'hashing';
		// 移动端无 hardwareConcurrency，哈希并发取固定值 4
		const cpuCount = 4;
		const hashDoneChunkIndexes: number[] = [];	// 供下一轮 upload 进行消费

		// 计算分片原始字节的 SHA1，返回 hex 字符串（替代 nodeBridge 的 Web Worker 哈希）
		async function hashChunkBytes(buffer: Uint8Array<ArrayBuffer>): Promise<string> {
			// 将字节数组转成 hex 字符串（分片 hash 需要用 hex 表示，与 FFBox 的 CryptoJS().toString() 一致）
			function bytesToHex(bytes: Uint8Array): string {
				let hex = '';
				for (let i = 0; i < bytes.length; i++) {
					hex += bytes[i].toString(16).padStart(2, '0');
				}
				return hex;
			}
			const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA1, buffer);
			return bytesToHex(new Uint8Array(digest));
		}

		const ts2 = new SingleTaskScheduler({
			concurrency: cpuCount,
			taskName: 'hashFile',
			extra: file,
			task: async (sts) => {
				if (readDone === 'cancelled') {
					throw '哈希计算即将中止';
				}
				if (!readDoneChunkIndexes.length) {
					if (readDone === 'done') {
						throw '哈希计算即将结束';
					} else {
						await new Promise((resolve) => setTimeout(resolve, 1500));	// read 步骤还没读完，转锁
						return;
					}
				}

				const notHashedIndex = readDoneChunkIndexes.shift();
				if (notHashedIndex !== undefined && notHashedIndex >= 0) {
					const chunk = file.chunks[notHashedIndex];
					chunk.hash = await hashChunkBytes(chunk.buffer!);
					if (file.size! <= memLimit) {
						// 在 memLimit 之内的文件不需要清除缓存重新读取
					} else {
						// 否则不要缓存，等下面上传前再读取
						chunk.buffer = undefined;
						memUsed -= chunk.size;
					}
					hashDoneChunkIndexes.push(notHashedIndex);
					// console.log(`分片 ${notHashedIndex} 哈希完成，readDone: ${readDoneChunkIndexes} hashDone: ${hashDoneChunkIndexes}`);
				} else {
					await new Promise((resolve) => setTimeout(resolve, 1500));	// read 步骤还没读完，转锁
				}
			},
		});
		file.hashTask = ts2;
		ts2.start();
		// 等待所有 hash 完成
		await new Promise((resolve, reject) => {
			ts2.on('allDone', () => {
				if (readDone !== 'cancelled') {
					console.log(`【${file.fileBaseName}】哈希全部完成`);
					resolve(0);
				} else {
					console.log(`【${file.fileBaseName}】上传中止`);
					file.status = 'error';
					reject(0);
				}
			});
		});

		// 获取到所有分片后，拼接 hash 并检查
		const concatedHash = file.chunks.map(c => c.hash).join('');
		const fileHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, concatedHash);
		const response = await fetch(`http://${server.entity.ip}:${server.entity.port}/api/v1/upload/check/`, {
			method: 'post',
			body: JSON.stringify({
				hashs: [`${fileBaseName}⬝${fileHash}`],	// 与服务器 mergeUploaded 的文件名逻辑保持相同
			}),
			headers: new Headers({
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${server.entity.sessionId}`,
			}),
		});
		const responseText = await response.text();
		let content = JSON.parse(responseText) as number[];
		if (content[0]) {
			console.log(fileBaseName, '已缓存');
			server.entity.mergeUploaded(taskId, file.chunks.map((chunk) => chunk.hash!).filter(Boolean), fileBaseName, inputName).then(() => {
				// 每个任务只对应一个文件，上传完成直接置回未上传状态
				server.entity.setUploadStatus(taskId, false);
			});
			for (const chunk of file.chunks) {
				chunk.buffer = undefined;		// 释放内存
				chunk.transferred = chunk.size;	// 显示上呈现完成状态
			}
			file.status = 'finished';
			file.readTask = undefined;
			file.hashTask = undefined;
			file.uploadTask = undefined;
		} else {
			console.log(fileBaseName, '未缓存');
			// 若未缓存则检查分片缓存状态对各个分片进行上传。若出错则重试
			const response = await fetch(`http://${server.entity.ip}:${server.entity.port}/api/v1/upload/check/`, {
				method: 'post',
				body: JSON.stringify({
					hashs: file.chunks.map((chunk) => chunk.hash),
				}),
				headers: new Headers({
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${server.entity.sessionId}`,
				}),
			});
			const responseText = await response.text();
			const isCachedList = JSON.parse(responseText) as number[];

			const ts3 = new SingleTaskScheduler({
				concurrency: 2,
				taskName: 'uploadFile',
				task: async (sts) => {
					const chunkIndex = sts.count;
					if (chunkIndex >= file.chunks.length) {
						throw '上传任务即将结束';
					}
					const chunk = file.chunks[chunkIndex];
					if (isCachedList[chunkIndex]) {
						// 分片已缓存，直接标记为已完成，跳过上传
						chunk.status = 'finished';
						chunk.transferred = chunk.size;
						chunk.buffer = undefined;
						return;
					}

					const offset = chunkIndex * segment;
					const chunkSize = Math.min(segment, fileSize - offset);
					if (file.size! > memLimit) {
						// chunk.buffer 已在前一步骤被清除，需要重新读取文件
						chunk.buffer = readFileChunkBytes(fileUri, offset, chunkSize);
					}

					let tryCount = 0;
					while (tryCount++ < 3) {
						chunk.status = 'uploading';
						chunk.transferred = 0;
						try {
							await new Promise((resolve, reject) => {
								// 将分片原始字节写入缓存目录临时文件（RN 的 Blob 不支持 ArrayBuffer/ArrayBufferView，
								// 因此先用 File 落盘，再以 { uri, name, type } 交给 FormData，由 RN 原生读取上传，xhr.upload 进度仍可用）
								const tmp = new File(Paths.cache, `upload_${chunk.hash}`);
								if (tmp.exists) tmp.delete();	// 重试时保证覆盖，避免残留旧内容
								tmp.write(chunk.buffer!);
								const form = new FormData();
								form.append('name', chunk.hash!);
								form.append('file', { uri: tmp.uri, name: chunk.hash!, type: 'application/octet-stream' } as any);
								const xhr = new XMLHttpRequest();
								const abortFunc = () => xhr.abort();
								chunk.abortController.signal.addEventListener('abort', abortFunc);
								xhr.upload.addEventListener('progress', (event) => {
									// let progress = event.loaded / event.total;
									// const transferred = task.transferProgressLog.transferred;
									// transferred.push([new Date().getTime() / 1000 - lastStarted, event.loaded]);
									chunk.transferred = event.loaded;
									// console.log('已上传', event.loaded, event.total);
								}, false);
								xhr.onreadystatechange = () => {
									if (xhr.readyState !== 0) {
										if (xhr.status >= 400 && xhr.status < 500) {
											reject('网络请求故障');
										} else if (xhr.status >= 500 && xhr.status < 600) {
											reject('服务器故障');
										}
									}
								};
								const cleanup = () => {
									if (tmp.exists) tmp.delete();	// 上传结束清理临时文件
								};
								xhr.onload = async () => {
									cleanup();
									console.log(`【${chunk.file!.fileBaseName}】【${chunkIndex}】【${chunk.hash}】发送完成`);
									chunk.buffer = undefined; // 释放内存
									chunk.abortController.signal.removeEventListener('abort', abortFunc);
									// await new Promise(() => setTimeout(resolve, 1000));
									resolve(0);
								};
								xhr.onerror = () => {
									cleanup();
									chunk.abortController.signal.removeEventListener('abort', abortFunc);
									reject(new Error('network error'));
								};
								xhr.onabort = () => {
									cleanup();
									chunk.abortController.signal.removeEventListener('abort', abortFunc);
									reject(new Error('paused'));
								};
								xhr.open('post', `http://${server.entity.ip}:${server.entity.port}/api/v1/upload/file/`, true);
								xhr.setRequestHeader('Authorization', `Bearer ${server.entity.sessionId}`);
								xhr.send(form);
							});
							chunk.status = 'finished';
							chunk.transferred = chunk.size;
							break;	// 离开重试循环
						} catch (e: any) {
							if (e?.message === 'paused') {
								chunk.status = 'paused';
								file.status = 'paused';
								console.log(`【${chunk.file!.fileBaseName}】【${chunkIndex}】【${chunk.hash}】上传暂停`);
								throw `【${chunk.file!.fileBaseName}】【${chunkIndex}】【${chunk.hash}】${e.message}，上传暂停`;
							} else {
								chunk.status = 'error';
								file.status = 'error';
								console.log(`【${chunk.file!.fileBaseName}】【${chunkIndex}】【${chunk.hash}】上传失败`);
								throw `【${chunk.file!.fileBaseName}】【${chunkIndex}】【${chunk.hash}】${e.message}，上传失败`;
							}
						}
					}
					if (chunk.status !== 'finished') {
						file.status = 'error';
						throw `【${chunk.file!.fileBaseName}】【${chunkIndex}】【${chunk.hash}】分片上传失败，放弃上传`;
					}
				},
			});
			ts3.on('allDone', () => {
				if (file.chunks.every((chunk) => chunk.status === 'finished')) {
					// 全部上传完成
					console.log(`【${file.fileBaseName}】文件上传完成`);
					file.status = 'finished';
					server.entity.mergeUploaded(file.taskId, file.chunks.map((chunk) => chunk.hash!).filter(Boolean), file.fileBaseName, inputName).then(() => {
						server.entity.setUploadStatus(taskId, false);
					});
					file.status = 'finished';
					file.readTask = undefined;
					file.hashTask = undefined;
					file.uploadTask = undefined;
				} else {
					console.log(`【${file.fileBaseName}】文件上传中止或失败`);
					file.status = 'error';
					file.readTask = undefined;
					file.hashTask = undefined;
					file.uploadTask = undefined;
				}
			});
			ts3.start();
		}
	}, 0);
	return file;
}

export function pauseUploadTask(file: UploadFile) {

}
