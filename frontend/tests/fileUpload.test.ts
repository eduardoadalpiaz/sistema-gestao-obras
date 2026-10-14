// Preparação de anexos: tipos aceitos, limites de tamanho e conversão para base64.
import { describe, test, expect } from 'vitest';
import { prepareUpload, ACCEPTED_FILES } from '../src/app/utils/fileUpload';

const arquivo = (bytes: number, nome: string, tipo: string) =>
  new File([new Uint8Array(bytes)], nome, { type: tipo });

describe('prepareUpload', () => {
  test('PDF pequeno vai como está, em base64', async () => {
    const r = await prepareUpload(new File(['%PDF-1.4 teste'], 'alvara.pdf', { type: 'application/pdf' }));
    expect(r.name).toBe('alvara.pdf');
    expect(r.dataUrl.startsWith('data:application/pdf;base64,')).toBe(true);
    expect(atob(r.dataUrl.split(',')[1])).toBe('%PDF-1.4 teste');
  });

  test('reconhece PDF pela extensão mesmo sem o tipo', async () => {
    const r = await prepareUpload(new File(['%PDF'], 'laudo.PDF', { type: '' }));
    expect(r.dataUrl.startsWith('data:application/pdf')).toBe(true);
  });

  test('recusa PDF acima de 5 MB', async () => {
    await expect(prepareUpload(arquivo(5 * 1024 * 1024 + 1, 'grande.pdf', 'application/pdf')))
      .rejects.toThrow(/PDF muito grande/);
  });

  test('recusa formatos que não são imagem nem PDF', async () => {
    await expect(prepareUpload(arquivo(10, 'planilha.xlsx', 'application/vnd.ms-excel')))
      .rejects.toThrow(/Formato não suportado/);
    await expect(prepareUpload(arquivo(10, 'desenho.svg', 'image/svg+xml')))
      .rejects.toThrow(/Formato não suportado/);
  });

  test('recusa foto acima de 20 MB', async () => {
    await expect(prepareUpload(arquivo(20 * 1024 * 1024 + 1, 'foto.jpg', 'image/jpeg')))
      .rejects.toThrow(/Imagem muito grande/);
  });

  test('imagem pequena (até 400 KB) vai sem ser reduzida', async () => {
    const r = await prepareUpload(arquivo(1000, 'nota.png', 'image/png'));
    expect(r.name).toBe('nota.png');
    expect(r.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });

  test('lista de tipos aceitos no seletor de arquivos', () => {
    expect(ACCEPTED_FILES).toContain('application/pdf');
    expect(ACCEPTED_FILES).toContain('image/jpeg');
    expect(ACCEPTED_FILES).not.toContain('svg');
  });
});
