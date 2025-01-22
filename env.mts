import z from 'zod'
import {} from '@std/dotenv/load'

export const env = z.object({
	DISCORD_APP_ID: z.string().regex(/^\d+$/),
	DISCORD_TOKEN: z.string(),
}).parse(Deno.env.toObject())
