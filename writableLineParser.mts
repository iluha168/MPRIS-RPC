export default function writableLineParser(
	onNewLine: (line: string) => unknown,
) {
	let buffer = ''
	const TD = new TextDecoder()

	return new WritableStream(
		{
			write(bytes) {
				buffer += TD.decode(bytes)
				const lines = buffer.split('\n')
				buffer = lines.pop()!
				lines.filter((l) => l).forEach(onNewLine)
			},
		},
	)
}
