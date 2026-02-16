
// Exemplo de Backend Serverless (Vercel)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Apenas POST' });

  const { username, passwordHash } = req.body;

  // Garantir tratamento robusto dos dados recebidos
  const cleanUsername = (username || "").trim().toLowerCase();
  const cleanPassHash = (passwordHash || "").trim();

  // Credenciais fixas do Super Admin
  const superUser = 'wandev';
  const superPassHash = Buffer.from('wan123').toString('base64');

  if (cleanUsername === superUser && cleanPassHash === superPassHash) {
    return res.status(200).json({ success: true, type: 'super' });
  }

  // Aqui você conectaria ao seu banco PostgreSQL/Supabase
  // Por enquanto, simulamos uma resposta de erro ou sucesso
  return res.status(200).json({ 
    success: false, 
    message: "Credenciais incorretas ou banco de dados não configurado para usuários normais." 
  });
}
