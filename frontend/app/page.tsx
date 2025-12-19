import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // ✅ Fetch role from your 'profiles' table or user metadata
  // const { data: profile } = await supabase
  //   .from("profiles")
  //   .select("role")
  //   .eq("id", user.id)
  //   .single();

  const role = user.user_metadata?.role || "student";


  // ✅ Role-based redirection
  switch (role) {
    case "admin":
      redirect("/dashboard/admin");
      break;
    case "faculty":
      redirect("/dashboard/faculty");
      break;
    case "student":
    default:
      redirect("/dashboard/student");
      break;
  }
}
