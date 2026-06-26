import { NextResponse } from "next/server";
import { getTodayNzDate, getNzWeekDates } from "@/src/lib/dateTime";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import { sendPushNotification } from "@/src/lib/web-push";

type ProfileRow = { id: string; full_name: string | null };
type EntryRow = { profile_id: string; work_date: string };
type SubscriptionRow = { profile_id: string; endpoint: string; p256dh: string; auth: string };

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const todayDate = getTodayNzDate();
  const weekDates = getNzWeekDates(todayDate);
  // Only Mon–Fri workdays up to and including today
  const pastWorkdays = weekDates.slice(0, 5).filter((d) => d <= todayDate);
  if (pastWorkdays.length === 0) {
    return NextResponse.json({ skipped: true, reason: "No past workdays to check." });
  }

  const supabase = createServiceRoleSupabaseClient();

  // All approved staff
  const profilesRes = await supabase.request(
    "/rest/v1/profiles?select=id,full_name&account_status=eq.approved",
  );
  if (!profilesRes.ok) return NextResponse.json({ error: "Could not fetch profiles." }, { status: 500 });
  const profiles = (await profilesRes.json()) as ProfileRow[];
  if (profiles.length === 0) return NextResponse.json({ sent: 0 });

  const profileIds = profiles.map((p) => p.id);

  // Existing entries for this week
  const entriesRes = await supabase.request(
    `/rest/v1/timesheet_entries?select=profile_id,work_date&profile_id=in.(${profileIds.join(",")})&work_date=in.(${pastWorkdays.join(",")})`,
  );
  if (!entriesRes.ok) return NextResponse.json({ error: "Could not fetch entries." }, { status: 500 });
  const entries = (await entriesRes.json()) as EntryRow[];

  // Find profiles with at least one missing workday
  const submittedKey = (profileId: string, date: string) => `${profileId}:${date}`;
  const submittedSet = new Set(entries.map((e) => submittedKey(e.profile_id, e.work_date)));
  const profilesWithMissing = profiles.filter((p) =>
    pastWorkdays.some((d) => !submittedSet.has(submittedKey(p.id, d))),
  );
  if (profilesWithMissing.length === 0) return NextResponse.json({ sent: 0, allClear: true });

  // Push subscriptions for those profiles
  const missingIds = profilesWithMissing.map((p) => p.id);
  const subsRes = await supabase.request(
    `/rest/v1/push_subscriptions?select=profile_id,endpoint,p256dh,auth&profile_id=in.(${missingIds.join(",")})`,
  );
  if (!subsRes.ok) return NextResponse.json({ error: "Could not fetch subscriptions." }, { status: 500 });
  const subscriptions = (await subsRes.json()) as SubscriptionRow[];
  if (subscriptions.length === 0) return NextResponse.json({ sent: 0, noSubscriptions: true });

  // Build a name map for personalised messages
  const nameById = new Map(profilesWithMissing.map((p) => [p.id, p.full_name?.split(" ")[0] ?? "there"]));

  const dayOfWeek = new Date(`${todayDate}T12:00:00Z`).getUTCDay();
  const isUrgent = dayOfWeek === 4 || dayOfWeek === 5; // Thu or Fri

  let sent = 0;
  const staleEndpoints: string[] = [];

  for (const sub of subscriptions) {
    const firstName = nameById.get(sub.profile_id) ?? "there";
    const missingCount = pastWorkdays.filter((d) => !submittedSet.has(submittedKey(sub.profile_id, d))).length;
    const body = isUrgent
      ? `Hi ${firstName} — you have ${missingCount} unsubmitted day${missingCount === 1 ? "" : "s"} this week. Submit before end of day Friday.`
      : `Hi ${firstName} — ${missingCount} day${missingCount === 1 ? "" : "s"} this week still need${missingCount === 1 ? "s" : ""} a timesheet entry.`;

    try {
      await sendPushNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        { title: "Timesheet reminder", body, tag: "timesheet-reminder", url: "/timesheet" },
      );
      sent++;
    } catch (error: unknown) {
      // 404/410 means the subscription is no longer valid — clean it up
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        staleEndpoints.push(sub.endpoint);
      }
    }
  }

  // Remove stale subscriptions
  for (const endpoint of staleEndpoints) {
    await supabase.request(
      `/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
      { method: "DELETE" },
    );
  }

  return NextResponse.json({ sent, staleRemoved: staleEndpoints.length });
}
