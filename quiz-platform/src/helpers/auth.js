// auth.js - Shared service-account sign-in (bypasses RLS for server-side writes)

// Signs the Supabase client in as the admin/agent account.
// Credentials come only from worker secrets; there is no hardcoded fallback.
async function signInAsAdmin(supabase, env) {
    if (!env.ADMIN_PASSWORD) {
        throw new Error('ADMIN_PASSWORD secret is not configured.');
    }
    const { error } = await supabase.auth.signInWithPassword({
        email: env.ADMIN_EMAIL || 'agent@quizrank.com',
        password: env.ADMIN_PASSWORD
    });
    if (error) {
        throw new Error('Admin sign-in failed: ' + error.message);
    }
}

export { signInAsAdmin };
