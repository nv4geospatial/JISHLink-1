import { supabase } from "./lib/supabase";

async function seedAdmin() {
  const { data, error } = await supabase
    .from("users")
    .insert([
      {
        id: "7cc7764e-c676-4b4e-8e47-1fbae93cad97",
        email: "nv4data1@gmail.com",
        role_id: "00000000-0000-0000-0000-000000000001",
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
  console.log("Success:", data);
  process.exit(0);
}

seedAdmin();