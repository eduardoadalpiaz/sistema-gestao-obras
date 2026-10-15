// Preparação dos testes: comandos extras de conferência (jest-dom) e limpeza entre um teste e outro.
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// O navegador simulado (jsdom) ainda não tem Blob.arrayBuffer, que o navegador de verdade tem.
if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function (this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result as ArrayBuffer);
      leitor.onerror = () => reject(leitor.error ?? new Error('falha ao ler o arquivo'));
      leitor.readAsArrayBuffer(this);
    });
  };
}
