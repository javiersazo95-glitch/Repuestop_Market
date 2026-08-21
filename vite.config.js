import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// El build de Vercel corre sobre un clone superficial con HEAD desacoplado, asi que
// `git branch --show-current` devuelve vacio y el fallback caia en 'dev' sin avisar:
// el panel de vendedores apuntaba a dev-inventario.repuestop.cl en produccion.
// VERCEL_GIT_COMMIT_REF trae la rama real del deploy.
const getDeployBranch = () => {
  if (process.env.VITE_DEPLOY_BRANCH) return process.env.VITE_DEPLOY_BRANCH
  if (process.env.VERCEL_GIT_COMMIT_REF) return process.env.VERCEL_GIT_COMMIT_REF
  if (process.env.GITHUB_REF_NAME) return process.env.GITHUB_REF_NAME

  try {
    return execSync('git branch --show-current', { encoding: 'utf8' }).trim() || 'dev'
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __DEPLOY_BRANCH__: JSON.stringify(getDeployBranch()),
  },
})
