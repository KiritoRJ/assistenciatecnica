import React, { useState, useEffect } from 'react';
import { Loader2, Smartphone, AlertTriangle, CheckCircle, Package } from 'lucide-react';

interface Props {
  token: string;
}

const PublicTrackingPage: React.FC<Props> = ({ token }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/os-tracking/${token}`)
      .then(async res => {
        if (!res.ok) {
          const text = await res.text();
          console.error('API Error Response:', text);
          throw new Error(`Erro ${res.status}: Não foi possível localizar esta Ordem de Serviço.`);
        }
        return res.json();
      })
      .then(data => {
        setOrder(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" size={40} /></div>;
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <AlertTriangle className="text-orange-500 mb-4" size={48} />
      <h2 className="text-xl font-bold mb-2">Ops!</h2>
      <p className="text-slate-600 mb-6">{error}</p>
      <a href="https://ticcell.com.br" className="bg-orange-600 text-white px-6 py-3 rounded-xl font-bold">Falar com a TICCELL</a>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-20">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-black text-orange-600">TICCELL</h1>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Acompanhe sua OS</span>
      </header>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">OS #{order.id.split('-')[0]}</h2>
            <p className="text-xs text-slate-500 font-medium">Entrada: {new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
          <span className="bg-orange-100 text-orange-700 text-[10px] font-black uppercase px-3 py-1 rounded-full">{order.status}</span>
        </div>
        
        <div className="space-y-2 text-sm text-slate-700">
          <p><span className="font-bold">Aparelho:</span> {order.deviceBrand} {order.deviceModel}</p>
          <p><span className="font-bold">Serviço:</span> {order.defect}</p>
        </div>
      </div>

      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Andamento</h3>
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        {/* Aqui viria a timeline - simplificado por enquanto */}
        <p className="text-sm font-bold text-slate-700">Status atual: {order.status}</p>
      </div>

      {order.public_notes && (
        <div className="bg-orange-50 rounded-3xl p-6 border border-orange-100 mt-6">
          <h4 className="font-black text-orange-800 text-xs uppercase mb-2">Observação da TICCELL</h4>
          <p className="text-sm text-orange-900">{order.public_notes}</p>
        </div>
      )}
      
      <div className="fixed bottom-6 left-6 right-6">
        <a href={`https://wa.me/5511999999999?text=Olá,%20TICCELL!%20Estou%20acompanhando%20a%20OS%20%23${order.id.split('-')[0]}%20e%20gostaria%20de%20tirar%20uma%20dúvida.`} className="block w-full bg-green-500 text-white text-center py-4 rounded-2xl font-black text-sm shadow-xl shadow-green-500/20">
          Falar com a TICCELL
        </a>
      </div>
    </div>
  );
};

export default PublicTrackingPage;
