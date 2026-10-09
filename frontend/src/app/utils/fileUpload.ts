// Prepara o arquivo escolhido pelo usuário para ir pro servidor (em base64).
// Imagens são reduzidas no navegador (foto de celular pesa vários MB e um comprovante
// não precisa disso); PDF vai como está, com limite de 5 MB.

export const ACCEPTED_FILES = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_INPUT = 20 * 1024 * 1024;  // foto original aceita até 20 MB (depois é reduzida)
const MAX_PDF = 5 * 1024 * 1024;
const MAX_FINAL = 5 * 1024 * 1024;         // tamanho máximo do que vai pro servidor
const SMALL_ENOUGH = 400 * 1024;           // imagem até 400 KB vai sem mexer
const MAX_SIDE = 1600;                     // maior lado da imagem reduzida, em pixels
const QUALITIES = [0.82, 0.7, 0.55];       // tenta qualidades menores se ainda ficar grande

export interface PreparedFile {
  dataUrl: string;
  name: string;
}

// converte o arquivo pra data URL (base64) sem depender de FileReader
async function toDataUrl(blob: Blob, mime: string): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem.')); };
    img.src = url;
  });
}

// redimensiona (maior lado 1600px) e salva como JPEG; fundo branco pra PNG com transparência
async function compressImage(file: Blob): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível processar a imagem.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let smallest: Blob | null = null;
  for (const quality of QUALITIES) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) continue;
    smallest = blob;
    if (blob.size <= MAX_FINAL / 2) break;
  }
  if (!smallest) throw new Error('Não foi possível processar a imagem.');
  return smallest;
}

export async function prepareUpload(file: File): Promise<PreparedFile> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

  if (isPdf) {
    if (file.size > MAX_PDF) throw new Error('PDF muito grande. Máximo: 5 MB.');
    return { dataUrl: await toDataUrl(file, 'application/pdf'), name: file.name };
  }

  if (!IMAGE_TYPES.includes(file.type)) {
    throw new Error('Formato não suportado. Use JPG, PNG, WEBP ou PDF.');
  }
  if (file.size > MAX_IMAGE_INPUT) throw new Error('Imagem muito grande. Máximo: 20 MB.');

  // imagem já pequena: vai como está
  if (file.size <= SMALL_ENOUGH) {
    return { dataUrl: await toDataUrl(file, file.type), name: file.name };
  }

  const compressed = await compressImage(file);
  // se a "reduzida" ficou maior que a original, mantém a original (quando couber)
  if (compressed.size >= file.size && file.size <= MAX_FINAL) {
    return { dataUrl: await toDataUrl(file, file.type), name: file.name };
  }
  if (compressed.size > MAX_FINAL) throw new Error('Não foi possível reduzir a imagem o bastante. Tente outra foto.');
  return {
    dataUrl: await toDataUrl(compressed, 'image/jpeg'),
    name: file.name.replace(/\.[^.]+$/, '') + '.jpg',
  };
}
