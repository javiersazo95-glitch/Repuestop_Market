import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BASE_TITLE, SEO_PAGES, SITE_URL, titleWithBrand } from './src/routes/seoPages.js'

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

const escapeAttr = (value) => value
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Reemplaza una etiqueta del index.html y corta el build si ya no existe: un cambio en
// la cabecera no puede dejar en silencio paginas con el canonical del inicio.
const replaceTag = (html, pattern, replacement, label) => {
  if (!pattern.test(html)) throw new Error(`paginasIndexables: no se encontro ${label} en index.html`)
  return html.replace(pattern, replacement)
}

const TAGS = {
  title: /<title>[^<]*<\/title>/,
  description: /<meta name="description" content="[^"]*" \/>/,
  canonical: /\s*<link rel="canonical" href="[^"]*" \/>/,
  ogUrl: /\s*<meta property="og:url" content="[^"]*" \/>/,
  ogTitle: /<meta property="og:title" content="[^"]*" \/>/,
  ogDescription: /<meta property="og:description" content="[^"]*" \/>/,
}

// Ver src/routes/seoPages.js. Escribe dist/<ruta>/index.html por cada pagina indexable y
// dist/app.html (sin canonical ni og:url) para el resto de las rutas de la SPA, que antes
// heredaban el canonical del inicio.
const paginasIndexables = () => {
  let outDir = 'dist'
  return {
    name: 'paginas-indexables',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir },
    closeBundle() {
      // vercel.json no admite comentarios ni importar la lista: se verifica aqui que cada
      // pagina tenga su rewrite, o Vercel le serviria app.html sin canonical.
      const rewrites = JSON.parse(readFileSync('vercel.json', 'utf8')).rewrites
        .filter((rule) => rule.source !== '/(.*)')
        .map((rule) => new RegExp(`^${rule.source}$`))
      const sinRewrite = SEO_PAGES.filter((page) => page.path !== '/' && !rewrites.some((re) => re.test(page.path)))
      if (sinRewrite.length) {
        throw new Error(`paginasIndexables: falta el rewrite en vercel.json de ${sinRewrite.map((page) => page.path).join(', ')}`)
      }
      const template = readFileSync(join(outDir, 'index.html'), 'utf8')
      if (!template.includes(`<title>${BASE_TITLE}</title>`)) {
        throw new Error('paginasIndexables: el <title> de index.html no coincide con BASE_TITLE de seoPages.js')
      }
      for (const page of SEO_PAGES) {
        if (page.path === '/') continue
        const title = escapeAttr(titleWithBrand(page.title))
        const description = escapeAttr(page.description)
        const url = `${SITE_URL}${page.path}`
        let html = template
        html = replaceTag(html, TAGS.title, `<title>${title}</title>`, 'el <title>')
        html = replaceTag(html, TAGS.description, `<meta name="description" content="${description}" />`, 'la descripcion')
        html = replaceTag(html, TAGS.canonical, `\n    <link rel="canonical" href="${url}" />`, 'el canonical')
        html = replaceTag(html, TAGS.ogUrl, `\n    <meta property="og:url" content="${url}" />`, 'og:url')
        html = replaceTag(html, TAGS.ogTitle, `<meta property="og:title" content="${title}" />`, 'og:title')
        html = replaceTag(html, TAGS.ogDescription, `<meta property="og:description" content="${description}" />`, 'og:description')
        const dir = join(outDir, ...page.path.split('/').filter(Boolean))
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, 'index.html'), html)
      }
      // El sitemap sale de la misma lista: antes listaba /repuestos y /tiendas, que el
      // robots.txt bloquea, y Search Console lo marcaba como contradiccion.
      const lastmod = new Date().toISOString().slice(0, 10)
      const urls = SEO_PAGES.map((page) => `  <url>\n    <loc>${SITE_URL}${page.path}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
      writeFileSync(join(outDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Generado por paginasIndexables (vite.config.js) desde src/routes/seoPages.js. -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`)
      let app = replaceTag(template, TAGS.canonical, '', 'el canonical')
      app = replaceTag(app, TAGS.ogUrl, '', 'og:url')
      writeFileSync(join(outDir, 'app.html'), app)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), paginasIndexables()],
  define: {
    __DEPLOY_BRANCH__: JSON.stringify(getDeployBranch()),
  },
})
