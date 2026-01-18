import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Box3, Color, TOUCH, Vector3 } from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import './App.css'

const HIGHLIGHT_COLOR = new Color('#f5b77a')
const CONTENT_MAP = {
  Incisor: {
    title: 'Incisor',
    quickFacts: ['Front teeth for cutting', 'Usually 8 total', 'Thin, sharp edge'],
    commonIssues: ['Chipping', 'Surface wear', 'Sensitivity'],
  },
  Canine: {
    title: 'Canine',
    quickFacts: ['Pointed for tearing', 'Usually 4 total', 'Longest root'],
    commonIssues: ['Wear facets', 'Gum recession', 'Sensitivity'],
  },
  Molar: {
    title: 'Molar',
    quickFacts: ['Back teeth for grinding', 'Broad chewing surface', 'Multiple roots'],
    commonIssues: ['Cavities', 'Cracks', 'Gum inflammation'],
  },
}

const GENERIC_CONTENT = {
  title: 'Tooth structure',
  quickFacts: [
    'Teeth are layered (enamel, dentin, pulp)',
    'Shape varies by function',
    'Surrounding gums support stability',
  ],
  commonIssues: ['Plaque buildup', 'Wear over time', 'Sensitivity'],
}

function Model({ onLoaded, onSceneReady, selectedId }) {
  const gltf = useGLTF('/models/mouth.glb')

  useEffect(() => {
    onLoaded?.()
  }, [onLoaded])

  useEffect(() => {
    onSceneReady?.(gltf.scene)
  }, [gltf.scene, onSceneReady])

  useEffect(() => {
    gltf.scene.traverse((child) => {
      if (!child.isMesh || !child.material?.isMaterial) return
      if (!child.material.userData._cloned) {
        child.material = child.material.clone()
        child.material.userData._cloned = true
      }
      if (!child.material.emissive) return
      const isSelected = child.uuid === selectedId
      child.material.emissive.copy(isSelected ? HIGHLIGHT_COLOR : new Color('#000000'))
      child.material.emissiveIntensity = isSelected ? 0.6 : 0
    })
  }, [gltf.scene, selectedId])

  return <primitive object={gltf.scene} position={[0, -0.2, 0]} scale={1} />
}

class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    this.props.onError?.(error)
  }

  render() {
    if (this.state.hasError) {
      return null
    }
    return this.props.children
  }
}

