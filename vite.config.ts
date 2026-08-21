import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'node:path';

// Módulos que devem ser resolvidos em runtime (não bundled no main.cjs).
// - 'pg' e drivers nativos: precisam de bindings C
// - 'embedded-postgres': ESM puro, carregado via dynamic import();
//   os binários por plataforma (@embedded-postgres/win32-x64, etc.) também
//   ficam externos porque não fazem sentido bundle-ar
// - 'serialport', 'node-thermal-printer': nativos
//
// A função checa tanto o specifier "cru" (`pg`, `embedded-postgres/dist/binary`)
// quanto o caminho já resolvido pelo Rollup (`.../node_modules/pg/lib/index.js`).
// Sem isso, quando outro plugin resolve o import antes, o pacote é bundlado
// mesmo estando listado como external.
const EXTERNAL_PACKAGES = [
  'electron',
  'pg',
  'pg-native',
  'embedded-postgres',
  'serialport',
  'node-thermal-printer',
  'bcryptjs',
];

const isElectronExternal = (id: string) => {
  const normalized = id.replace(/\\/g, '/');
  if (normalized.startsWith('@embedded-postgres/')) return true;
  if (/[\\/]node_modules[\\/]@embedded-postgres[\\/]/.test(normalized)) return true;
  for (const pkg of EXTERNAL_PACKAGES) {
    if (normalized === pkg || normalized.startsWith(pkg + '/')) return true;
    if (normalized.includes(`/node_modules/${pkg}/`)) return true;
  }
  return false;
};

// `@embedded-postgres/*` são optionalDependencies — cada plataforma só instala
// o binário dela. Quando o Rollup atravessa `embedded-postgres/dist/binary.js`
// vê imports para todas as plataformas e falha ao resolver as ausentes.
// Plugin resolve tudo pra um módulo vazio; como o pacote inteiro é external,
// esse stub nunca é executado — só serve pra passar o build.
const stubMissingEmbeddedPgPlatforms = () => {
  const STUB_PREFIX = '\0embedded-pg-stub:';
  return {
    name: 'stub-missing-embedded-pg-platforms',
    enforce: 'pre' as const,
    resolveId(source: string) {
      if (source.startsWith('@embedded-postgres/')) {
        return STUB_PREFIX + source;
      }
      return null;
    },
    load(id: string) {
      if (id.startsWith(STUB_PREFIX)) {
        return 'export default {};';
      }
      return null;
    },
  };
};

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          plugins: [stubMissingEmbeddedPgPlatforms()],
          build: {
            outDir: 'dist-electron',
            emptyOutDir: false,
            lib: {
              entry: 'electron/main.ts',
              formats: ['cjs'],
              fileName: () => 'main.cjs',
            },
            rollupOptions: {
              external: isElectronExternal,
              output: { format: 'cjs', entryFileNames: 'main.cjs' },
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          plugins: [stubMissingEmbeddedPgPlatforms()],
          build: {
            outDir: 'dist-electron',
            emptyOutDir: false,
            lib: {
              entry: 'electron/preload.ts',
              formats: ['cjs'],
              fileName: () => 'preload.cjs',
            },
            rollupOptions: {
              external: isElectronExternal,
              output: { format: 'cjs', entryFileNames: 'preload.cjs', inlineDynamicImports: true },
            },
          },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@electron': path.resolve(__dirname, './electron'),
    },
  },
  server: {
    port: 5173,
  },
});
