import express from 'express';
import { createServer as createViteServer } from 'vite';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { OnlineDB, supabase } from './utils/api';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Helper to hash password
const hashPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Helper to compare password
const comparePassword = async (password: string, hash: string) => {
  // If it's a bcrypt hash, it starts with $2a$ or $2b$
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
    return await bcrypt.compare(password, hash);
  }
  // Fallback for plain text passwords (legacy)
  return password === hash;
};

const getMPClient = () => {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN ou MP_ACCESS_TOKEN não definida nas variáveis de ambiente.');
  }
  return new MercadoPagoConfig({ accessToken: token });
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Auth Routes
app.get('/api/resolve-tiktok', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const finalUrl = response.url;
    const match = finalUrl.match(/\/video\/(\d+)/);
    const videoId = match ? match[1] : null;

    res.json({ finalUrl, videoId });
  } catch (err) {
    console.error('Error resolving TikTok URL:', err);
    res.status(500).json({ error: 'Failed to resolve URL' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const cleanUser = username.trim().toLowerCase();

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*, tenants(*, tenant_limits(*))')
      .eq('username', cleanUser)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(401).json({ success: false, message: "Usuário ou senha incorretos." });

    const isMatch = await comparePassword(password.trim(), data.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Usuário ou senha incorretos." });

    const tenant = data.tenants;
    const limits = tenant?.tenant_limits;
    const expiresAt = tenant?.subscription_expires_at;
    const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

    res.json({ 
      success: true, 
      type: data.role || 'admin', 
      tenant: data.tenant_id ? { 
        id: data.tenant_id, 
        username: data.username,
        name: data.name || data.username,
        role: data.role,
        subscriptionStatus: isExpired ? 'expired' : (tenant?.subscription_status || 'trial'),
        subscriptionExpiresAt: expiresAt,
        customMonthlyPrice: tenant?.custom_monthly_price,
        customQuarterlyPrice: tenant?.custom_quarterly_price,
        customYearlyPrice: tenant?.custom_yearly_price,
        lastPlanType: tenant?.last_plan_type,
        enabledFeatures: tenant?.enabled_features || {
          osTab: true,
          stockTab: true,
          salesTab: true,
          financeTab: true,
          profiles: true,
          xmlExportImport: true,
          hideFinancialReports: false
        },
        maxUsers: tenant?.max_users || 999,
        maxOS: limits?.max_os || 999,
        maxProducts: limits?.max_products || 999,
        printerSize: tenant?.printer_size || 58,
        retentionMonths: tenant?.retention_months || 6
      } : null 
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: "Erro ao realizar login." });
  }
});

app.post('/api/auth/register-tenant', async (req, res) => {
  const { id, storeName, adminUsername, adminPasswordPlain, logoUrl, phoneNumber } = req.body;
  
  try {
    const hashedPassword = await hashPassword(adminPasswordPlain.trim());
    
    const trialDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + trialDays);

    const globalSettings = await OnlineDB.getGlobalSettings();
    const trialLimits = globalSettings.trial || { maxUsers: 1000, maxOS: 1000, maxProducts: 1000 };

    const { error: tError } = await supabase
      .from('tenants')
      .insert([{
        id: id,
        store_name: storeName,
        logo_url: logoUrl,
        created_at: new Date().toISOString(),
        subscription_status: 'trial',
        subscription_expires_at: expiresAt.toISOString(),
        phone_number: phoneNumber,
        enabled_features: {
          osTab: true,
          stockTab: true,
          salesTab: true,
          financeTab: true,
          profiles: true,
          xmlExportImport: true,
          hideFinancialReports: false
        },
        max_users: trialLimits.maxUsers
      }]);
    if (tError) throw tError;

    const { error: limitsError } = await supabase
      .from('tenant_limits')
      .insert([{
        tenant_id: id,
        max_os: trialLimits.maxOS,
        max_products: trialLimits.maxProducts
      }]);
    if (limitsError) throw limitsError;

    const { error: uError } = await supabase
      .from('users')
      .insert([{
        id: 'USR_ADM_' + Math.random().toString(36).substr(2, 5).toUpperCase(),
        username: adminUsername.toLowerCase().trim(),
        password: hashedPassword,
        name: storeName,
        role: 'admin',
        tenant_id: id,
        store_name: storeName,
        photo: logoUrl
      }]);
    if (uError) throw uError;

    res.json({ success: true });
  } catch (e: any) {
    console.error('Register tenant error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/auth/upsert-user', async (req, res) => {
  const { tenantId, storeName, user } = req.body;
  
  try {
    const baseName = user.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
    const username = (user.username || baseName + '_' + Math.random().toString(36).substr(2, 4)).trim().toLowerCase();
    
    let password = user.password || '123456';
    // Only hash if it's not already hashed (though in upsert it's usually plain text from the form)
    if (!password.startsWith('$2a$') && !password.startsWith('$2b$')) {
      password = await hashPassword(password.trim());
    }

    const payload: any = {
      id: user.id,
      username: username,
      name: user.name,
      role: user.role,
      tenant_id: tenantId,
      store_name: storeName,
      photo: user.photo,
      password: password,
      specialty: user.specialty
    };

    const { error } = await supabase
      .from('users')
      .upsert(payload, { onConflict: 'id' });

    if (error) throw error;
    res.json({ success: true, username });
  } catch (e: any) {
    console.error('Upsert user error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/auth/verify-admin', async (req, res) => {
  const { tenantId, password } = req.body;
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('password')
      .eq('tenant_id', tenantId)
      .eq('role', 'admin')
      .maybeSingle();
    
    if (error) throw error;
    if (!data) return res.status(401).json({ success: false, message: "Senha de administrador incorreta." });
    
    const isMatch = await comparePassword(password.trim(), data.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Senha de administrador incorreta." });
    
    res.json({ success: true });
  } catch (err: any) {
    console.error('Verify admin error:', err);
    res.status(500).json({ success: false, message: "Erro ao verificar senha." });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  const { tenantId, oldPassword, newPassword } = req.body;
  
  try {
    // 1. Get the current admin user
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('role', 'admin')
      .maybeSingle();
    
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "Usuário administrador não encontrado." });
    
    // 2. Verify old password
    const isMatch = await comparePassword(oldPassword.trim(), data.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Senha atual incorreta." });
    
    // 3. Hash new password
    const hashedNewPassword = await hashPassword(newPassword.trim());
    
    // 4. Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedNewPassword })
      .eq('id', data.id);
    
    if (updateError) throw updateError;
    
    res.json({ success: true, message: "Senha alterada com sucesso!" });
  } catch (err: any) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: "Erro ao alterar senha." });
  }
});

app.post('/api/auth/change-super-password', async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  
  try {
    // 1. Get the super admin user (role = 'super')
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'super')
      .maybeSingle();
    
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "Super Admin não encontrado." });
    
    // 2. Verify old password
    const isMatch = await comparePassword(oldPassword.trim(), data.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Senha atual incorreta." });
    
    // 3. Hash new password
    const hashedNewPassword = await hashPassword(newPassword.trim());
    
    // 4. Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedNewPassword })
      .eq('id', data.id);
    
    if (updateError) throw updateError;
    
    res.json({ success: true, message: "Senha do Super Admin alterada com sucesso!" });
  } catch (err: any) {
    console.error('Change super password error:', err);
    res.status(500).json({ success: false, message: "Erro ao alterar senha do Super Admin." });
  }
});

