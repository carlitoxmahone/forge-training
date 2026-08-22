# Puesta en marcha

## Primera vez

1. Descomprime la carpeta `FORGE`.
2. Muévela a una ubicación definitiva, por ejemplo `Documentos\FORGE`.
3. En VS Code: **File > Open Folder...** y elige `FORGE`.
4. Pulsa **Go Live**.
5. Prueba la aplicación en `http://127.0.0.1:5500`.

No vuelvas a borrar esta carpeta: esta será la carpeta maestra.

## Prepararla para GitHub

Crea en GitHub un repositorio nuevo y vacío llamado, por ejemplo, `forge-training`.

Después abre **Terminal > New Terminal** dentro de VS Code y ejecuta:

```bash
git init
git add .
git commit -m "FORGE base estable"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/forge-training.git
git push -u origin main
```

Sustituye `TU_USUARIO` por tu usuario de GitHub.

## GitHub Pages

En el repositorio:

1. **Settings**
2. **Pages**
3. **Source: Deploy from a branch**
4. **Branch: main**
5. **Folder: / (root)**
6. **Save**

Después cualquier cambio que llegue a `main` actualizará la web.

## Flujo de cambios desde ese momento

Cuando se modifique FORGE en GitHub, dentro de la carpeta maestra local:

```bash
git pull
```

Live Server mostrará los cambios inmediatamente.

Si haces tú un cambio local:

```bash
git add .
git commit -m "Descripción del cambio"
git push
```
