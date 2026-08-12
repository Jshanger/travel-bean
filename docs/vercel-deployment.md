# Travel Bean Vercel Deployment

Travel Bean should use:

- Vercel for the web app and API routes.
- Neon for Postgres.
- Cloudflare R2 for public blog photos.

Do not make a new TestFlight build until the Vercel public blog flow works in a browser.

## Required Vercel Environment Variables

Set these on the Vercel project:

- `DATABASE_URL`
- `EXPO_PUBLIC_DOMAIN`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `R2_ACCOUNT_ID`
- `R2_ENDPOINT`
- `R2_BUCKET_NAME`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Optional:

- `R2_PUBLIC_URL`
- `PUBLIC_LOCAL_BLOG_USERNAMES`

`EXPO_PUBLIC_DOMAIN` should be the Vercel domain without `https://`, for example:

```text
travel-bean.vercel.app
```

## Verification Checklist

1. Deploy the GitHub `main` branch on Vercel.
2. Open `/api/healthz/storage`.
3. Confirm the response says R2 is configured.
4. Open `/blog`.
5. Create or open a Bean with 1 photo.
6. Publish it to the blog.
7. Open the public post link in a private browser window.
8. Confirm the public page loads with the photo.
9. Open the public blog homepage, for example `/@josh`.
10. Confirm the published post appears there.

Only after all checks pass should the iOS build point at this Vercel domain.
