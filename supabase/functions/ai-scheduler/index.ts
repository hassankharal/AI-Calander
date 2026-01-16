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
    const { message, nowIso, timezone, context } = await req.json()

    // Validate required fields
    if (!message || !nowIso || !timezone) {
       throw new Error("Missing required fields: message, nowIso, or timezone");
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiApiKey) {
      throw new Error("OPENAI_API_KEY is not set")
    }
    const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5-mini'

    const systemPrompt = `
You are a smart, proactive scheduling assistant.
Current Time: ${nowIso}
User Timezone: ${timezone}

Goal:
Analyze the user's request and context to propose the best schedule actions.
You must handle Tasks (to-dos) and Events (calendar blocks).

Context:
Events: ${JSON.stringify(context?.events || [])}
Tasks: ${JSON.stringify(context?.tasks || [])}
Preferences: ${JSON.stringify(context?.prefs || {})}

Output Schema (Strict JSON):
{
  "assistantText": string, // Helpful explanation of what you did or what you need.
  "mode": "proposal" | "followup",
  "followUpQuestion": string | null, // If mode is 'followup', ask here.
  "proposals": [
    {
      "type": "event" | "task",
      "title": string, // Clean, action-oriented title
      "notes": string | null,
      "location": string | null,
      "startAt": string | null, // ISO8601 (Events only)
      "endAt": string | null,   // ISO8601 (Events only)
      "dueDate": string | null, // YYYY-MM-DD (Tasks only)
      "confidence": number // 0.0 to 1.0
    }
  ]
}

Logic & Rules:

1. **Task vs Event**:
   - If the request implies a specific time block (e.g. "at 3pm", "meeting", "doctor"), make it an **Event**.
   - If it's a general to-do (e.g. "buy milk", "email bob", "finish report"), make it a **Task**.

2. **Event Scheduling**:
   - Determine Start/End times relative to Current Time and Timezone.
   - **Duration**: If not specified, use 'prefs.defaultEventMinutes' (default 60 mins).
   - **Conflict Check**: 
     - Check 'Events' list. Overlap = (newStart < existingEnd) AND (newEnd > existingStart).
     - If user specified a time and it conflicts:
       - Propose it anyway but warn in 'assistantText'.
       - OR propose a nearby alternative slot and explain.
     - If user *didn't* specify a time (e.g. "schedule a gym session tomorrow"):
       - Find the first available gap that fits the duration and preferences (e.g. 'workBlocks', 'sleepWindow').
       - If no slot found, ask a **followUpQuestion**.

3. **Task Scheduling**:
   - **Due Date**: If user says "today", "tomorrow", or a date, set 'dueDate' (YYYY-MM-DD).
   - If no date mentioned, leave 'dueDate' null (or set based on urgency if implied).
   - Clean up the title (e.g. "I need to buy milk" -> "Buy milk").

4. **Follow-ups**:
   - If the request is too vague to act on (e.g. "schedule a meeting" with no who/when), set "mode": "followup" and ask for details.
   - If you can make a reasonable guess, do so (mode: "proposal") but mention your assumption in 'assistantText'.

5. **Style**:
   - 'assistantText' should be friendly, concise, and helpful.
   - 'confidence': High (0.9+) if request is clear. Low (<0.7) if guessing.
`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
      }),
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
    } catch (e) {
        throw new Error("Failed to parse AI response as JSON");
    }

    return new Response(JSON.stringify(parsedResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
