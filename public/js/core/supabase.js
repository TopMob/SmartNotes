let supabaseClientSingleton = null

export async function initSupabase() {
    if (supabaseClientSingleton) return supabaseClientSingleton

    const url = String(window.SmartNotesSupabaseConfig?.url || "").trim()
    const publishableKey = String(window.SmartNotesSupabaseConfig?.publishableKey || "").trim()

    if (!url || !publishableKey) {
        throw new Error("supabase-config-missing")
    }

    const supabaseGlobal = window.supabase
    if (!supabaseGlobal || typeof supabaseGlobal.createClient !== "function") {
        throw new Error("supabase-global-missing")
    }

    supabaseClientSingleton = supabaseGlobal.createClient(url, publishableKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    })

    return supabaseClientSingleton
}
