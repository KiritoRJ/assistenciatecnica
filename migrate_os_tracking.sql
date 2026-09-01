-- Migration for OS Tracking
ALTER TABLE public.service_orders 
ADD COLUMN IF NOT EXISTS tracking_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS public_notes TEXT,
ADD COLUMN IF NOT EXISTS is_tracking_enabled BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_service_orders_tracking_token ON public.service_orders(tracking_token);
