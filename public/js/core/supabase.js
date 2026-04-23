let supabaseClientSingleton = null

export async function initSupabase() {
    if (supabaseClientSingleton) return supabaseClientSingleton

    const url = String(window.__SUPABASE_URL__ || "").trim()
    const publishableKey = String(window.__SUPABASE_PUBLISHABLE_KEY__ || "").trim()

    if (!url || !publishableKey) {
        return null
    }

    const globalSupabase = window.supabase
    if (!globalSupabase || typeof globalSupabase.createClient !== "function") {
        return null
    }

    supabaseClientSingleton = globalSupabase.createClient(url, publishableKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    })

    return supabaseClientSingleton
}
