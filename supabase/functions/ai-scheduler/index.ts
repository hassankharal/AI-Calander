import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      message, 
      nowIso, 
      timezone, 
      thread, 
      sessionState, 
      eventsWindow,
      prefs 
    } = await req.json()

    if (!message || !nowIso || !timezone) {
       throw new Error("Missing required fields: message, nowIso, or timezone");
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiApiKey) {
      throw new Error("OPENAI_API_KEY is not set")
    }
    const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o'

    const systemPrompt = `
You are a smart, stateful scheduling assistant.
Current Time: ${nowIso}
User Timezone: ${timezone}

Goal:
Identify the user's intent to schedule a Task or Event.
Maintain state across turns. If details are missing, ask for them.
Do NOT find free slots yourself. Just extract the constraints.

Context:
- Events (Next 7 days): ${JSON.stringify(eventsWindow || [])}
- Preferences: ${JSON.stringify(prefs || {})}
- Session State: ${JSON.stringify(sessionState || {})}

State Handling Rules:
1. If 'sessionState.pendingIntent' exists, the user's message is likely answering a previous question. Merge new info into the pending intent.
2. If the request is new, start a new intent.

Scheduling Rules:
1. **Event**: For specific times/meetings (e.g., "Lunch at 1pm", "Meeting with Bob").
   - Extract 'fixedStartAt'/'fixedEndAt' if specified.
   - If only "tomorrow" is said, set 'fixedStartAt' to null, but imply a date range if possible, or leave it for the client logic. Use 'notes' for vague timing like "afternoon".
2. **Task**: For general to-dos (e.g., "Buy milk", "Email Sarah").
   - 'dueDate' should be YYYY-MM-DD if mentioned.

Modes:
- "followup": Critical info missing (e.g., "Schedule a meeting" -> "With whom and when?").
- "intent": All necessary info gathered.
- "proposal": (Same as intent, legacy support).

Output Schema (Strict JSON):
{
  "assistantText": string, // One sentence confirmation or question.
  "mode": "followup" | "intent" | "proposal",
  "followUpQuestion": string | null, // If mode="followup"
  "awaitingFields": string[] | null, // E.g. ["time", "location"]
  "pendingIntent": object | null, // The partial state to save for next turn
  "intent": {
    "kind": "event" | "task",
    "title": string,
    "durationMinutes": number | null,
    "location": string | null,
    "fixedStartAt": string | null, // ISO8601 if specific time known
    "fixedEndAt": string | null,   // ISO8601
    "windowDays": number | null,   // 1 = today, 7 = within week
    "notes": string | null,
    "dueDate": string | null       // YYYY-MM-DD for tasks
  } | null,
  "proposals": [] // Optional, empty array to satisfy legacy clients if needed
}
`

    // Prepare messages
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add thread context (last 10 messages) if available
    if (thread && Array.isArray(thread)) {
      thread.forEach((m: any) => {
        if (m.role && m.text) {
          messages.push({ role: m.role, content: m.text });
        }
      });
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // Build payload without temperature or top_p
    const payload: any = {
      model: model,
      messages: messages,
      response_format: { type: 'json_object' }
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API Error: ${errorText}`);
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    
    // Validate JSON
    let parsedResult;
    try {
        parsedResult = JSON.parse(content);
        
        // Normalize "intent" vs "proposal" mode
        if (parsedResult.mode === 'intent' || parsedResult.mode === 'proposal') {
            // Ensure proposals array exists for client compatibility if it expects it
            if (!parsedResult.proposals && parsedResult.intent) {
                 // Convert intent to proposal format for client convenience
                 const p = parsedResult.intent;
                 parsedResult.proposals = [{
                     type: p.kind,
                     title: p.title,
                     notes: p.notes,
                     location: p.location,
                     startAt: p.fixedStartAt,
                     endAt: p.fixedEndAt,
                     dueDate: p.dueDate,
                     confidence: 0.95
                 }];
            }
        }

    } catch (e) {
        // Fallback for parsing error
        parsedResult = {
            assistantText: "I'm sorry, I didn't verify that. Could you say it again?",
            mode: "followup",
            followUpQuestion: "Could you rephrase your request?",
            awaitingFields: [],
            pendingIntent: null,
            intent: null
        };
    }

    return new Response(JSON.stringify(parsedResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    // Return a valid JSON response so the client doesn't crash
    const fallbackResponse = {
        assistantText: "I encountered an error. Please try again.",
        mode: "followup",
        followUpQuestion: "Could you rephrase that?",
        awaitingFields: [],
        pendingIntent: null,
        intent: null
    };

    return new Response(JSON.stringify(fallbackResponse), {
      status: 200, // Return 200 so the client processes the fallback JSON
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
