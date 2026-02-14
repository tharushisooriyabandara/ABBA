# ABBA International Men's Wear

Shop login and order app for multiple branches. Orders can be stored in a **Supabase** database so all branches share the same data.

## Database setup (Supabase)

1. Create a free account and project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, open **SQL Editor** → **New query**. Paste the contents of `supabase-setup.sql` and run it (creates `orders` and `employees` tables).
3. Go to **Settings** → **API**. Copy:
   - **Project URL**
   - **anon public** key
4. Open `js/config.js` and set:
   - `supabaseUrl`: your Project URL
   - `supabaseAnonKey`: your anon public key

After this, orders are saved to the database and Admin can see all orders from every branch. Without config, orders fall back to browser storage (local only).
