# Sistema de Gestão de Obras — Front-end

Interface web do sistema de gestão de obras, construída em React + Vite +
TypeScript + Tailwind CSS.

## Rodando o projeto

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

Configure a URL da API em `.env` (`VITE_API_BASE`) apontando para o
back-end — veja o `README.md` da pasta `backend/` para subir a API.

## Build de produção

```bash
npm run build
```

Gera os arquivos estáticos em `dist/`.

## Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- Recharts (gráficos)
- React Router
