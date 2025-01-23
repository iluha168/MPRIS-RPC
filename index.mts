import z from 'zod'
import { Client as RPC } from 'https://deno.land/x/discord_rpc@0.3.2/mod.ts'
import { debounce } from '@std/async/debounce'

import * as Assets from './PresenseAssetsStore.mts'
import writableLineParser from './writableLineParser.mts'
import { env } from './env.mts'

const zStatus = z.union([
	z.literal('Playing'),
	z.literal('Paused'),
	z.literal('Stopped'),
])

const zPosition = z.coerce.number(z.string()).transform((n) =>
	Math.floor(n * 1e3)
)

const zMeta = z.object({
	artUrl: z.string().optional().transform((f) =>
		f ? f.match(/^file:\/\/(.+)$/)?.[1] : f
	),
	length: z.string().optional().transform(
		(v) => v ? Math.floor(Number(v) / 1e3) : undefined,
	),
	trackid: z.string().optional(),
	album: z.string().optional(),
	artist: z.string().optional(),
	title: z.string().optional(),
	status: zStatus.optional(),
	position: zPosition.optional(),
})

const meta = zMeta.parse({})

const rpc = new RPC({ id: env.DISCORD_APP_ID })
await rpc.connect()

console.log('[RPC] Logged in with', rpc.userTag)

const removeActivity = debounce(() => {
	rpc.clearActivity()
}, 10000)

const markMetaDirty = debounce(async () => {
	const albumAssetID = meta.artUrl
		? await Assets.upload(meta.artUrl)
		: undefined

	if (albumAssetID === null) {
		return removeActivity()
	}
	const t = Date.now()

	await rpc.setActivity({
		//@ts-ignore broken typedef in lib
		type: 2,
		created_at: t,
		details: meta.title,
		state: 'By: ' + meta.artist,
		assets: {
			large_text: 'Album: ' + meta.album,
			large_image: albumAssetID
				? `https://cdn.discordapp.com/app-assets/${env.DISCORD_APP_ID}/${albumAssetID}.png`
				: undefined,
			small_text: meta.status,
			small_image: meta.status?.toLowerCase(),
		},
		timestamps: meta.status === 'Playing'
			? {
				start: t,
				end: t + meta.length! - meta.position!,
			}
			: undefined,
	})

	if (meta.status === 'Stopped') {
		removeActivity()
	} else {
		removeActivity.clear()
	}
}, 2000)

new Deno.Command('playerctl', {
	args: '-p chromium -sF metadata'.split(' '),
	stdout: 'piped',
}).spawn().stdout.pipeTo(writableLineParser((line) => {
	try {
		const { key, val } = line.match(
			/^chromium \w+:(?<key>\w+) +(?<val>.*)$/,
		)!.groups!
		Object.assign(
			meta,
			zMeta.parse({
				[key]: val,
			}),
		)
		markMetaDirty()
	} catch {
		console.error('Could not parse metadata in line:', line)
	}
}))

new Deno.Command('playerctl', {
	args: '-p chromium -sF status'.split(' '),
	stdout: 'piped',
}).spawn().stdout.pipeTo(writableLineParser((line) => {
	Object.assign(meta, {
		status: zStatus.parse(line),
	})
	markMetaDirty()
}))

new Deno.Command('playerctl', {
	args: '-p chromium -sF position'.split(' '),
	stdout: 'piped',
}).spawn().stdout.pipeTo(writableLineParser((line) => {
	Object.assign(meta, {
		position: zPosition.parse(line),
	})
	markMetaDirty()
}))