function CameraFocus({ selectedMesh, controlsRef, resetView, resetKey }) {
  const { camera } = useThree()
  const rafRef = useRef(null)

  useEffect(() => {
    if (!controlsRef.current) return
    if (!selectedMesh && !resetView) return

    const controls = controlsRef.current
    const startPos = camera.position.clone()
    const startTarget = controls.target.clone()

    let endTarget = null
    let endPos = null

    if (resetView) {
      endTarget = resetView.target.clone()
      endPos = resetView.position.clone()
    } else if (selectedMesh) {
      const box = new Box3().setFromObject(selectedMesh)
      const center = new Vector3()
      box.getCenter(center)
      const offset = startPos.clone().sub(startTarget)
      endTarget = center
      endPos = center.clone().add(offset)
    }

    if (!endTarget || !endPos) return

    const duration = 600
    const startTime = performance.now()

    const easeInOut = (t) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    const animate = (now) => {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      const eased = easeInOut(t)

      camera.position.lerpVectors(startPos, endPos, eased)
      controls.target.lerpVectors(startTarget, endTarget, eased)
      controls.update()

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [camera, controlsRef, resetKey, resetView, selectedMesh])

  return null
}

function ScenePicker({ scene, onSelect, onMiss, onFirstInteract }) {
  const { camera, gl, raycaster } = useThree()

  useEffect(() => {
    if (!scene) return

    const offsets = [
      [0, 0],
      [6, 0],
      [-6, 0],
      [0, 6],
      [0, -6],
      [8, 8],
      [-8, 8],
      [8, -8],
      [-8, -8],
    ]

    const handlePointerDown = (event) => {
      onFirstInteract?.()
      const rect = gl.domElement.getBoundingClientRect()
      const baseX = event.clientX - rect.left
      const baseY = event.clientY - rect.top

      for (const [dx, dy] of offsets) {
        const x = ((baseX + dx) / rect.width) * 2 - 1
        const y = -(((baseY + dy) / rect.height) * 2 - 1)
        raycaster.setFromCamera({ x, y }, camera)
        const hits = raycaster.intersectObject(scene, true)
        const hit = hits.find((item) => item.object?.isMesh)
        if (hit) {
          onSelect?.(hit.object, event)
          return
        }
      }

      onMiss?.()
    }

    gl.domElement.addEventListener('pointerdown', handlePointerDown)
    return () => {
      gl.domElement.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [camera, gl, onFirstInteract, onMiss, onSelect, raycaster, scene])

  return null
}

function HoverProbe({ scene, enabled, onHover, onLeave }) {
  const { camera, gl, raycaster } = useThree()

  useEffect(() => {
    if (!scene || !enabled) return

    const handlePointerMove = (event) => {
      const rect = gl.domElement.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
      raycaster.setFromCamera({ x, y }, camera)
      const hits = raycaster.intersectObject(scene, true)
      const hit = hits.find((item) => item.object?.isMesh)
      if (hit) {
        onHover?.(hit.object, { x: event.clientX, y: event.clientY })
      } else {
        onLeave?.()
      }
    }

    const handlePointerLeave = () => {
      onLeave?.()
    }

    gl.domElement.addEventListener('pointermove', handlePointerMove)
    gl.domElement.addEventListener('pointerleave', handlePointerLeave)
    return () => {
      gl.domElement.removeEventListener('pointermove', handlePointerMove)
      gl.domElement.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [camera, enabled, gl, onHover, onLeave, raycaster, scene])

  return null
}

function App() {
  const [modelStatus, setModelStatus] = useState('Loading...')
  const [modelError, setModelError] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedName, setSelectedName] = useState('')
  const [selectedMesh, setSelectedMesh] = useState(null)
  const [gltfScene, setGltfScene] = useState(null)
  const [showInstructions, setShowInstructions] = useState(true)
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [meshNames, setMeshNames] = useState([])
  const [hoverInfo, setHoverInfo] = useState({
    name: '',
    x: 0,
    y: 0,
    visible: false,
  })
  const controlsRef = useRef(null)
  const defaultView = useRef({
    position: new Vector3(0, 1.2, 3),
    target: new Vector3(0, 0, 0),
  })
  const [resetKey, setResetKey] = useState(0)
  const [resetView, setResetView] = useState(null)

  useEffect(() => {
    if (!gltfScene) return
    const names = new Set()
    gltfScene.traverse((child) => {
      if (child.isMesh) {
        names.add(child.name || 'Unnamed mesh')
      }
    })
    setMeshNames(Array.from(names).sort())
  }, [gltfScene])

  const hoverLabelStyle = useMemo(
    () => ({
      transform: `translate(${hoverInfo.x + 12}px, ${hoverInfo.y + 12}px)`,
    }),
    [hoverInfo.x, hoverInfo.y]
  )

  return (
    <div className="app">
      <Canvas camera={{ position: [0, 1.2, 3], fov: 50 }}>
        <color attach="background" args={['#e7e3da']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 2]} intensity={1} />
        <ModelErrorBoundary
          onError={() => {
            setModelError(true)
            setModelStatus('Missing model')
          }}
        >
          <Suspense fallback={null}>
            <Model
              onLoaded={() => setModelStatus('Loaded')}
              onSceneReady={setGltfScene}
              selectedId={selectedId}
            />
          </Suspense>
        </ModelErrorBoundary>
        <CameraFocus
          selectedMesh={selectedMesh}
          controlsRef={controlsRef}
          resetView={resetView}
          resetKey={resetKey}
        />
        <ScenePicker
          scene={gltfScene}
          onFirstInteract={() => setShowInstructions(false)}
          onSelect={(mesh, event) => {
            setSelectedId(mesh.uuid)
            setSelectedName(mesh.name || 'Unnamed mesh')
            setSelectedMesh(mesh)
            setResetView(null)
            if (debugEnabled) {
              setHoverInfo({
                name: mesh.name || 'Unnamed mesh',
                x: event?.clientX ?? 24,
                y: event?.clientY ?? 24,
                visible: true,
              })
            }
          }}
          onMiss={() => {
            setSelectedId(null)
            setSelectedName('')
            setSelectedMesh(null)
            setHoverInfo((prev) => ({ ...prev, visible: false }))
          }}
        />
        <HoverProbe
          scene={gltfScene}
          enabled={debugEnabled}
          onHover={(mesh, position) => {
            setHoverInfo({
              name: mesh.name || 'Unnamed mesh',
              x: position.x,
              y: position.y,
              visible: true,
            })
          }}
          onLeave={() => setHoverInfo((prev) => ({ ...prev, visible: false }))}
        />
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.6}
          zoomSpeed={0.9}
          panSpeed={0.7}
          touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
          makeDefault
        />
      </Canvas>
      <button
        type="button"
        className="home-button"
        onClick={() => {
          setSelectedId(null)
          setSelectedName('')
          setSelectedMesh(null)
          setResetView({
            position: defaultView.current.position.clone(),
            target: defaultView.current.target.clone(),
          })
          setResetKey((prev) => prev + 1)
        }}
      >
        Home
      </button>
      <button
        type="button"
        className="debug-button"
        onClick={() => setDebugEnabled((prev) => !prev)}
      >
        Debug {debugEnabled ? 'On' : 'Off'}
      </button>
      {modelError ? (
        <div className="overlay message">Place mouth.glb in public/models/</div>
      ) : (
        <div className="overlay status">{modelStatus}</div>
      )}
      {showInstructions && (
        <div className="overlay hint">
          Tap a tooth to learn more. Drag to rotate. Pinch to zoom.
        </div>
      )}
      {debugEnabled && hoverInfo.visible && (
        <div className="hover-label" style={hoverLabelStyle}>
          {hoverInfo.name}
        </div>
      )}
      {debugEnabled && (
        <div className="debug-panel">
          <div className="debug-title">Mesh names</div>
          <div className="debug-list">
            {meshNames.length === 0
              ? 'No meshes detected yet.'
              : meshNames.map((name) => (
                  <div key={name} className="debug-item">
                    {name}
                  </div>
                ))}
          </div>
        </div>
      )}
      <div className={`drawer ${selectedId ? 'open' : ''}`}>
        <div className="drawer-inner">
          {(() => {
            const content = CONTENT_MAP[selectedName] || GENERIC_CONTENT
            return (
              <>
                <div className="drawer-title">
                  {selectedName ? content.title : 'No selection'}
                </div>
                {selectedName && (
                  <>
                    <div className="drawer-section">
                      <div className="drawer-subtitle">Quick facts</div>
                      <ul className="drawer-list">
                        {content.quickFacts.map((fact) => (
                          <li key={fact}>{fact}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="drawer-section">
                      <div className="drawer-subtitle">Common issues</div>
                      <ul className="drawer-list">
                        {content.commonIssues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
                <p className="drawer-note">Educational only — not medical advice.</p>
              </>
            )
          })()}
          <button
            type="button"
            className="drawer-button"
            onClick={() => {
              setSelectedId(null)
              setSelectedName('')
              setSelectedMesh(null)
            }}
            disabled={!selectedId}
          >
            Clear selection
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
