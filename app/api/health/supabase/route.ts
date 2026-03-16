import { NextResponse } from "next/server";

import { getSupabaseFoundationHealth } from "@/src/lib/supabase/health";

export const GET = async () => NextResponse.json(getSupabaseFoundationHealth());
