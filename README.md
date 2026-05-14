# Ofrenda budista de agua

Aplicacion web 3D para practicar una ofrenda budista de agua con boles de cristal transparentes, una jarra para llenar, un cubo para vaciar y un pano para secar.

## Funciones actuales

- Escena 3D con mesa, habitacion, boles transparentes y agua visible.
- Selector de modo: llenar o vaciar.
- Configuracion de filas y boles por fila.
- Proceso por clics:
  - Llenar: 4 clics por bol.
  - Vaciar: tomar el bol, vaciarlo en el cubo, secarlo y recolocarlo.
- Control de camara con raton: arrastrar para girar y rueda para acercar.
- Preparado para publicar como GitHub Pages.

## Desarrollo local

```bash
npm install
npm run dev
```

Despues abre la URL que muestre Vite, normalmente `http://localhost:5173`.

## Compilar

```bash
npm run build
```

El resultado se genera en `dist/`.

## Publicar en GitHub Pages

Este proyecto incluye un workflow en `.github/workflows/pages.yml`.

Pasos recomendados:

1. Crear un repositorio en GitHub.
2. Hacer commit de estos archivos.
3. Anadir el remoto con `git remote add origin URL_DEL_REPO`.
4. Subir con `git push -u origin main`.
5. En GitHub, activar Pages desde `Settings > Pages > Source > GitHub Actions`.

Cada push a `main` ejecutara `npm ci`, `npm run build` y publicara la web.
