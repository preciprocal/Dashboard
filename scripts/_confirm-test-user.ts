import { supabaseAdmin } from "../supabase/admin";

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("usage: _confirm-test-user.ts <email>");

  let page = 1;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email);
    if (user) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, { email_confirm: true });
      if (updateError) throw updateError;
      console.log("✅ confirmed:", email, user.id);
      return;
    }
    if (data.users.length < 200) break;
    page++;
  }
  throw new Error(`user not found: ${email}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
