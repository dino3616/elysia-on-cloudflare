/**
 * Minimal reproduction for Elysia on Cloudflare Workers issue
 *
 * Problem: Elysia 1.4.19+ fails to deploy to Cloudflare Workers with error:
 * "Disallowed operation called within global scope. Asynchronous I/O,
 * setting a timeout, and generating random values are not allowed within global scope."
 *
 * Root cause: Creating Elysia models at module level (global scope) triggers
 * randomId() → crypto.randomUUID(), which is prohibited in Cloudflare Workers.
 *
 * This pattern is common in Elysia apps that use .model() for schema definitions.
 */

import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
// Importing this model triggers the error because it creates Elysia instance
// at module level (global scope)
import { UserModel } from "./model";

const app = new Elysia({ adapter: CloudflareAdapter })
	.use(cors())
	.use(UserModel)
	.get("/", () => "Hello Elysia on Cloudflare Workers!")
	.post(
		"/users",
		({ body }) => ({
			id: crypto.randomUUID(),
			...body,
		}),
		{
			body: "user.create",
			response: "user.response",
		},
	)
	.compile();

export default app;
