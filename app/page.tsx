C:\Users\Bilgisayarım\Desktop\masraf-sistemi>npm run build

> masraf-sistemi@0.1.0 build
> next build

⚠ Warning: Next.js inferred your workspace root, but it may not be correct.
 We detected multiple lockfiles and selected the directory of C:\Users\Bilgisayarım\package-lock.json as the root directory.
 To silence this warning, set `turbopack.root` in your Next.js config, or consider removing one of the lockfiles if it's not needed.
   See https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory for more information.
 Detected additional lockfiles:
   * C:\Users\Bilgisayarım\Desktop\masraf-sistemi\package-lock.json

▲ Next.js 16.1.6 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 14.7s
  Running TypeScript  ...Failed to compile.

./app/page.tsx:203:18
Type error: Conversion of type '{ id: any; expense_no: any; expense_date: any; vendor_name: any; description: any; amount: any; currency_code: any; payment_type: any; status: any; created_at: any; user_id: any; departments: { name: any; }[]; categories: { ...; }[]; }[]' to type 'Expense[]' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Type '{ id: any; expense_no: any; expense_date: any; vendor_name: any; description: any; amount: any; currency_code: any; payment_type: any; status: any; created_at: any; user_id: any; departments: { name: any; }[]; categories: { ...; }[]; }' is not comparable to type 'Expense'.
    Types of property 'departments' are incompatible.
      Property 'name' is missing in type '{ name: any; }[]' but required in type '{ name: string; }'.

  201 |     }
  202 |
> 203 |     setExpenses((data as unknown as Expense[]) || [])
      |                  ^
  204 |   }
  205 |
  206 |   async function handleLogin(e: React.FormEvent) {
Next.js build worker exited with code: 1 and signal: null

C:\Users\Bilgisayarım\Desktop\masraf-sistemi>git status
On branch main
Your branch is up to date with 'origin/main'.

Untracked files:
  (use "git add <file>..." to include in what will be committed)
        git

nothing added to commit but untracked files present (use "git add" to track)