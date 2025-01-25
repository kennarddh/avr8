module 'intel-hex' {
	export function parse(
		data: string | Buffer,
		bufferSize?: number,
		addressOffset?: number,
	): { data: Buffer; startSegmentAddress: number | null; startLinearAddress: number | null }
}
