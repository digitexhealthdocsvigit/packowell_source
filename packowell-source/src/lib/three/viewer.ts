import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  assembleMatrices,
  createPanelGeometry,
  lerpPose,
  maxOpenOrderFromResolved,
  poseMatrix,
} from '../geometry/build'
import { MATERIALS } from '../geometry/types'
import type { BuildResult, MaterialKey, StructureSpec, Vec3 } from '../geometry/types'

export interface ArtworkOptions {
  /** Panel to print onto. Defaults to the largest printable face. */
  panelId?: string | null
  /** `contain` shows the whole image with board visible; `cover` fills and crops. */
  fit?: 'contain' | 'cover'
  /** Board colour behind a contained image. Defaults to the panel material. */
  background?: string
}

export interface PanelInfo {
  id: string
  label: string
  part: string
  widthMm: number
  heightMm: number
  area: number
}

export interface ViewerState {
  open: number
  explode: number
  flat: boolean
  xray: boolean
  showDims: boolean
  isolated: string | null
}

export const DEFAULT_VIEWER_STATE: ViewerState = {
  open: 0,
  explode: 0,
  flat: false,
  xray: false,
  showDims: false,
  isolated: null,
}

interface Item {
  id: string
  part: string
  label: string
  material: MaterialKey
  geometry: THREE.BufferGeometry
  mesh: THREE.Mesh
  baseMatrix: THREE.Matrix4
  explode: THREE.Vector3
  baseOpacity: number
  /** assembly parts carry their own closed/open poses */
  poseClosed?: { pos: Vec3; rot: Vec3; scale?: Vec3 }
  poseOpen?: { pos: Vec3; rot: Vec3; scale?: Vec3 }
}

const smoothstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

export class PackagingViewer {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private root = new THREE.Group()
  private dimGroup = new THREE.Group()
  private items: Item[] = []
  private ground: THREE.Mesh | null = null
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private frameId = 0
  private disposed = false
  private resizeObserver: ResizeObserver
  private spec: StructureSpec | null = null
  private result: BuildResult | null = null
  private maxOrder = 0
  private state: ViewerState = { ...DEFAULT_VIEWER_STATE }
  private target: ViewerState = { ...DEFAULT_VIEWER_STATE }
  private ownedGeometries: THREE.BufferGeometry[] = []
  private capMaterials: THREE.MeshStandardMaterial[] = []
  private selected: string | null = null
  private hovered: string | null = null
  private onSelect?: (id: string | null) => void
  private onHover?: (id: string | null) => void
  private artwork: THREE.Texture | null = null
  private needsRender = true
  private pointerDownAt: { x: number; y: number } | null = null
  private labelScale = 100
  /** Aspect ratio the current framing was computed for, so resize can re-fit. */
  private framedAspect = 0

  constructor(container: HTMLElement) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.02
    const el = this.renderer.domElement
    el.style.width = '100%'
    el.style.height = '100%'
    el.style.display = 'block'
    el.style.touchAction = 'none'
    container.appendChild(el)

    this.camera = new THREE.PerspectiveCamera(34, 1, 1, 40000)
    this.controls = new OrbitControls(this.camera, el)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.09
    this.controls.minDistance = 20
    this.controls.maxDistance = 20000
    this.controls.maxPolarAngle = Math.PI * 0.94
    this.controls.addEventListener('change', () => {
      this.needsRender = true
    })

