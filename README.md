# ERMO (MVP)

A direct carer–client marketplace: verified, self-employed carers, families who choose them, and simulated escrow payments. Built with Next.js 16, Supabase and Tailwind, the same stack as MatchKits.

One web app with three areas:

- **Clients** (`/client`, `/carers`): search, carer profiles, messaging, booking, confirming visits, disputes, reviews.
- **Carers** (`/carer`): onboarding, documents, requests, check-in and check-out, earnings. Designed for phones first.
- **Admins** (`/admin`): verification queue, disputes, safeguarding, payment ledger, users, audit log.

Payments are **simulated** (PRD 8.6). Bookings move through the real states (pending, held, then released, refunded or partially refunded), with fees, cancellations, the 48-hour auto-release and dispute outcomes all calculated in the database. A "Test mode" banner is shown wherever money appears. Identity checks and the DBS Update Service check are also simulated: an admin approves the DBS document, which records the check.

## Setup

1. **Create a Supabase project** in the London region (`eu-west-2`).
2. **Run the schema:** in the Supabase dashboard, go to SQL Editor, choose New query, paste [supabase/schema.sql](supabase/schema.sql), then click Run. It is safe to run again.
3. **Optional: turn on pg_cron.** Go to Database, then Extensions, enable `pg_cron`, and run the schema again. It then runs auto-release and no-shows every 10 minutes. Without it, the same rules run whenever a dashboard loads.
4. **Configure Auth.** Sign-in is **Continue with Google**, or email and password. Magic links return once ERMO has its own email sender, such as Zapiack.
   - **URL Configuration:** set the Site URL to your site (e.g. `http://localhost:3000`, then your Vercel URL). Add `<site>/auth/callback` under Redirect URLs for each site.
   - **Email:** under Sign In / Providers, then Email, turn off "Confirm email". Supabase's built-in email only reaches your own team.
   - **Google:** under Sign In / Providers, then Google, enable it and paste a Google OAuth Client ID and secret. In Google Cloud Console, the OAuth client's Authorized redirect URI must be `https://<project-ref>.supabase.co/auth/v1/callback`.
   - **First Google sign-in:** new Google users choose "Find care" or "Offer care" once, at `/welcome`.
5. **Add environment variables:** copy `.env.example` to `.env.local` and fill in your values from Project Settings, then API.
6. **Run the app:**
   ```bash
   npm install
   npm run dev
   ```
7. **Make yourself an admin:** sign up normally, then run this in the SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
   ```

## Trying the full flow

1. Sign up as a **carer**. Fill in the profile, verify identity (simulated), add right to work and DBS documents, and send for review.
2. As the **admin**, open Verification, approve each document, then approve the carer.
3. Sign up as a **client** in another browser or a private window. Find the carer, message them, verify identity, and request a booking that starts within the next hour.
4. As the **carer**, accept the booking (money is now held), check in, then check out.
5. As the **client**, confirm completion (money is released), then leave a review. Or raise a dispute and resolve it as the admin.

## Location search

The location box suggests UK towns, cities and postcodes using [postcodes.io](https://postcodes.io) (free, open data, no key), plus a bundled list of major places in `src/lib/major-places.ts` for instant prefix matches. Carers save a location and how far they'll travel. Clients see carers who travel to them, nearest first (`carers_near` in the schema). Distances are rounded to the half mile. A carer's postcode and coordinates are only readable by that carer and by admins, through `carer_private()`. If postcodes.io is unreachable, typed text is still accepted and looked up when the form is submitted.

## Where the rules live

All booking, payment, cancellation and dispute logic is in Postgres functions in `supabase/schema.sql`, so the web app can't bypass it. Writes go through those functions. Row Level Security plus column grants stop users from editing their own role, approval status or payment fields.

The fee percentages and time windows are in the `settings` table (PRD section 16 open decisions):

```sql
update public.settings set client_fee_bps = 500, carer_commission_bps = 1000, auto_release_hours = 48;
```

`BookingForm` shows a 5% fee estimate. Update `CLIENT_FEE` in `src/components/BookingForm.tsx` if you change `client_fee_bps`.

## Not in this MVP (next steps)

- Real payments with Stripe Connect (the `settle_booking` function is the one place to swap in)
- Real ID verification (Stripe Identity, Yoti or Onfido) and a DBS Update Service integration
- Push and email notifications
- HMRC platform reporting data and tax details
- Native carer app (Expo), open shift marketplace, and repeat-booking discount
