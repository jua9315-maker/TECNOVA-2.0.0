<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# TECNOVA

Sistema de escritorio para inventario, punto de venta, garantías, reparaciones y reportes.

## Desarrollo local

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm ci`
2. Copy `.env.example` to `.env.local` and add any API keys required by enabled integrations.
3. Run the web app:
   `npm run dev`
4. Validate types and build:
   `npm run lint`
   `npm run build`

## Windows desktop releases and updates

The installed Windows app checks the public GitHub Releases page for updates after startup and then every six hours. When a new version is available, TECNOVA asks before downloading it. After the download, choose **Reiniciar ahora** to install it; choosing **Más tarde** defers the restart.

To publish a release:

1. Make sure the changes are pushed to `main`.
2. In GitHub Actions, run **Generar Instalador Windows (.exe)** on `main` and enter a new version such as `v1.0.1` in `release_tag`.
3. Wait for the workflow to create the GitHub Release. It attaches the NSIS installer and `latest.yml`, which the updater uses to discover future versions.
4. Existing installed copies detect that release automatically; no GitHub sign-in is required on client computers.

The repository and its Releases must be public for clients to download updates without credentials. The portable EXE is provided for manual use and does not use the automatic updater; install the NSIS installer for automatic updates.

The workflow does not publish a release when run with an empty `release_tag`. Use a new, increasing version for each release.
