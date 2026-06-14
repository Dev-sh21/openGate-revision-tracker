'use strict';
'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'bg-zinc-900 text-zinc-100 border border-zinc-800',
          duration: 3000,
          style: {
            background: '#18181b',
            color: '#f4f4f5',
            border: '1px solid #27272a',
          },
        }}
      />
      {children}
    </SessionProvider>
  );
}
