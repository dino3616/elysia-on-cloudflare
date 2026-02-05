/**
 * This file demonstrates the pattern that causes the error.
 * Creating Elysia model at module level (global scope) triggers randomId().
 */

import { Elysia, t } from "elysia";

// This is called at module import time (global scope)
// which triggers randomId() → crypto.randomUUID() → ERROR
export const UserModel = new Elysia({ name: "User.Model" }).model({
	"user.create": t.Object({
		name: t.String(),
		email: t.String(),
	}),
	"user.response": t.Object({
		id: t.String(),
		name: t.String(),
		email: t.String(),
	}),
});
