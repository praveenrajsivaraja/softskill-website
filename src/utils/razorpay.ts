
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: any) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

async function readFunctionError(error: unknown): Promise<string> {
  const response = (error as { context?: { json?: () => Promise<unknown>; message?: string } } | null)?.context;

  if (response && typeof response.json === 'function') {
    try {
      const body = await response.json();
      if (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string') {
        return (body as { error: string }).error;
      }
    } catch {
      // The function response was not JSON.
    }
  }

  if (error instanceof Error && error.message === 'Failed to send a request to the Edge Function') {
    return 'The payment function did not respond. Deploy create-razorpay-order on this Supabase project and set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.';
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Failed to create payment order';
}

export const createRazorpayOrder = async (amount: number, currency: string = 'INR') => {
  try {
    const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
      body: { amount: amount * 100, currency } // Convert to paise
    });

    if (error) {
      throw new Error(await readFunctionError(error));
    }

    if (!data?.order_id || !data?.key_id) {
      throw new Error(data?.error || 'Payment function returned an incomplete order');
    }

    return data;
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    throw error;
  }
};

export const initializeRazorpay = (options: RazorpayOptions) => {
  const razorpay = new window.Razorpay(options);
  razorpay.open();
};
