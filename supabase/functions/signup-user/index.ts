import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  try {
    const body = await req.json()
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body?.password === "string" ? body.password : ""
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : ""

    if (!emailPattern.test(email) || email.length > 320) {
      return jsonResponse({ error: "Enter a valid email address." }, 400)
    }

    if (password.length < 6 || password.length > 72) {
      return jsonResponse({ error: "Password must be at least 6 characters long." }, 400)
    }

    if (fullName.length > 120) {
      return jsonResponse({ error: "Name is too long." }, 400)
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Signup function is missing Supabase service credentials")
      return jsonResponse({ error: "Account service is not configured." }, 500)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // email_confirm marks the address confirmed so no verification email is sent.
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || null,
      },
    })

    if (error || !data.user) {
      const message = error?.message?.toLowerCase() ?? ""
      if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
        return jsonResponse({ error: "This email is already registered." }, 409)
      }

      console.error("Auth user creation failed", error?.message)
      return jsonResponse({ error: "Failed to create account. Please try again." }, 400)
    }

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: data.user.id,
        email,
        full_name: fullName || null,
        role: "student",
      },
      { onConflict: "id" },
    )

    if (profileError) {
      console.error("Profile save failed", profileError.message)
      return jsonResponse({ error: "Account was created, but the profile could not be saved." }, 500)
    }

    return jsonResponse({ userId: data.user.id }, 200)
  } catch (error) {
    console.error("Signup request failed", error instanceof Error ? error.message : "unknown error")
    return jsonResponse({ error: "Failed to create account. Please try again." }, 500)
  }
})
