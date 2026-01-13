/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from './supabaseClient';

type AiResponse = 
  | { ok: true; data: any }
  | { ok: false; status?: number; bodyText?: string };

export async function callAiScheduler(payload: any): Promise<AiResponse> {
  // 20s timeout using Promise.race since invoke might not support signal everywhere
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const timeoutPromise = new Promise<AiResponse>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Timeout")), 20000);
  });

  try {
    const invokePromise = supabase.functions.invoke('ai-scheduler', {
       body: payload,
    }).then(({ data, error }) => {
        if (error) {
           const ctx: any = (error as any).context;
           let bodyText = '';
           let status = 0;
           
           if (ctx) {
               status = ctx.status;
               // We can't await here easily without making this async, so we'll skip text body for now 
               // or handle it if we redesign. For safety, just log what we have.
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
      // @ts-ignore
      clearTimeout(timeoutId!);
  }
}
