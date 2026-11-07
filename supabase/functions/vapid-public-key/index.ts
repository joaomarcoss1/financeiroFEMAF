const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(JSON.stringify({ key: Deno.env.get("VAPID_PUBLIC_KEY") || "" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
