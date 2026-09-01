import { supabase } from './utils/api';

async function migrate() {
  const { error } = await supabase.rpc('alter_service_orders_tracking');
  if (error) {
    console.error('Error running migration:', error);
  } else {
    console.log('Migration completed');
  }
}

migrate();
