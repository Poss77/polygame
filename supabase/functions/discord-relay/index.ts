import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch secret webhook URLs from admin_discord_secrets using service role key
    const { data: secretRow, error: secretErr } = await supabase
      .from('admin_discord_secrets')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (secretErr || !secretRow) {
      throw new Error("Discord webhook secrets not configured in database.");
    }

    const payload = await req.json();
    const { action, channel = 'main' } = payload;

    // Pick target webhook URL
    let targetWebhook = secretRow.discord_webhook_url;
    if (channel === 'admin') {
      targetWebhook = secretRow.discord_admin_webhook_url || secretRow.discord_webhook_url;
    } else if (channel === 'announcements') {
      targetWebhook = secretRow.discord_announcements_webhook_url || secretRow.discord_webhook_url;
    }

    if (!targetWebhook || !targetWebhook.startsWith('http')) {
      return new Response(JSON.stringify({ success: false, error: 'Target webhook URL not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    let discordPayload: any = null;

    if (action === 'earn_announcement') {
      const { gameName, score, earnedPgt, player } = payload;
      const pgt = parseFloat(earnedPgt || 0);
      if (pgt < 20.0) {
        return new Response(JSON.stringify({ success: false, error: 'Earn amount below announcement threshold (20 PGT)' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      discordPayload = {
        username: "PolyGame Announcer 🏆",
        avatar_url: "https://polygongaming.io/src/assets/logo.svg",
        embeds: [{
          title: `Big earn on ${gameName || 'Arcade'}!`,
          description: `Player won **${pgt.toFixed(2)} PGT** playing **${gameName}**!`,
          color: 0x00F0FF,
          fields: [
            { name: "👤 Player", value: player || "PolyGame Pilot", inline: true },
            { name: "🕹️ Score", value: `${Number(score || 0).toLocaleString()} pts`, inline: true },
            { name: "💰 Payout", value: `+${pgt.toFixed(2)} PGT`, inline: true }
          ],
          footer: {
            text: "PolyGame Portal • https://polygongaming.io/",
            icon_url: "https://polygongaming.io/src/assets/logo.svg"
          },
          timestamp: new Date().toISOString()
        }]
      };
    } else if (action === 'win_announcement') {
      const { gameName, wager, payout, multiplier, player } = payload;
      const winPayout = parseFloat(payout || 0);
      if (winPayout < 100.0) {
        return new Response(JSON.stringify({ success: false, error: 'Win amount below announcement threshold (100 PGT)' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      discordPayload = {
        username: "PolyGame Announcer 🏆",
        avatar_url: "https://polygongaming.io/src/assets/logo.svg",
        embeds: [{
          title: `Big win on ${gameName || 'Casino'}!`,
          description: `Player hit **${multiplier || '0'}x** on **${gameName}** for **${winPayout.toFixed(2)} PGT**!`,
          color: 0xFFD700,
          fields: [
            { name: "👤 Player", value: player || "PolyGame Pilot", inline: true },
            { name: "🎯 Multiplier", value: `${multiplier}x`, inline: true },
            { name: "💰 Win Payout", value: `+${winPayout.toFixed(2)} PGT`, inline: true },
            { name: "🎲 Wager", value: `${parseFloat(wager || 0).toFixed(2)} PGT`, inline: true }
          ],
          footer: {
            text: "PolyGame Portal • https://polygongaming.io/",
            icon_url: "https://polygongaming.io/src/assets/logo.svg"
          },
          timestamp: new Date().toISOString()
        }]
      };
    } else if (action === 'admin_alert') {
      const { title, description, category = 'SECURITY', color = 0xFF0033, fields = [] } = payload;
      
      // Sanitize titles to drop forged admin impostor tags
      const safeTitle = (title || 'Incident Logged').replace(/\[ADMIN\]/gi, '').trim();

      discordPayload = {
        username: "PolyGame Security Sentinel 🛡️",
        avatar_url: "https://polygongaming.io/src/assets/logo.svg",
        embeds: [{
          title: `🛡️ [ADMIN ${category}] ${safeTitle}`,
          description: description || 'Automated security report',
          color: color,
          fields: fields,
          footer: {
            text: "PolyGame Security Sentinel • https://polygongaming.io/"
          },
          timestamp: new Date().toISOString()
        }]
      };
    } else if (action === 'admin_announcement') {
      // Must be authorized with Master Admin Passkey
      const { adminPasskey, title, description, color = 0xFFAA00, fields = [] } = payload;
      const { data: settings } = await supabase.from('global_settings').select('admin_passkey').eq('id', 1).single();
      
      if (!adminPasskey || adminPasskey !== settings?.admin_passkey) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized: Admin Passkey required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        });
      }

      discordPayload = {
        username: "PolyGame Official 📢",
        avatar_url: "https://polygongaming.io/src/assets/logo.svg",
        embeds: [{
          title: title,
          description: description,
          color: color,
          fields: fields,
          footer: {
            text: "PolyGame Announcements 📢 • https://polygongaming.io/",
            icon_url: "https://polygongaming.io/src/assets/logo.svg"
          },
          timestamp: new Date().toISOString()
        }]
      };
    } else {
      return new Response(JSON.stringify({ success: false, error: 'Invalid relay action' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Send payload to target Discord webhook
    const discordRes = await fetch(targetWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload)
    });

    if (!discordRes.ok) {
      const errTxt = await discordRes.text();
      return new Response(JSON.stringify({ success: false, error: `Discord rejected: ${errTxt}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Internal relay error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
