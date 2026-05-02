declare const require: undefined | ((id: string) => unknown);

export async function readTextFileFromZip(
	zipData: ArrayBuffer,
	preferredFileName: string,
): Promise<string> {
	const bytes = new Uint8Array(zipData);
	const entries = readCentralDirectory(bytes);
	const preferred = entries.find((entry) => entry.name.endsWith(preferredFileName));
	const fallback = entries.find((entry) => entry.name.toLowerCase().endsWith(".md"));
	const entry = preferred ?? fallback;

	if (!entry) {
		throw new Error(`Zip result did not include ${preferredFileName}.`);
	}

	const fileBytes = await readEntryBytes(bytes, entry);
	return new TextDecoder("utf-8").decode(fileBytes);
}

interface ZipEntry {
	name: string;
	method: number;
	compressedSize: number;
	uncompressedSize: number;
	localHeaderOffset: number;
}

function readCentralDirectory(bytes: Uint8Array): ZipEntry[] {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const endOffset = findEndOfCentralDirectory(view);
	const entryCount = view.getUint16(endOffset + 10, true);
	let offset = view.getUint32(endOffset + 16, true);
	const entries: ZipEntry[] = [];

	for (let index = 0; index < entryCount; index += 1) {
		const signature = view.getUint32(offset, true);
		if (signature !== 0x02014b50) {
			throw new Error("Invalid zip central directory.");
		}

		const method = view.getUint16(offset + 10, true);
		const compressedSize = view.getUint32(offset + 20, true);
		const uncompressedSize = view.getUint32(offset + 24, true);
		const fileNameLength = view.getUint16(offset + 28, true);
		const extraLength = view.getUint16(offset + 30, true);
		const commentLength = view.getUint16(offset + 32, true);
		const localHeaderOffset = view.getUint32(offset + 42, true);
		const nameStart = offset + 46;
		const name = new TextDecoder("utf-8").decode(bytes.slice(nameStart, nameStart + fileNameLength));

		entries.push({
			name,
			method,
			compressedSize,
			uncompressedSize,
			localHeaderOffset,
		});

		offset = nameStart + fileNameLength + extraLength + commentLength;
	}

	return entries;
}

function findEndOfCentralDirectory(view: DataView): number {
	const minOffset = Math.max(0, view.byteLength - 65557);
	for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
		if (view.getUint32(offset, true) === 0x06054b50) {
			return offset;
		}
	}

	throw new Error("Invalid zip file.");
}

async function readEntryBytes(zipBytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
	const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
	const offset = entry.localHeaderOffset;
	const signature = view.getUint32(offset, true);
	if (signature !== 0x04034b50) {
		throw new Error("Invalid zip local file header.");
	}

	const fileNameLength = view.getUint16(offset + 26, true);
	const extraLength = view.getUint16(offset + 28, true);
	const dataStart = offset + 30 + fileNameLength + extraLength;
	const compressed = zipBytes.slice(dataStart, dataStart + entry.compressedSize);

	if (entry.method === 0) {
		return compressed;
	}

	if (entry.method !== 8) {
		throw new Error(`Unsupported zip compression method: ${entry.method}.`);
	}

	const decompressed = await inflateRaw(compressed);
	if (entry.uncompressedSize > 0 && decompressed.byteLength !== entry.uncompressedSize) {
		return decompressed.slice(0, entry.uncompressedSize);
	}

	return decompressed;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
	const nodeInflated = inflateRawWithNodeZlib(bytes);
	if (nodeInflated) {
		return nodeInflated;
	}

	const DecompressionStreamCtor = (globalThis as unknown as {
		DecompressionStream?: new (format: string) => {
			writable: WritableStream<Uint8Array>;
			readable: ReadableStream<Uint8Array>;
		};
	}).DecompressionStream;

	if (!DecompressionStreamCtor) {
		throw new Error("当前 Obsidian 运行环境无法解压 MinerU 结果压缩包。");
	}

	const stream = new DecompressionStreamCtor("deflate-raw");
	const writer = stream.writable.getWriter();
	await writer.write(bytes);
	await writer.close();

	const response = new Response(stream.readable);
	return new Uint8Array(await response.arrayBuffer());
}

function inflateRawWithNodeZlib(bytes: Uint8Array): Uint8Array | null {
	if (typeof require !== "function") {
		return null;
	}

	const zlib = require("zlib") as {
		inflateRawSync?: (data: Uint8Array) => Uint8Array;
	};
	const inflateRawSync = zlib.inflateRawSync;
	if (!inflateRawSync) {
		return null;
	}

	const inflated = inflateRawSync(bytes);
	return inflated.slice();
}
