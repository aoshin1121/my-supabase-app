"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "./supabaseClient";

export default function NotificationBell() {
  const [count, setCount] = useState<number>(0);

  const load = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;

    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .neq("is_read", true);

    if (!error) setCount(count ?? 0);
  };

  useEffect(() => {
    load();

    const ch = supabase
      .channel(`notif-bell:${Math.random()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        load
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <Link href="/notifications" className="relative inline-flex items-center">
      <span className="text-xl">🔔</span>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px]
                         rounded-full bg-red-600 text-white text-[11px]
                         font-bold flex items-center justify-center">
          {count}
        </span>
      )}
    </Link>
  );
}
