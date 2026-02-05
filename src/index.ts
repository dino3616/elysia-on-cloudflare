/**
 * Minimal reproduction for Elysia on Cloudflare Workers issue
 *
 * Testing without CloudflareAdapter to see if the error occurs.
 */

import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";

// Without CloudflareAdapter - using default Elysia export pattern
const app = new Elysia()
	.use(cors())
	.get("/", () => "Hello Elysia on Cloudflare Workers!")
	.get("/json", () => ({
		message: "Hello World",
		timestamp: Date.now(),
	}))
	.post(
		"/echo",
		({ body }) => body,
		{
			body: t.Object({
				message: t.String(),
			}),
			response: t.Object({
				message: t.String(),
			}),
		},
	)
	.compile();

export default app;
