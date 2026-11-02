import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';

interface Message {
  id: string;
  senderName: string;
  senderEmail: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface ItemDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  qrCode: string;
  rewardOffered: number;
  rewardNote: string;
  createdAt: string;
  foundAt: string | null;
  foundUrl: string;
  messages: Message[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  lost: { label: 'Lost', color: 'bg-red-100 text-red-700' },
  returned: { label: 'Returned', color: 'bg-blue-100 text-blue-700' },
  inactive: { label: 'Inactive', color: 'bg-gray-100 text-gray-500' }
};

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [printReady, setPrintReady] = useState(false);

  useEffect(() => {
    fetchItem();
  }, [id]);

  async function fetchItem() {
    try {
      const { data } = await api.get(`/api/items/${id}`);
      setItem(data);
    } catch {
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(status: string) {
    await api.patch(`/api/items/${id}/status`, { status });
    fetchItem();
  }

  function downloadQR() {
    if (!item?.qrCode) return;
    const link = document.createElement('a');
    link.href = item.qrCode;
    link.download = `good-samaritan-${item.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.click();
  }

  function printQR() {
    setPrintReady(true);
    setTimeout(() => {
      window.print();
      setPrintReady(false);
    }, 100);
  }

  function copyLink() {
    navigator.clipboard.writeText(item?.foundUrl || '');
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (!item) return null;

  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.active;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back */}
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        ← Back to Dashboard
      </Link>

      <div className="grid md:grid-cols-2 gap-6">
        {/* QR Code card */}
        <div className="card p-6 text-center">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">QR Code Tag</h2>
            <span className={`badge ${statusCfg.color}`}>{statusCfg.label}</span>
          </div>

          {item.qrCode && (
            <div className="bg-white border-2 border-gray-200 rounded-xl p-4 inline-block mb-4">
              <img src={item.qrCode} alt="QR Code" className="w-48 h-48 mx-auto" />
              <p className="text-xs text-gray-500 mt-2 font-medium">Good Samaritan</p>
              <p className="text-xs text-gray-400 truncate max-w-[180px] mx-auto">{item.name}</p>
            </div>
          )}

          <div className="space-y-2 mb-5">
            <button onClick={downloadQR} className="btn-primary w-full text-sm">
              ⬇ Download QR Code
            </button>
            <button onClick={printQR} className="btn-secondary w-full text-sm">
              🖨 Print QR Tag
            </button>
            <button onClick={copyLink} className="btn-secondary w-full text-sm">
              🔗 Copy Finder Link
            </button>
          </div>

          <p className="text-xs text-gray-400">
            Attach this QR code to your item. When scanned, finders are taken to a secure page to contact you.
          </p>
        </div>

        {/* Item details */}
        <div className="space-y-4">
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Item Details</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Name</dt>
                <dd className="text-gray-900 font-medium mt-0.5">{item.name}</dd>
              </div>
              {item.description && (
                <div>
                  <dt className="text-xs text-gray-400 uppercase tracking-wide">Description</dt>
                  <dd className="text-gray-700 mt-0.5">{item.description}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Category</dt>
                <dd className="text-gray-700 capitalize mt-0.5">{item.category}</dd>
              </div>
              {item.rewardOffered > 0 && (
                <div>
                  <dt className="text-xs text-gray-400 uppercase tracking-wide">Reward</dt>
                  <dd className="text-amber-700 font-medium mt-0.5">
                    ${item.rewardOffered} {item.rewardNote && `— ${item.rewardNote}`}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Registered</dt>
                <dd className="text-gray-700 mt-0.5">{new Date(item.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>

          {item.status === 'returned' && (
            <div className="card p-5 bg-green-50 border-green-200">
              <h3 className="text-sm font-semibold text-green-800">It came home! 🎉</h3>
              <p className="text-sm text-green-700 mt-1">Thank your Good Samaritan publicly and inspire others.</p>
              <Link to={`/community?item=${item.id}`} className="inline-block mt-3 text-sm font-medium text-green-700 hover:underline">
                Share your story (+20 points) →
              </Link>
            </div>
          )}

          {/* Status actions */}
          {item.status !== 'returned' && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Update Status</h3>
              <div className="flex gap-2 flex-wrap">
                {item.status !== 'lost' ? (
                  <button onClick={() => updateStatus('lost')} className="btn-secondary text-sm px-4 py-2 text-red-600 border-red-200">
                    Mark as Lost
                  </button>
                ) : (
                  <button onClick={() => updateStatus('active')} className="btn-secondary text-sm px-4 py-2">
                    Mark as Found
                  </button>
                )}
                <button onClick={() => updateStatus('returned')} className="btn-primary text-sm px-4 py-2">
                  Mark as Returned ✓
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="mt-6 card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">
          Messages from Finders
          {item.messages.length > 0 && (
            <span className="ml-2 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
              {item.messages.length}
            </span>
          )}
        </h2>
        {item.messages.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-3xl mb-2">📭</div>
            <p className="text-sm">No messages yet. Attach the QR code to your item and wait for a Good Samaritan!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {item.messages.map(msg => (
              <div key={msg.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="font-semibold text-gray-900">{msg.senderName}</span>
                    <a href={`mailto:${msg.senderEmail}`} className="ml-2 text-sm text-green-600 hover:underline">
                      {msg.senderEmail}
                    </a>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(msg.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-700">{msg.content}</p>
                <a
                  href={`mailto:${msg.senderEmail}?subject=Re: Your message about ${item.name}`}
                  className="inline-block mt-3 text-sm text-green-600 font-medium hover:underline"
                >
                  Reply by Email →
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Print styles */}
      {printReady && (
        <style>{`
          @media print {
            body > *:not(#root) { display: none; }
            nav, .btn-primary, .btn-secondary, a[href="/dashboard"] { display: none !important; }
          }
        `}</style>
      )}
    </div>
  );
}
