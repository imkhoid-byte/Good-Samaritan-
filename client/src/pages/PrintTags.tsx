import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../api';

interface PrintData {
  venueName: string;
  returnInstructions: string | null;
  batch: { id: string; label: string; count: number };
  tags: { code: string; seq: number; claimKey: string }[];
}

interface RenderedTag {
  code: string;
  seq: number;
  itemSvg: string;
  stubSvg: string;
}

type Size = 'standard' | 'compact';

// QR codes are drawn in the browser from the current origin, so printed tags
// always point at the domain the venue is actually using.
async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#111827', light: '#ffffff' } });
}

export default function PrintTags() {
  const { orgId, batchId } = useParams<{ orgId: string; batchId: string }>();
  const [data, setData] = useState<PrintData | null>(null);
  const [tags, setTags] = useState<RenderedTag[]>([]);
  const [size, setSize] = useState<Size>('standard');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<PrintData>(`/api/orgs/${orgId}/batches/${batchId}/print`);
        setData(data);
        const origin = window.location.origin;
        setTags(await Promise.all(data.tags.map(async t => ({
          code: t.code,
          seq: t.seq,
          itemSvg: await qrSvg(`${origin}/t/${t.code}`),
          stubSvg: await qrSvg(`${origin}/t/${t.code}?k=${t.claimKey}`)
        }))));
      } catch {
        setError('Could not load this batch.');
      }
    })();
  }, [orgId, batchId]);

  if (error) return <div className="text-center py-20 text-red-600">{error}</div>;
  if (!data || tags.length === 0) return <div className="text-center py-20 text-gray-400">Preparing tags…</div>;

  const compact = size === 'compact';

  return (
    <div className="bg-gray-100 min-h-screen print:bg-white">
      <style>{`
        @page { size: letter; margin: 0.35in; }
        @media print { .tag-pair { break-inside: avoid; } }
        .qr svg { width: 100%; height: 100%; display: block; }
      `}</style>

      <div className="print:hidden bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="min-w-0">
            <Link to={`/venues/${orgId}`} className="text-sm text-gray-500 hover:text-gray-700">← {data.venueName}</Link>
            <h1 className="font-semibold text-gray-900 truncate">{data.batch.label} · {data.batch.count} tags</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
              {(['standard', 'compact'] as Size[]).map(s => (
                <button key={s} onClick={() => setSize(s)}
                  className={`px-3 py-1.5 capitalize ${size === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}>
                  {s}
                </button>
              ))}
            </div>
            <button onClick={() => window.print()} className="btn-primary text-sm">🖨 Print</button>
          </div>
        </div>
        <p className="max-w-5xl mx-auto px-4 pb-3 text-xs text-gray-500">
          Cut along the dashed lines. The left half goes on the item; the guest keeps the stub on the right and scans it to link the tag to their phone.
          Works on plain paper, cardstock or full-sheet sticker paper.
        </p>
      </div>

      <div className={`max-w-[8in] mx-auto bg-white p-4 print:p-0 grid gap-0 ${compact ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {tags.map(t => (
          <div key={t.code} className="tag-pair flex border border-dashed border-gray-400" style={{ height: compact ? '1.6in' : '2in' }}>
            {/* Item side: anyone can scan to report it found */}
            <div className="flex-1 flex flex-col items-center justify-center px-2 py-1.5 text-center min-w-0">
              <p className={`font-extrabold text-gray-900 leading-none ${compact ? 'text-base' : 'text-xl'}`}>#{t.seq}</p>
              <div className="qr my-1" style={{ width: compact ? '0.8in' : '1.05in', height: compact ? '0.8in' : '1.05in' }} dangerouslySetInnerHTML={{ __html: t.itemSvg }} />
              <p className={`font-bold text-gray-900 leading-tight ${compact ? 'text-[7px]' : 'text-[9px]'}`}>FOUND THIS? SCAN ME</p>
              <p className={`text-gray-500 leading-tight truncate w-full ${compact ? 'text-[6px]' : 'text-[8px]'}`}>{data.venueName}</p>
            </div>
            <div className="border-l border-dashed border-gray-400" />
            {/* Stub: carries the claim key, so only the guest holding it can link the tag */}
            <div className="flex-1 flex flex-col items-center justify-center px-2 py-1.5 text-center min-w-0">
              <p
                className={`font-extrabold text-white bg-gray-900 rounded px-2 leading-tight ${compact ? 'text-sm' : 'text-lg'}`}
                style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
              >
                GUEST #{t.seq}
              </p>
              <div className="qr my-1" style={{ width: compact ? '0.8in' : '1.05in', height: compact ? '0.8in' : '1.05in' }} dangerouslySetInnerHTML={{ __html: t.stubSvg }} />
              <p className={`font-bold text-green-800 leading-tight ${compact ? 'text-[7px]' : 'text-[9px]'}`}>KEEP · SCAN FOR ALERTS</p>
              <p className={`text-gray-500 font-mono leading-tight ${compact ? 'text-[6px]' : 'text-[8px]'}`}>{t.code.slice(0, 4)}-{t.code.slice(4)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