    // Ambient kept low so the key light, not the hemisphere, sets each face's
    // tone — otherwise top and front land within a few levels of each other and
    // the box reads as a flat silhouette.
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8e7e, 0.58))
    const key = new THREE.DirectionalLight(0xffffff, 2.3)
    // High and slightly to the side: with the key near the camera axis the top
    // and front faces land within a dozen levels of each other.
    key.position.set(300, 880, 400)
    this.scene.add(key)
    const fill = new THREE.DirectionalLight(0xdbe4ff, 0.42)
    fill.position.set(-560, 220, -420)
    this.scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffffff, 0.3)
    rim.position.set(-140, -300, 460)
    this.scene.add(rim)

    this.scene.add(this.root, this.dimGroup)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()

    el.addEventListener('pointermove', this.handlePointerMove)
    el.addEventListener('pointerdown', this.handlePointerDown)
    el.addEventListener('pointerup', this.handlePointerUp)
    this.loop()
  }

  onSelection(cb: (id: string | null) => void) {
    this.onSelect = cb
  }

  onHoverChange(cb: (id: string | null) => void) {
    this.onHover = cb
  }

  /* ------------------------------ model ------------------------------ */

  setModel(spec: StructureSpec, result: BuildResult) {
    this.spec = spec
    this.result = result
    this.maxOrder = spec.klass === 'fold' ? maxOpenOrderFromResolved(result.panels) : 0
    this.clearItems()
    this.state = { ...this.state, isolated: null }
    this.target = { ...this.target, isolated: null }

    const partMap = new Map(spec.parts.map((p) => [p.id, p]))

    if (spec.klass === 'assembly') {
      for (const part of result.parts) {
        const item = this.addItem(part.id, part.part, part.label, part.material, part.geometry)
        if (item) {
          item.poseClosed = part.pose
          item.poseOpen = part.poseOpen ?? part.pose
          item.baseMatrix = poseMatrix(part.pose.pos, part.pose.rot, part.pose.scale)
        }
      }
    } else {
      for (const panel of result.panels) {
        const geo = createPanelGeometry(panel)
        this.ownedGeometries.push(geo)
        this.addItem(panel.spec.id, panel.spec.part, panel.spec.label, panel.spec.material, geo)
      }
    }

    for (const item of this.items) {
      const p = partMap.get(item.part)
      if (!p) continue
      const dir = new THREE.Vector3(...p.explodeDir)
      if (dir.lengthSq() > 0) dir.normalize()
      item.explode.copy(dir).multiplyScalar(p.explodeDist)
    }

    this.updateBases()
    this.frameModel()
    this.buildGround()
    this.updateMatrices()
    this.buildDimensions()
    this.applyArtworkToMaterials()
    this.needsRender = true
  }

  private addItem(
    id: string,
    part: string,
    label: string,
    material: MaterialKey,
    geometry: THREE.BufferGeometry,
  ): Item | null {
    const def = MATERIALS[material] ?? MATERIALS.corrugated
    // Panels are closed solids, so only front faces should draw: with
    // DoubleSide the back face of a panel can win the depth test at a crease
    // and show through as a dark patch.
    const capMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(def.color),
      roughness: def.roughness,
      metalness: def.metalness,
      transparent: def.opacity < 1,
      opacity: def.opacity,
      side: THREE.FrontSide,
    })
    capMat.userData.isCap = true
    const edgeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(def.edge),
      roughness: Math.min(1, def.roughness + 0.05),
      metalness: def.metalness,
      side: THREE.FrontSide,
      transparent: def.opacity < 1,
      opacity: def.opacity,
    })
    const mesh = new THREE.Mesh(geometry, [capMat, edgeMat])
    mesh.matrixAutoUpdate = false
    mesh.userData.itemId = id
    this.root.add(mesh)
    this.capMaterials.push(capMat)
    const item: Item = {
      id,
      part,
      label,
      material,
      geometry,
      mesh,
      baseMatrix: new THREE.Matrix4(),
      explode: new THREE.Vector3(),
      baseOpacity: def.opacity,
    }
    this.items.push(item)
    return item
  }

  private updateBases() {
    if (!this.spec || !this.result) return
    if (this.spec.klass === 'assembly') {
      const t = this.state.flat ? 0 : Math.min(1, Math.max(0, this.state.open))
      for (const item of this.items) {
        if (!item.poseClosed || !item.poseOpen) continue
        const c = item.poseClosed
        const o = item.poseOpen
        item.baseMatrix = poseMatrix(
          lerpPose(c.pos, o.pos, t),
          lerpPose(c.rot, o.rot, t),
          lerpPose(c.scale ?? [1, 1, 1], o.scale ?? [1, 1, 1], t),
        )
      }
      return
    }
    const mats = assembleMatrices(
      this.result.panels,
      this.state.flat ? 0 : this.state.open,
      this.maxOrder,
      this.state.flat,
    )
    for (const item of this.items) {
      const m = mats.get(item.id)
      if (m) item.baseMatrix.copy(m)
    }
  }

  private updateMatrices() {
    this.updateBases()
    for (const item of this.items) {
      const offset = item.explode.clone().multiplyScalar(smoothstep(this.state.explode))
      const m = item.baseMatrix.clone()
      m.elements[12] += offset.x
      m.elements[13] += offset.y
      m.elements[14] += offset.z
      item.mesh.matrix.copy(m)
      item.mesh.matrixWorldNeedsUpdate = true
      const arr = (Array.isArray(item.mesh.material) ? item.mesh.material : [item.mesh.material]) as THREE.MeshStandardMaterial[]
      const targetOpacity = this.state.xray ? Math.min(0.3, item.baseOpacity) : item.baseOpacity
      for (const mat of arr) {
        if (Math.abs(mat.opacity - targetOpacity) > 0.001) {
          mat.opacity = targetOpacity
          mat.transparent = targetOpacity < 1
          mat.needsUpdate = true
        }
      }
    }
    this.applyHighlightState()
    this.dimGroup.visible = this.state.showDims
    this.needsRender = true
  }

  private applyHighlightState() {
    const active = this.hovered ?? this.selected
    for (const item of this.items) {
      const arr = (Array.isArray(item.mesh.material) ? item.mesh.material : [item.mesh.material]) as THREE.MeshStandardMaterial[]
      const isActive = item.id === active
      for (const mat of arr) {
        if (!mat.emissive) continue
        mat.emissive.setHex(isActive ? 0x2563eb : 0x000000)
        mat.emissiveIntensity = isActive ? 0.22 : 0
      }
      const hiddenByIsolation =
        this.state.isolated !== null &&
        item.part !== this.state.isolated &&
        item.id !== this.state.isolated
      item.mesh.visible = !hiddenByIsolation
    }
  }

  /* ------------------------------ public ------------------------------ */

  setState(patch: Partial<ViewerState>) {
    this.target = { ...this.target, ...patch }
    if ('flat' in patch || 'xray' in patch || 'showDims' in patch || 'isolated' in patch) {
      this.state = { ...this.state, ...patch }
      if (patch.flat !== undefined) {
        const wasFlat = this.state.flat
        this.state.flat = patch.flat
        if (patch.flat !== wasFlat) this.frameModel()
      }
      this.updateMatrices()
    }
    this.needsRender = true
  }

  getState(): ViewerState {
    return { ...this.state }
  }

  select(id: string | null) {
    this.selected = id
    this.applyHighlightState()
    this.needsRender = true
  }

  isolate(part: string | null) {
    this.setState({ isolated: part })
  }

  resetCamera() {
    this.frameModel()
    this.needsRender = true
  }

  /**
   * Places artwork on a single panel, at that panel's true proportion.
   *
   * A texture cannot be "contained" inside a face by repeat/offset — that only
   * crops. So the image is composed onto a canvas with the panel's aspect
   * ratio first, letterboxed with the board colour for `contain`, or cropped
   * centre-out for `cover`. What the customer sees is the proportion the
   * artwork will actually have on the box, which is the point of a proof.
   */
  setArtwork(url: string | null, options: ArtworkOptions = {}) {
    this.artworkUrl = url
    this.artworkOptions = { fit: 'contain', ...options }
    this.applyArtworkToMaterials()
  }

  /** Printable faces, most useful first, so the UI can offer a target. */
  listPanels(): PanelInfo[] {
    const score = (p: { label: string; area: number }) => {
      // Area alone picks the base of a closed box — the one face you cannot
      // see. Weight labels that face a person before panels that fold inside.
      const hidden = /base|bottom|inside|glue|dust|flap|seam|tuck/i.test(p.label)
      const exposed = /lid|front|face|body|top|panel|wall/i.test(p.label)
      return p.area * (hidden ? 0.08 : 1) * (exposed ? 1.25 : 1)
    }
    return this.items
      .map((item) => {
        const size = new THREE.Vector3()
        item.geometry.computeBoundingBox()
        item.geometry.boundingBox?.getSize(size)
        const info = {
          id: item.id,
          label: item.label,
          part: item.part,
          widthMm: Math.max(size.x, 0.1),
          heightMm: Math.max(size.y, 0.1),
          area: size.x * size.y,
        }
        return { ...info, weight: score(info) }
      })
      .filter((p) => p.widthMm > 1 && p.heightMm > 1)
      .sort((a, b) => b.weight - a.weight)
      .map(({ weight: _weight, ...p }) => p)
  }

  private artworkUrl: string | null = null
  private artworkOptions: ArtworkOptions = { fit: 'contain' }
  private artworkToken = 0

  private targetPanel(): Item | null {
    const id = this.artworkOptions.panelId
    if (id) {
      const hit = this.items.find((i) => i.id === id)
      if (hit) return hit
    }
    return this.listPanels()[0] ? this.items.find((i) => i.id === this.listPanels()[0].id) ?? null : null
  }

  private resetCapMaterials() {
    for (const item of this.items) {
      const mat = item.mesh.material
      const cap = (Array.isArray(mat) ? mat[0] : mat) as THREE.MeshStandardMaterial
      if (cap.map) {
        cap.map = null
        const def = MATERIALS[item.material] ?? MATERIALS.corrugated
        cap.color.set(def.color)
        cap.needsUpdate = true
      }
    }
  }

  private applyArtworkToMaterials() {
    this.resetCapMaterials()

    if (!this.artworkUrl) {
      this.artwork?.dispose()
      this.artwork = null
      this.needsRender = true
      return
    }

    const token = ++this.artworkToken
    const url = this.artworkUrl
    const item = this.targetPanel()
    if (!item) {
      this.needsRender = true
      return
    }

    const size = new THREE.Vector3()
    item.geometry.computeBoundingBox()
    item.geometry.boundingBox?.getSize(size)
    const panelW = Math.max(size.x, 0.1)
    const panelH = Math.max(size.y, 0.1)
    const fit = this.artworkOptions.fit ?? 'contain'
    const def = MATERIALS[item.material] ?? MATERIALS.corrugated

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // A stale load (artwork replaced while this one was in flight) must not
      // paint over the newer proof.
      if (token !== this.artworkToken || this.disposed) return

      const ratio = panelW / panelH
      const long = 2048
      const canvas = document.createElement('canvas')
      canvas.width = ratio >= 1 ? long : Math.round(long * ratio)
      canvas.height = ratio >= 1 ? Math.round(long / ratio) : long
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = this.artworkOptions.background ?? def.color
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const iw = img.naturalWidth || img.width || 1000
      const ih = img.naturalHeight || img.height || 1000
      const scale = fit === 'cover'
        ? Math.max(canvas.width / iw, canvas.height / ih)
        : Math.min(canvas.width / iw, canvas.height / ih)
      const w = iw * scale
      const h = ih * scale
      const dx = (canvas.width - w) / 2
      const dy = (canvas.height - h) / 2

      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, dx, dy, w, h)

      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
      tex.needsUpdate = true

      this.artwork?.dispose()
      this.artwork = tex

      const mat = item.mesh.material
      const cap = (Array.isArray(mat) ? mat[0] : mat) as THREE.MeshStandardMaterial
      cap.map = tex
      cap.color.set('#ffffff')
      cap.needsUpdate = true
      this.needsRender = true
    }
    img.onerror = () => {
      if (token === this.artworkToken) this.needsRender = true
    }
    img.src = url
  }

  screenshot(): string {
    this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement.toDataURL('image/png')
  }

  hasWebGL(): boolean {
    return !!this.renderer.getContext()
  }

  /* ------------------------------ scene ------------------------------ */

  private frameModel(keepDirection = false) {
    this.updateBases()
    const box = this.currentBounds()
    const size = new THREE.Vector3()
    box.getSize(size)
    const center = new THREE.Vector3()
    box.getCenter(center)
    const radius = Math.max(size.x, size.y, size.z) * 0.5 || 100

    this.root.position.set(-center.x, -center.y, -center.z)
    this.root.updateMatrixWorld(true)
    this.labelScale = Math.max(20, radius * 0.55)

    const dist = (radius / Math.tan((this.camera.fov * Math.PI) / 360)) * 1.6
    if (this.state.flat) {
      this.camera.up.set(0, 0, -1)
      this.camera.position.set(0.001, dist, 0.001)
      this.camera.position.setLength(this.fitDistance(new THREE.Vector3(0.0001, 1, 0.0001), box, 0.9))
    } else {
      this.camera.up.set(0, 1, 0)
      const home = new THREE.Vector3(0.62, 0.5, 0.9).normalize()
      // A container that was measured before layout settled gets re-framed on
      // resize; keeping the direction means the user's orbit is not thrown away.
      const dir =
        keepDirection && this.camera.position.lengthSq() > 1e-6
          ? this.camera.position.clone().normalize()
          : home
      this.camera.position.copy(dir.multiplyScalar(this.fitDistance(dir, box, 0.82)))
    }
    this.controls.target.set(0, 0, 0)
    this.camera.near = Math.max(0.5, radius / 200)
    this.camera.far = radius * 80
    this.camera.updateProjectionMatrix()
    this.controls.update()
    if (this.ground) {
      this.ground.position.y = -size.y / 2 - Math.max(1, size.y * 0.01)
      const s = radius * 4
      this.ground.scale.set(s / 100, s / 100, 1)
      this.ground.visible = !this.state.flat
    }
    this.needsRender = true
  }

  /**
   * Distance along `dir` at which the box's projected corners fill `margin` of
   * the frame. Fitting on the projected silhouette rather than the bounding
   * sphere is what stops a wide, flat mailer from sitting tiny in a tall canvas.
   */
  private fitDistance(dir: THREE.Vector3, box: THREE.Box3, margin: number): number {
    const size = new THREE.Vector3()
    box.getSize(size)
    const center = new THREE.Vector3()
    box.getCenter(center)

    const cam = this.camera
    const start = ((Math.max(size.x, size.y, size.z) * 0.5) / Math.tan((cam.fov * Math.PI) / 360)) * 2.4
    cam.position.copy(dir.clone().multiplyScalar(start))
    cam.lookAt(0, 0, 0)
    cam.updateMatrixWorld(true)
    cam.updateProjectionMatrix()

    let fill = 0
    const corner = new THREE.Vector3()
    for (let i = 0; i < 8; i++) {
      corner
        .set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
        .sub(center)
        .project(cam)
      fill = Math.max(fill, Math.abs(corner.x), Math.abs(corner.y))
    }

    return fill > 1e-4 ? start * (fill / margin) : start
  }

  private currentBounds(): THREE.Box3 {
    const box = new THREE.Box3()
    for (const item of this.items) {
      if (!item.geometry.boundingBox) item.geometry.computeBoundingBox()
      const bb = item.geometry.boundingBox!.clone()
      bb.applyMatrix4(item.baseMatrix)
      box.union(bb)
    }
    if (box.isEmpty()) box.set(new THREE.Vector3(-100, -100, -100), new THREE.Vector3(100, 100, 100))
    return box
  }

  private buildGround() {
    if (this.ground) {
      this.scene.remove(this.ground)
      ;(this.ground.material as THREE.Material).dispose()
      this.ground.geometry.dispose()
      this.ground = null
    }
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const grad = ctx.createRadialGradient(128, 128, 6, 128, 128, 126)
    grad.addColorStop(0, 'rgba(28,25,23,0.34)')
    grad.addColorStop(0.5, 'rgba(28,25,23,0.12)')
    grad.addColorStop(1, 'rgba(28,25,23,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 256)
    const tex = new THREE.CanvasTexture(canvas)
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), mat)
    mesh.rotation.x = -Math.PI / 2
    this.scene.add(mesh)
    this.ground = mesh
  }

  private buildDimensions() {
    for (const child of [...this.dimGroup.children]) {
      this.dimGroup.remove(child)
      const sprite = child as THREE.Sprite
      if (sprite.material) sprite.material.dispose()
      const line = child as THREE.Line
      if (line.geometry) line.geometry.dispose()
    }
    if (!this.items.length) return
    const box = this.currentBounds()
    const size = new THREE.Vector3()
    box.getSize(size)
    const y = -size.y / 2 - Math.max(2, size.y * 0.03)
    const x0 = -size.x / 2
    const x1 = size.x / 2
    const z0 = -size.z / 2
    const z1 = size.z / 2

    this.addDimLine([x0, y, z1], [x1, y, z1], `${round(size.x)} mm`, new THREE.Vector3(0, y, z1))
    this.addDimLine([x1, y, z0], [x1, y, z1], `${round(size.z)} mm`, new THREE.Vector3(x1, y, 0))
    this.addDimLine([x1, -size.y / 2, z1], [x1, size.y / 2, z1], `${round(size.y)} mm`, new THREE.Vector3(x1, 0, z1))
    this.dimGroup.visible = this.state.showDims
  }

  private addDimLine(a: Vec3, b: Vec3, label: string, labelPos: THREE.Vector3) {
    const mat = new THREE.LineBasicMaterial({ color: 0x1d4ed8, transparent: true, opacity: 0.85 })
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)])
    this.dimGroup.add(new THREE.Line(geo, mat))

    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.font = '600 30px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const w = ctx.measureText(label).width + 28
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.beginPath()
    ctx.roundRect((256 - w) / 2, 10, w, 44, 10)
    ctx.fill()
    ctx.strokeStyle = 'rgba(29,78,216,0.45)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#1d4ed8'
    ctx.fillText(label, 128, 33)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
    sprite.scale.set(this.labelScale * 1.9, this.labelScale * 0.48, 1)
    sprite.position.copy(labelPos)
    sprite.renderOrder = 999
    this.dimGroup.add(sprite)
  }

  private resize() {
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    const aspect = w / h
    this.renderer.setSize(w, h, false)
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()

    // The first measurement often happens before the container has its final
    // size, which framed the model far too small. Re-frame when the aspect
    // actually shifts, keeping the current view direction.
    const changed = this.framedAspect > 0 && Math.abs(aspect - this.framedAspect) / this.framedAspect > 0.12
    if (changed && this.items.length > 0) this.frameModel(true)
    this.framedAspect = aspect

    this.needsRender = true
  }

  private handlePointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.root.children.filter((c) => c.visible), false)
    const id = hits.length ? ((hits[0].object.userData.itemId as string) ?? null) : null
    if (id !== this.hovered) {
      this.hovered = id
      this.renderer.domElement.style.cursor = id ? 'pointer' : 'grab'
      this.onHover?.(id)
      this.applyHighlightState()
      this.needsRender = true
    }
  }

  private handlePointerDown = (e: PointerEvent) => {
    this.pointerDownAt = { x: e.clientX, y: e.clientY }
  }

  private handlePointerUp = (e: PointerEvent) => {
    if (!this.pointerDownAt) return
    const moved = Math.hypot(e.clientX - this.pointerDownAt.x, e.clientY - this.pointerDownAt.y)
    this.pointerDownAt = null
    if (moved > 6) return
    this.onSelect?.(this.hovered)
  }

  private loop = () => {
    if (this.disposed) return
    this.frameId = requestAnimationFrame(this.loop)
    let changed = false
    for (const k of ['open', 'explode'] as const) {
      const d = this.target[k] - this.state[k]
      if (Math.abs(d) > 0.002) {
        this.state[k] += d * 0.18
        changed = true
      } else if (this.state[k] !== this.target[k]) {
        this.state[k] = this.target[k]
        changed = true
      }
    }
    if (changed) this.updateMatrices()
    this.controls.update()
    if (this.needsRender) {
      this.needsRender = false
      this.renderer.render(this.scene, this.camera)
    }
  }

  private clearItems() {
    for (const item of this.items) {
      this.root.remove(item.mesh)
      const arr = (Array.isArray(item.mesh.material) ? item.mesh.material : [item.mesh.material]) as THREE.Material[]
      arr.forEach((m) => m.dispose())
    }
    this.items = []
    for (const g of this.ownedGeometries) g.dispose()
    this.ownedGeometries = []
    this.capMaterials = []
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.frameId)
    this.resizeObserver.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointermove', this.handlePointerMove)
    el.removeEventListener('pointerdown', this.handlePointerDown)
    el.removeEventListener('pointerup', this.handlePointerUp)
    this.controls.dispose()
    this.clearItems()
    if (this.ground) {
      ;(this.ground.material as THREE.Material).dispose()
      this.ground.geometry.dispose()
    }
    if (this.artwork) this.artwork.dispose()
    this.renderer.dispose()
    if (el.parentElement === this.container) this.container.removeChild(el)
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}
