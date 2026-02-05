# Elysia on Cloudflare Workers - Minimal Reproduction

This repository demonstrates a bug in Elysia 1.4.19+ that prevents deployment to Cloudflare Workers when using the common pattern of defining models at module level.

## Bug Description

**Error Message:**
```
Uncaught Error: Disallowed operation called within global scope.
Asynchronous I/O (ex: fetch() or connect()), setting a timeout,
and generating random values are not allowed within global scope.
```

**Full Stack Trace:**
```
at randomId (elysia/dist/utils.mjs:505:23)
at mapSchema (elysia/dist/schema.mjs:226:261)
at getSchemaValidator (elysia/dist/schema.mjs:237:16)
at createBody (elysia/dist/index.mjs:401:54)
at composeHandler (elysia/dist/compose.mjs:254:15)
at compile (elysia/dist/index.mjs:593:24)
at beforeCompile (elysia/dist/adapter/cloudflare-worker/index.mjs:39:43)
at compile (elysia/dist/index.mjs:1850:29)
at src/index.ts:36:3
```

## Root Cause

Since [#1604](https://github.com/elysiajs/elysia/issues/1604) was merged in v1.4.19, schema compilation calls `randomId()` → `crypto.randomUUID()` during the `mapSchema` phase.

When models are defined at module level (a very common pattern in Elysia), importing them triggers schema validation which calls `crypto.randomUUID()` in global scope.

Cloudflare Workers [prohibits generating random values in global scope](https://developers.cloudflare.com/workers/runtime-apis/handlers/).

## The Problematic Pattern

This is a **very common pattern** in Elysia applications:

```typescript
// src/model.ts - Model defined at module level
import { Elysia, t } from "elysia";

// This triggers randomId() when the module is imported
export const UserModel = new Elysia({ name: "User.Model" }).model({
  "user.create": t.Object({
    name: t.String(),
    email: t.String(),
  }),
});
```

```typescript
// src/index.ts
import { UserModel } from "./model";  // ← Error occurs here!

const app = new Elysia({ adapter: CloudflareAdapter })
  .use(UserModel)
  .compile();
```

## Affected Versions

| Elysia Version | Status  |
| -------------- | ------- |
| 1.4.18         | ✅ Works |
| 1.4.19         | ❌ Fails |
| 1.4.20         | ❌ Fails |
| 1.4.21         | ❌ Fails |
| 1.4.22         | ❌ Fails |

## Reproduction Steps

```bash
# 1. Clone this repository
git clone https://github.com/dino3616/elysia-on-cloudflare.git
cd elysia-on-cloudflare

# 2. Install dependencies
bun install

# 3. Deploy to Cloudflare Workers (this will fail)
CLOUDFLARE_ACCOUNT_ID=your_account_id bun run deploy
```

## Workarounds

### Option 1: Downgrade to Elysia 1.4.18

```bash
bun add elysia@1.4.18
```

### Option 2: Use local patch (bun patch)

```bash
bun patch elysia
# Apply the fix to node_modules/elysia/dist/utils.mjs
bun patch --commit node_modules/elysia
```

## Proposed Fix

Wrap `crypto.randomUUID()` in a try-catch block and fall back to `Math.random()` based ID generation when it throws:

```typescript
const generateRandomIdFallback = (): string => {
    let result = ''
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const charactersLength = characters.length

    for (let i = 0; i < 16; i++)
        result += characters.charAt(Math.floor(Math.random() * charactersLength))

    return result
}

export const randomId = (): string => {
    if (typeof crypto === 'undefined') {
        return generateRandomIdFallback()
    }

    try {
        const uuid = crypto.randomUUID()
        return uuid.slice(0, 8) + uuid.slice(24, 32)
    } catch {
        // Fallback for environments where crypto.randomUUID() throws
        // in global scope (e.g., Cloudflare Workers)
        return generateRandomIdFallback()
    }
}
```

## Environment

- Bun: 1.3.x
- Wrangler: 4.63.0
- Cloudflare Workers compatibility_date: 2025-06-01
- compatibility_flags: nodejs_compat

## Related Issues

- [#1604](https://github.com/elysiajs/elysia/issues/1604) - Lazy compilation improvement that introduced the regression
