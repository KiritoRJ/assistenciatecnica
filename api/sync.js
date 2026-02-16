
export default async function handler(req, res) {
  const { method, query, body } = req;

  if (method === 'POST') {
    const { tenantId, store, data } = body;
    console.log(`Recebido backup para ${tenantId} - ${store}`);
    // Aqui você faria: INSERT INTO cloud_data ... ON CONFLICT UPDATE ...
    return res.status(200).json({ success: true });
  }

  if (method === 'GET') {
    const { tenantId, store } = query;
    // Aqui você faria: SELECT data_json FROM cloud_data WHERE ...
    return res.status(200).json({ success: true, data: null });
  }

  return res.status(405).end();
}
