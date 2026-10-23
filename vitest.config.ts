// Runs renderer behavior tests against the desktop browser environment.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({plugins:[react()],resolve:{alias:{'@/components/ui':resolve('src/renderer/src/shared/ui'),'@/lib/utils':resolve('src/renderer/src/shared/ui/utils.ts'),'@':resolve('src/renderer/src'),'@test':resolve('tests/renderer'),'next/navigation':resolve('src/renderer/src/shared/lib/browser-navigation.tsx')}},test:{include:['src/renderer/**/*.test.{ts,tsx}','tests/renderer/**/*.test.{ts,tsx}'],environment:'jsdom',setupFiles:'./tests/renderer/setup.ts',css:true,maxWorkers:1,fileParallelism:false,testTimeout:20000}});
