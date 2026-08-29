import { forwardRef } from 'react';
import {
  getBalanceShareMeta,
  type AccountBalanceRow,
  type BalanceSharePayload,
  type DailyOperationRow,
  type FundBalanceRow,
} from '../lib/balanceShare';

const TONE_COLOR = {
  positive: '#34d399',
  negative: '#fb7185',
  neutral: '#94a3b8',
} as const;

function OperationsBlock({
  title,
  operations,
  emptyText,
  titleColor = '#94a3b8',
  borderColor = '#334155',
}: {
  title: string;
  operations: DailyOperationRow[];
  emptyText: string;
  titleColor?: string;
  borderColor?: string;
}) {
  return (
    <div style={{ padding: '16px 22px 22px', borderTop: '1px solid #334155' }}>
      <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: titleColor }}>{title}</p>
      {operations.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: '#64748b', textAlign: 'center' }}>{emptyText}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {operations.map((op, index) => (
            <div
              key={`${op.description}-${index}`}
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: '#1e293b',
                border: `1px solid ${borderColor}`,
              }}
            >
              <p style={{ margin: '0 0 6px', fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>{op.description}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                {op.lines.map((line, lineIndex) => (
                  <span
                    key={lineIndex}
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: TONE_COLOR[line.tone],
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {line.text}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  payload: BalanceSharePayload;
}

export const BalanceShareCard = forwardRef<HTMLDivElement, Props>(function BalanceShareCard({ payload }, ref) {
  const meta = getBalanceShareMeta(payload);
  const isFund = payload.kind === 'fund';
  const showCurrencyColumn = meta.statementRows.some((r, i, arr) =>
    i > 0 && arr[i - 1].currencyLabel !== r.currencyLabel,
  ) || new Set(meta.statementRows.map(r => r.currencyLabel)).size > 1;

  return (
    <div
      ref={ref}
      dir="rtl"
      lang="ar"
      style={{
        width: 420,
        background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)',
        color: '#f8fafc',
        fontFamily: 'Tahoma, "Segoe UI", Arial, sans-serif',
        borderRadius: 20,
        border: '2px solid #334155',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid #334155' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fbbf24', lineHeight: 1.4 }}>{meta.title}</h1>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#cbd5e1' }}>{meta.subtitle}</p>
      </div>

      <div style={{ padding: '16px 22px 18px', borderBottom: '1px solid #334155' }}>
        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>الرصيد</p>
        {meta.rows.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: '#94a3b8', textAlign: 'center' }}>{meta.emptyText}</p>
        ) : isFund ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(meta.rows as FundBalanceRow[]).map(row => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: '#1e293b',
                  border: `1px solid ${TONE_COLOR[row.tone]}33`,
                }}
              >
                <span style={{ fontSize: 14, color: '#e2e8f0' }}>{row.label}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: TONE_COLOR[row.tone], fontVariantNumeric: 'tabular-nums' }}>
                    {row.amount}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(meta.rows as AccountBalanceRow[]).map(row => (
              <div
                key={row.label}
                style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: '#1e293b',
                  border: '1px solid #334155',
                }}
              >
                <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{row.label}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div>
                    <p style={{ margin: 0, color: '#94a3b8' }}>{row.receiptsLabel}</p>
                    <p style={{ margin: '4px 0 0', color: '#34d399', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{row.receipts}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, color: '#94a3b8' }}>{row.paymentsLabel}</p>
                    <p style={{ margin: '4px 0 0', color: '#fb7185', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{row.payments}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, color: '#94a3b8' }}>{row.balanceLabel}</p>
                    <p style={{ margin: '4px 0 0', color: TONE_COLOR[row.balanceTone], fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{row.balance}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isFund && meta.statementRows.length > 0 && (
        <div style={{ padding: '16px 22px 18px', borderTop: '1px solid #334155' }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>كشف الحركات</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '6px 4px', textAlign: 'right' }}>التاريخ</th>
                {showCurrencyColumn && <th style={{ padding: '6px 4px', textAlign: 'right' }}>العملة</th>}
                <th style={{ padding: '6px 4px', textAlign: 'right' }}>البيان</th>
                <th style={{ padding: '6px 4px', textAlign: 'right' }}>مدين (عليه)</th>
                <th style={{ padding: '6px 4px', textAlign: 'right' }}>دائن (له)</th>
                <th style={{ padding: '6px 4px', textAlign: 'right' }}>الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {meta.statementRows.map((row, index) => (
                <tr
                  key={`${row.date}-${row.description}-${index}`}
                  style={{
                    borderBottom: '1px solid #1e293b',
                    background: row.isOpening ? '#1e3a5f22' : row.reconciled ? '#064e3b15' : 'transparent',
                  }}
                >
                  <td style={{ padding: '6px 4px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{row.date}</td>
                  {showCurrencyColumn && (
                    <td style={{ padding: '6px 4px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{row.currencyLabel}</td>
                  )}
                  <td style={{ padding: '6px 4px', color: row.isOpening ? '#7dd3fc' : '#e2e8f0', lineHeight: 1.4 }}>
                    {row.description}
                    {row.note && <span style={{ display: 'block', fontSize: 10, color: '#64748b' }}>{row.note}</span>}
                  </td>
                  <td style={{ padding: '6px 4px', color: '#fb7185', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {row.debit ?? '—'}
                  </td>
                  <td style={{ padding: '6px 4px', color: '#34d399', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {row.credit ?? '—'}
                  </td>
                  <td style={{ padding: '6px 4px', color: '#f8fafc', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {row.balance}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isFund && (
        <>
          <OperationsBlock
            title="عمليات اليوم"
            operations={meta.operations as DailyOperationRow[]}
            emptyText={meta.operationsEmptyText}
          />
          <OperationsBlock
            title="قيد الانتظار"
            operations={meta.pendingOperations as DailyOperationRow[]}
            emptyText={meta.pendingOperationsEmptyText}
            titleColor="#fbbf24"
            borderColor="#fbbf2444"
          />
        </>
      )}
    </div>
  );
});
