import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// 1. Robust HTTP Client with 30s timeout and Exponential Backoff Retry logic
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }

      // If client-side error (4xx), do not retry (auth issues, invalid parameters, etc.)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client Error (${response.status}): ${response.statusText} at ${url}`);
      }

      // Server-side errors (5xx) or other status codes will trigger retry
      throw new Error(`Server Error (${response.status}): ${response.statusText} at ${url}`);
    } catch (err: any) {
      clearTimeout(timeoutId);
      attempt++;

      // If it was a 4xx error, throw immediately
      const isClientError = err.message && err.message.includes("Client Error");
      if (isClientError || attempt > maxRetries) {
        console.error(`Fetch permanent failure on attempt ${attempt}: ${err.message}`);
        throw err;
      }

      // Backoff intervals: 5s, 10s, 20s
      const delay = attempt === 1 ? 5000 : attempt === 2 ? 10000 : 20000;
      console.warn(`Fetch failed: ${err.message}. Retrying ${attempt}/${maxRetries} in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// 2. Data Flattening Parser
function flattenWmsOrders(rawData: any): any[] {
  let list: any[] = [];
  if (Array.isArray(rawData)) {
    list = rawData;
  } else if (rawData && Array.isArray(rawData.data)) {
    list = rawData.data;
  } else if (rawData && typeof rawData === "object") {
    list = [rawData];
  } else {
    throw new Error("Invalid raw data format returned from WMS API (expected array or object)");
  }

  const flattened: any[] = [];
  const now = new Date().toISOString();

  for (const item of list) {
    const warehouse_id = item.warehouse_id || item.warehouseId || item.whId || item.wh_id || "WHORD";
    const owner_id = item.owner_id || item.ownerId || item.owner || "HTA";
    const order_id = item.order_id || item.orderId || item.ordId || item.orderNo;
    const release_num = item.release_num || item.releaseNum || item.releaseNo || item.release_no || "";

    // Support nested array format (e.g. order contains an array of item lines)
    const subItems = item.items || item.lines || item.details || item.orderLines || item.order_lines;

    if (Array.isArray(subItems) && subItems.length > 0) {
      for (const sub of subItems) {
        const item_id = sub.item_id || sub.itemId || sub.itemCode || sub.item_code || sub.item || "";
        const pieces_to_pick = Number(sub.pieces_to_pick ?? sub.piecesToPick ?? sub.qty ?? sub.pieces ?? sub.quantity ?? 0);
        
        if (order_id && item_id) {
          flattened.push({
            warehouse_id,
            owner_id,
            order_id,
            release_num,
            item_id,
            pieces_to_pick,
            collected_at: now
          });
        }
      }
    } else {
      // Standard flat layout
      const item_id = item.item_id || item.itemId || item.itemCode || item.item_code || item.item || "";
      const pieces_to_pick = Number(item.pieces_to_pick ?? item.piecesToPick ?? item.qty ?? item.pieces ?? item.quantity ?? 0);
      
      if (order_id && item_id) {
        flattened.push({
          warehouse_id,
          owner_id,
          order_id,
          release_num,
          item_id,
          pieces_to_pick,
          collected_at: now
        });
      }
    }
  }

  return flattened;
}

serve(async (req) => {
  // Handle CORS Preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  try {
    log("Starting WMS Order sync...");

    // 1. Get database client from env
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Supabase environment variables (URL/Service Role Key) are not configured.");
    }
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 2. Authenticate against WMS Auth API
    log("Authenticating against WMS Auth API...");
    const authUrl = "https://digitrack-kcc.qssi-wms.com/api/v1/auth";
    const authPayload = {
      usrId: "NVTCHPRD",
      password: "CDQ9L153G"
    };

    const authRes = await fetchWithRetry(authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authPayload)
    });
    
    const authData = await authRes.json();
    const token = authData.token || authData.accessToken || (authData.data && (authData.data.token || authData.data.accessToken));
    
    if (!token) {
      log("Authentication failed: No token found in response.");
      throw new Error("Failed to retrieve authentication token from WMS.");
    }
    log("Authentication successful.");

    // 3. Fetch Pending Orders from WMS API
    log("Fetching pending orders...");
    const pendingOrdersUrl = "https://digitrack-kcc.qssi-wms.com/api/v1/order/pending/WHORD/HTA";
    
    const ordersRes = await fetchWithRetry(pendingOrdersUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    const rawOrdersData = await ordersRes.json();
    log(`Fetched orders payload. Parsing and flattening...`);

    // 4. Flatten the response
    const flattenedOrders = flattenWmsOrders(rawOrdersData);
    log(`Successfully flattened into ${flattenedOrders.length} order items.`);

    if (flattenedOrders.length === 0) {
      log("No pending orders found to import.");
      return new Response(
        JSON.stringify({ success: true, count: 0, logs }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Upsert into database
    log("Upserting records into pending_orders table...");
    const { data, error } = await supabase
      .from("pending_orders")
      .upsert(flattenedOrders, { onConflict: "order_id,item_id" });

    if (error) {
      log(`Database upsert error: ${error.message}`);
      throw error;
    }

    log("Database upsert complete.");
    return new Response(
      JSON.stringify({ success: true, count: flattenedOrders.length, logs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    log(`Sync failed with error: ${error.message}`);
    return new Response(
      JSON.stringify({ success: false, error: error.message, logs }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