app.post('/api/create-preference', async (req, res) => {
  try {
    const { title, unit_price, quantity, tenantId, planType } = req.body;

    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;
    if (!token) {
      return res.status(500).json({ 
        error: 'Token do Mercado Pago não configurado.',
        details: 'Certifique-se de que MERCADO_PAGO_ACCESS_TOKEN ou MP_ACCESS_TOKEN está definida no Vercel/Ambiente.'
      });
    }

    const origin = req.get('origin') || (req.get('referer') ? new URL(req.get('referer') as string).origin : null);
    const host = req.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const fallbackUrl = `${protocol}://${host}`;
    const baseUrl = origin || fallbackUrl;

    const preference = {
      items: [
        {
          id: planType,
          title: title,
          unit_price: Number(unit_price),
          quantity: Number(quantity),
        },
      ],
      back_urls: {
        success: `${baseUrl}/`,
        failure: `${baseUrl}/`,
        pending: `${baseUrl}/`
      },
      auto_return: 'approved' as 'approved',
      external_reference: `${tenantId}|${planType}`
    };

    const client = getMPClient();
    const preferenceClient = new Preference(client);
    console.log('Creating preference for:', { tenantId, planType, unit_price });
    
    const response = await preferenceClient.create({ body: preference });
    console.log('Preference created successfully:', response.id);
    
    res.json({ id: response.id, init_point: response.init_point });

  } catch (error: any) {
    console.error('Error creating Mercado Pago preference:', error);
    const errorMessage = error.message || 'Failed to create payment preference.';
    res.status(500).json({ error: errorMessage, details: error });
  }
});

