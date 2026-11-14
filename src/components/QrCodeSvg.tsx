import React, { useMemo } from 'react';
import { getQrMatrix } from '../utils/qrService';

interface QrCodeSvgProps {
  value: string;
  size?: number;
  color?: string;
}

export function QrCodeSvg({ value, size = 88, color = '#26478D' }: QrCodeSvgProps) {
  const matrix = useMemo(() => getQrMatrix(value), [value]);
  const quiet = 2;
  const totalModules = matrix.size + quiet * 2;
  const cell = size / totalModules;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="bg-white rounded-xl border border-slate-200 shrink-0 shadow-xs"
      aria-label="Scannable QR Code"
    >
      <rect width={size} height={size} fill="#FFFFFF" />
      {matrix.modules.map((row, r) =>
        row.map((active, c) =>
          active ? (
            <rect
              key={`${r}-${c}`}
              x={(c + quiet) * cell}
              y={(r + quiet) * cell}
              width={cell + 0.15}
              height={cell + 0.15}
              fill={color}
            />
          ) : null
        )
      )}
    </svg>
  );
}
