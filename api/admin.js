
export default async function handler(req, res) {
  const { method, query, body } = req;

  if (method === 'POST') {
    const { tenantData } = body;
    // Salvar novo ADM no banco
    return res.status(200).json({ success: true });
  }

  if (method === 'GET') {
    // Listar todos os ADMs
    return res.status(200).json({ success: true, data: [] });
  }

  return res.status(405).end();
}