app.post(['/api/webhook', '/api/webhook/'], async (req, res) => {
  try {
    const payment = req.body;

    if (payment?.type === 'payment' || payment?.action === 'payment.updated') {
      const client = getMPClient();
      const paymentClient = new Payment(client);
      const paymentId = payment?.data?.id || payment?.id;
      
      if (paymentId) {
        const data = await paymentClient.get({ id: paymentId });
        const externalReference = data.external_reference;
        const status = data.status;

        if (externalReference && status === 'approved') {
          const [tenantId, planType] = externalReference.split('|');
          const plans = {
            monthly: 1,
            quarterly: 3,
            yearly: 12
          }

          const months = plans[planType as keyof typeof plans];

          if (months) {
            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + months);

            // Update tenant subscription in your database
            await OnlineDB.updateSubscription(tenantId, months, planType as any);
            console.log(`Subscription updated successfully for tenant ${tenantId}`);
          }
        } else {
          console.log(`Payment ${paymentId} status is ${status}, not updating subscription.`);
        }
      }
    }
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Always return 200 to MercadoPago to acknowledge receipt, even if processing fails
    res.status(200).send('OK');
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    // Serve a basic service worker in dev to prevent MIME type errors if the plugin fails
    app.get('/sw.js', (req, res) => {
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Service-Worker-Allowed', '/');
      res.send(`
        self.addEventListener('install', (event) => {
          self.skipWaiting();
          console.log('Dev SW installed');
        });
        self.addEventListener('activate', (event) => {
          event.waitUntil(self.clients.claim());
          console.log('Dev SW activated');
        });
        self.addEventListener('fetch', (event) => {
          // Pass through requests in dev
        });
      `);
    });

    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        proxy: {}
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: Serve static files from dist
    const distPath = path.join(__dirname, 'dist');
    console.log('Production mode: Serving static files from', distPath);

    // Serve service worker and manifest explicitly to ensure correct MIME types and no caching issues
    // Defined BEFORE express.static to ensure headers are applied
    app.get('/sw.js', (req, res) => {
      console.log('Serving sw.js');
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Service-Worker-Allowed', '/');
      res.sendFile(path.join(distPath, 'sw.js'), (err) => {
        if (err) {
          console.error('Error serving sw.js:', err);
          res.status(404).end();
        }
      });
    });

    app.get('/manifest.webmanifest', (req, res) => {
      console.log('Serving manifest.webmanifest');
      res.setHeader('Content-Type', 'application/manifest+json');
      res.sendFile(path.join(distPath, 'manifest.webmanifest'), (err) => {
        if (err) {
          console.error('Error serving manifest.webmanifest:', err);
          res.status(404).end();
        }
      });
    });

    app.use(express.static(distPath));

    // SPA fallback for production
    app.get(/(.*)/, (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
