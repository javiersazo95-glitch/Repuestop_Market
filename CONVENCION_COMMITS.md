# Convención de Commits — RepuesTop Market

Para mantener un historial de Git limpio, legible y consistente entre todos los agentes y desarrolladores, todos los commits deben seguir la especificación **Conventional Commits** con descripciones **siempre en español**.

---

## 1. Estructura del Mensaje

```
tipo(ámbito): descripción en español
```

* **tipo**: Palabra clave obligatoria en minúsculas que describe la intención del cambio.
* **(ámbito)**: Componente, módulo o vista afectada (opcional pero muy recomendado). Ejemplos: `(catalogo)`, `(tienda)`, `(producto)`, `(auth)`, `(mediacion)`, `(checkout)`, `(anuncios)`, `(perfil)`.
* **descripción**: Resumen conciso en tiempo presente / infinitivo, en minúsculas y sin punto final, redactado **siempre en español**.

---

## 2. Tipos de Commit Permitidos

| Tipo | Propósito | Ejemplo |
|---|---|---|
| **`feat`** | Una nueva funcionalidad para el usuario. | `feat(catalogo): implementar busqueda por catalogo de vehiculo 1:1 con app movil` |
| **`fix`** | Una corrección de un error, bug o fallo visual. | `fix(producto): corregir cierre de modal de compatibilidades tecnicas` |
| **`docs`** | Cambios exclusivos en la documentación. | `docs(paridad): actualizar estado de paridad a16 en handoff` |
| **`style`** | Cambios de estilo y formato visual o de código (CSS, espaciado, colores) sin alterar la lógica de negocio. | `style(catalogo): rediseñar consola de patente y filtro de comuna a 44px` |
| **`refactor`** | Reestructuración de código que no corrige errores ni añade nuevas funcionalidades. | `refactor(vehiculo): centralizar validacion de patentes chilenas en vehicleLookup` |
| **`perf`** | Cambios que mejoran el rendimiento o la velocidad de carga. | `perf(imagenes): optimizar compresion asincrona antes de subir a r2` |
| **`test`** | Agregar o corregir pruebas unitarias, de integración o e2e. | `test(auth): agregar pruebas de validacion de rut chileno` |
| **`chore`** | Tareas de mantenimiento, actualización de dependencias, scripts de build o configuraciones. | `chore(oxlint): actualizar configuracion de reglas de linter` |

---

## 3. Reglas Estrictas

1. **Idioma**: La descripción debe estar **100% en español**.
2. **Petición del usuario**: NUNCA ejecutar `git commit` ni `git push` a menos que el usuario lo solicite explícitamente en su mensaje.
3. **Verificación previa obligatoria**: Antes de hacer commit, siempre deben pasar:
   * `npm run lint` (**0 errores**).
   * `npm run build` (**Compilación limpia**).
