/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from './supabaseClient';

type AiResponse = 
  | { ok: true; data: any }
  | { ok: false; status?: number; bodyText?: string };

export async function callAiScheduler(payload: any): Promise<AiResponse> {
  // 20s timeout using Promise.race since invoke might not support signal everywhere
let timeoutId: ReturnType<typeof setTimeout> | undefined;

const timeoutPromise = new Promise<never>((_, reject) => {
  timeoutId = setTimeout(() => reject(new Error('AI request timed out')), 20000);
});

  try {
    const invokePromise = supabase.functions.invoke('ai-scheduler', {
       body: payload,
    }).then(({ data, error }) => {
        if (error) {
           const ctx: any = (error as any).context;
           let status = 0;
           
           if (ctx) {
               status = ctx.status;
           }
           console.error("AI Function Error:", { status, error });
           return { ok: false, status, bodyText: "AI Error" } as AiResponse;
        }
        return { ok: true, data } as AiResponse;
    });

    const result = await Promise.race([invokePromise, timeoutPromise]);
    return result;

  } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg === 'Timeout') {
          console.error("AI Request Failed: Timeout");
          return { ok: false, status: 408, bodyText: "Timeout" };
      }
      console.error("AI Request Failed: Network/Unknown", err);
      return { ok: false, bodyText: msg };
  } finally {
      if (timeoutId) clearTimeout(timeoutId);
  }
}
