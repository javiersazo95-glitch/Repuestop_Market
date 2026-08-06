import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

const getDeployBranch = () => {
  if (process.env.VITE_DEPLOY_BRANCH) return process.env.VITE_DEPLOY_BRANCH
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
