import { md5 } from '@takker/md5'
import { encodeBase64, encodeHex } from 'jsr:@std/encoding'

import { env } from './env.mts'

const DO_NOT_MANAGE: string[] = [
	'playing',
	'paused',
	'stopped',
	'default',
]

const apiPrefix =
	`https://discord.com/api/v9/oauth2/applications/${env.DISCORD_APP_ID}/assets`

async function api<Res, Req = undefined>(
	method: 'GET' | 'POST' | 'DELETE',
	path: string = '',
	body?: Req,
): Promise<Res> {
	const res = await fetch(apiPrefix + path, {
		headers: {
			'Authorization': env.DISCORD_TOKEN,
			'Origin': 'https://discord.com',
			'Referer':
				`https://discord.com/developers/applications/${env.DISCORD_APP_ID}/rich-presence/assets`,
			...(body
				? {
					'Content-Type': 'application/json',
				}
				: {}),
		},
		method,
		body: body ? JSON.stringify(body) : undefined,
	})

	const resBody = method === 'DELETE' ? null : await res.json()

	if (res.ok) {
		return resBody
	}
	throw new Error(
		`${method} ${apiPrefix}${path} ${JSON.stringify(body)} -> ${
			JSON.stringify(resBody)
		}`,
	)
}

type DiscordAsset = {
	id: string
	name: string
	type: 1
}

type DiscordAssetUpload = {
	image: string
	name: string
	type: '1'
}

const log = console.debug.bind(null, '[assets]')

export const cache = new Map<DiscordAsset['name'], DiscordAsset['id']>(
	(await api<DiscordAsset[]>('GET', '?nocache=true'))
		.map((asset) => [asset.name, asset.id]),
)
log('Initialized with cache size', cache.size)

export async function upload(
	filePath: string,
): Promise<DiscordAsset['id'] | null> {
	log('Upload', filePath)
	const pngBytes = await Deno.readFile(filePath).catch(() => null)
	if (pngBytes === null) {
		log('Failed to read', filePath)
		return cache.get('default') ?? null
	}

	{
		const dv = new DataView(pngBytes.buffer)
		// The width and height are 4-byte integers starting
		// at byte offset 16 and 20, respectively.
		const width = dv.getUint32(16)
		const height = dv.getUint32(20)
		if (width !== height) {
			return null
		}
	}

	const fileData = 'data:image/png;base64,' + encodeBase64(pngBytes)
	const hash = encodeHex(md5(fileData))

	const existingID = cache.get(hash)
	if (existingID) {
		log('Asset already uploaded', existingID)
		return existingID
	}

	if (cache.size >= 300) {
		log('Cache limit hit:', cache.size)
		for (
			const [name, id] of cache.entries()
				.filter(([name]) => !DO_NOT_MANAGE.includes(name))
				.take(5)
		) {
			await remove(name, id)
		}
	}

	log('Fetching...')
	const asset = await api<DiscordAsset, DiscordAssetUpload>('POST', '', {
		image: fileData,
		name: hash,
		type: '1',
	})

	cache.set(asset.name, asset.id)
	log('Uploaded, cache size is now', cache.size)
	return asset.id
}

export async function remove(
	name: DiscordAsset['name'],
	id: DiscordAsset['id'],
) {
	log('Remove', id)
	await api('DELETE', '/' + id)
	cache.delete(name)
	log('Removed', id, 'Cache size is now', cache.size)
}
