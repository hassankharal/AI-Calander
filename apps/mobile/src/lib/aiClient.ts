/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseClient';

type AiResponse = 
  | { ok: true; data: any }
  | { ok: false; status?: number; bodyText?: string };

const TIMEOUT_MS = 60000;

async function doInvoke(payload: any): Promise<AiResponse> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        // On iOS/native we generally don't abort network requests heavily,
        // but for a clean timeout we can signal or just reject.
        // The user request said "Time out the fetch promise without aborting on iOS" 
        // OR "Remove AbortController-based abort for iOS".
        // BUT here we are doing a raw fetch. Let's just reject the promise.
        // We will NOT call controller.abort() if we want to avoid the "network request failed" errors on native
        // that sometimes occur with AbortController.
        reject(new Error('AI request timed out'));
      }, TIMEOUT_MS);
    });

    try {
        const fetchPromise = async () => {
             // 1. Get Session Token
            const { data: sessionData } = await supabase.auth.getSession();
            const sessionToken = sessionData.session?.access_token;
            const token = (sessionToken ?? SUPABASE_ANON_KEY).trim();
            const endpoint = `${SUPABASE_URL}/functions/v1/ai-scheduler`;

            // Debug Log
            console.log("AI Fetch:", { 
                url: endpoint,
                hasSession: !!sessionToken, 
                anonLen: SUPABASE_ANON_KEY.length
            });

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
                // signal: controller.signal // User asked to avoid AbortController on native?
                // Let's omit signal to be safe as per "Remove AbortController... issues"
            });

            const text = await res.text();
            let data: any;
            try {
                data = JSON.parse(text);
            } catch {
                data = null;
            }

            if (!res.ok) {
                if (res.status === 401) {
                     console.error("401 from Edge: URL+key mismatch OR malformed key OR wrong headers");
                } else {
                     console.error(`AI Edge Error ${res.status}:`, text.slice(0, 200));
                }
                return { ok: false, status: res.status, bodyText: text || "Error" } as AiResponse;
            }

            return { ok: true, data } as AiResponse;
        };
    
        const result = await Promise.race([fetchPromise(), timeoutPromise]);
        return result;
    
    } catch (err: unknown) {
        const msg = (err as Error).message;
        if (msg === 'AI request timed out') { 
             throw new Error('Timeout'); 
        }
        console.error("AI Request Failed: Network/Unknown", err);
        return { ok: false, bodyText: msg };
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

export async function callAiScheduler(payload: any): Promise<AiResponse> {
    try {
        return await doInvoke(payload);
    } catch (err: unknown) {
        if ((err as Error).message === 'Timeout') {
            console.warn("AI Timeout. Retrying once...");
            try {
                return await doInvoke(payload);
            } catch (retryErr: unknown) {
                if ((retryErr as Error).message === 'Timeout') {
                    console.error("AI Retry Failed: Timeout again.");
                    return { ok: false, status: 408, bodyText: "Timeout after retry" };
                }
                return { ok: false, bodyText: (retryErr as Error).message };
            }
        }
        return { ok: false, bodyText: (err as Error).message };
    }
}
