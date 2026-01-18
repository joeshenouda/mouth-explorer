# Mouth Explorer

## Run the dev server

```bash
source ~/.nvm/nvm.sh && nvm use 20.19.0
cd /Users/JosephShenouda/mouth-explorer
npm run dev
```

## Add the model

Place your GLB at:

```
mouth-explorer/public/models/mouth.glb
```

The app loads it from `/models/mouth.glb`.

## Mesh selection

- Tapping/clicking a mesh selects it and opens the drawer.
- The camera animates to orbit around the selected mesh.
- Tapping empty space clears the selection.

## Extend the content mapping

Open `mouth-explorer/src/App.jsx` and update `CONTENT_MAP`:

```js
const CONTENT_MAP = {
  Incisor: {
    title: 'Incisor',
    quickFacts: ['Front teeth for cutting'],
    commonIssues: ['Chipping'],
  },
}
```

Use mesh names from your GLB as keys. Unmapped names fall back to generic content.
# mouth-explorer
