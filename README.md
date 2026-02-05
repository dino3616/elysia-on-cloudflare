# Elysia on Cloudflare Workers - Minimal Reproduction

This repository demonstrates a bug in Elysia 1.4.19+ that prevents deployment to Cloudflare Workers **when not using `CloudflareAdapter`**.

## Bug Description

**Error Message:**
```
Uncaught Error: Disallowed operation called within global scope.
Asynchronous I/O (ex: fetch() or connect()), setting a timeout,
and generating random values are not allowed within global scope.
```

**Stack Trace:**
```
at null.<anonymous> (worker.js:16:16) in eval
at null.<anonymous> (elysia/dist/compose.mjs:1178:3) in composeGeneralHandler
at null.<anonymous> (elysia/dist/index.mjs:1850:119) in compile
at null.<anonymous> (src/index.ts:30:3)
```

## Root Cause

Since [#1604](https://github.com/elysiajs/elysia/issues/1604) was merged in v1.4.19, Elysia's lazy compilation feature calls `randomId()` → `crypto.randomUUID()` at module load time (global scope) within `composeGeneralHandler`.

Cloudflare Workers [prohibits generating random values in global scope](https://developers.cloudflare.com/workers/runtime-apis/handlers/), causing the deployment to fail.

**Important:** Using `CloudflareAdapter` avoids this issue because the adapter handles compilation differently. The bug only occurs when:
1. **NOT** using `CloudflareAdapter`, AND
2. Calling `.compile()` at module level (global scope)

## Affected Versions

| Elysia Version | Without CloudflareAdapter | With CloudflareAdapter |
|----------------|---------------------------|------------------------|
| 1.4.18 | ✅ Works | ✅ Works |
| 1.4.19 | ❌ Fails | ✅ Works |
| 1.4.20 | ❌ Fails | ✅ Works |
| 1.4.21 | ❌ Fails | ✅ Works |
| 1.4.22 | ❌ Fails | ✅ Works |

## Reproduction Steps

### To Reproduce the Error (without CloudflareAdapter)

```bash
# 1. Install dependencies
bun install

# 2. Edit src/index.ts to remove CloudflareAdapter (see below)

# 3. Deploy - this will fail
CLOUDFLARE_ACCOUNT_ID=your_account_id bun run deploy
```

**Failing Code (src/index.ts):**
```typescript
import { Elysia } from "elysia";

// Without CloudflareAdapter - causes error
const app = new Elysia()
  .get("/", () => "Hello!")
  .compile();

export default app;
```

### Working Code (with CloudflareAdapter)

```typescript
import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";

// With CloudflareAdapter - works fine
const app = new Elysia({ adapter: CloudflareAdapter })
  .get("/", () => "Hello!")
  .compile();

export default app;
```

## Workarounds

### Option 1: Use CloudflareAdapter (Recommended)

```typescript
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";

const app = new Elysia({ adapter: CloudflareAdapter })
  .get("/", () => "Hello!")
  .compile();
```

### Option 2: Downgrade to Elysia 1.4.18

```bash
bun add elysia@1.4.18
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
        // in global scope (e.g., Cloudflare Workers without adapter)
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
- [#1614](https://github.com/elysiajs/elysia/issues/1614) - Cloudflare Worker with dynamic path
