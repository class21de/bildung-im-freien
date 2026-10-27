/* /js/configurator_hpl.js (Corrected for DREISTUFEN model) */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

function isMobile() {
  const userAgent = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|tablet/i.test(userAgent);
}

let scene, camera, renderer, controls, gltfLoader, loadingManager;
let currentModel = null;
const configurableObjects = {};
const viewerContainer = document.getElementById('configurator-container');
const loadingOverlay = document.getElementById('loading-overlay');
const frustumSize = 3;

// --- Screenshot Functions ---
function getActiveModelName() {
  const activeModelSwitcher = document.querySelector('#model-switcher .model-switcher-item.active .model-name');
  return activeModelSwitcher ? activeModelSwitcher.textContent.trim() : 'Modell';
}

function getActiveColorName(swatchContainerId) {
  const activeSwatch = document.querySelector(`#${swatchContainerId} .swatch-option.active`);
  return activeSwatch ? activeSwatch.dataset.colorName : 'N-A';
}

function takeScreenshot() {
  renderer.render(scene, camera);
  const modelName = getActiveModelName();
  const frameColor = getActiveColorName('frame-swatches');
  const hplColor = getActiveColorName('hpl-swatches');
  const sanitize = (name) => name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  const filename = `${sanitize(modelName)}_${sanitize(frameColor)}_HPL-${sanitize(hplColor)}.jpg`;
  const dataURL = renderer.domElement.toDataURL('image/jpeg', 0.95);
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function loadProductConfig() {
  const pathParts = location.pathname.split('/');
  const productSlug = pathParts[pathParts.indexOf('produkte') + 1];
  const response = await fetch(`/produkte/${productSlug}/config.json`);
  return await response.json();
}

function applyMaterial(parentObject, material) {
  if (!parentObject || !material) return;
  parentObject.traverse((child) => {
    if (child.isMesh) child.material = material;
  });
}

function loadModel(variant, materials) {
  if (!variant) return;
  loadingOverlay.style.opacity = '1';
  loadingOverlay.style.display = 'flex';
  if (currentModel) scene.remove(currentModel);
  gltfLoader.load(variant.modelFile, (gltf) => {
    currentModel = gltf.scene;
    scene.add(currentModel);

    // <<< CHANGE: Target the correct object names from your Blender file >>>
    configurableObjects.frame = currentModel.getObjectByName('Gestell');
    configurableObjects.hpl = currentModel.getObjectByName('HPL'); // This is the main fix

    const activeFrameMat = document.querySelector('#frame-swatches .active')?.dataset.material || Object.keys(materials.frame)[0];
    const activeHplMat = document.querySelector('#hpl-swatches .active')?.dataset.material || Object.keys(materials.hpl)[0];

    applyMaterial(configurableObjects.frame, materials.frame[activeFrameMat]);
    applyMaterial(configurableObjects.hpl, materials.hpl[activeHplMat]);

    camera.position.copy(new THREE.Vector3(...variant.settings.camPos));
    controls.target.copy(new THREE.Vector3(...variant.settings.target));
    camera.zoom = variant.settings.zoom;
    controls.minPolarAngle = (90 - variant.settings.viewAngle) * (Math.PI / 180);
    controls.maxPolarAngle = (90 - variant.settings.viewAngle) * (Math.PI / 180);
    camera.updateProjectionMatrix();
    controls.update();
    loadingOverlay.style.display = 'none';
    loadingOverlay.style.opacity = '0';
  });
}

function populateModelSwitcher(modelVariants, materials) {
  const container = document.getElementById('model-switcher');
  if (!container) return;
  container.innerHTML = '';
  modelVariants.forEach((variant) => {
    const item = document.createElement('div');
    // item.className = 'model-switcher-item';
    item.classList.add('model-switcher-item', 'model-switcher-item-custom');
    item.dataset.modelFile = variant.modelFile;
    item.innerHTML = `<img src="${variant.svg}" alt="Skizze ${variant.name}" class="model-svg"><p class="model-name">${variant.name}</p>`;
    item.addEventListener('click', () => {
      document.querySelector('#model-switcher .active')?.classList.remove('active');
      item.classList.add('active');
      loadModel(variant, materials);
    });
    container.appendChild(item);
  });
  container.firstChild?.classList.add('active');
}

async function init() {
  const config = await loadProductConfig();
  if (!config.has3D) return;

  loadingManager = new THREE.LoadingManager();
  loadingManager.onLoad = () => {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => { loadingOverlay.style.display = 'none'; }, 300);
  };

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const aspect = viewerContainer.clientWidth / viewerContainer.clientHeight;
  camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 0.1, 100);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: isMobile() ? "low-power" : "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewerContainer.appendChild(renderer.domElement);

  if (isMobile()) {
    scene.add(new THREE.AmbientLight(0xffffff, 2.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(0, 1, 2).normalize();
    scene.add(dirLight);
  } else {
    const rgbeLoader = new RGBELoader(loadingManager);
    rgbeLoader.load(config.environmentHdr, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture;
    }, undefined, () => scene.add(new THREE.AmbientLight(0xffffff, 1.5)));
  }

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.8;
  controls.enableZoom = false;
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  controls.addEventListener('end', () => { if(!document.getElementById('save-screenshot-btn')?.matches(':hover')) { controls.autoRotate = true; }});

  gltfLoader = new GLTFLoader(loadingManager);

  const textureLoader = new THREE.TextureLoader();
  const galvanizedColorMap = textureLoader.load(config.galvanizedTexture);
  galvanizedColorMap.wrapS = THREE.RepeatWrapping;
  galvanizedColorMap.wrapT = THREE.RepeatWrapping;
  galvanizedColorMap.repeat.set(2, 2);

  const materials = { frame: {}, hpl: {} };

  config.colorOptions.frame.forEach(opt => {
    materials.frame[opt.material] = (opt.material === 'Feuerverzinkt')
      ? new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.3, map: galvanizedColorMap })
      : new THREE.MeshStandardMaterial({ color: parseInt(opt.color.replace('#', '0x')), metalness: 1.0, roughness: 0.7 });
  });

  // Use 'seat' colors from config for all HPL parts
  config.colorOptions.hpl.forEach(opt => {
    materials.hpl[opt.material] = new THREE.MeshStandardMaterial({
      color: parseInt(opt.color.replace('#', '0x')),
      metalness: 0.1,
      roughness: 0.7
    });
  });

  const modelVariants = config.modelVariants;
  populateModelSwitcher(modelVariants, materials);
  loadModel(modelVariants[0], materials);

  document.body.addEventListener('click', (e) => {
    const swatchOption = e.target.closest('.swatch-option');
    if (!swatchOption) return;
    controls.autoRotate = true;
    const part = swatchOption.dataset.part;
    const materialName = swatchOption.dataset.material;

    if (part === 'frame' && configurableObjects.frame) {
        applyMaterial(configurableObjects.frame, materials.frame[materialName]);
    } else if (part === 'hpl' && configurableObjects.hpl) {
        // <<< CHANGE: Apply material to the single 'HPL' object >>>
        applyMaterial(configurableObjects.hpl, materials.hpl[materialName]);
    }

    swatchOption.parentElement.querySelector('.active')?.classList.remove('active');
    swatchOption.classList.add('active');
  });

  document.getElementById('save-screenshot-btn')?.addEventListener('click', takeScreenshot);

  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      const { width, height } = entry.contentRect;
      const aspect = width / height;
      camera.left = frustumSize * aspect / -2;
      camera.right = frustumSize * aspect / 2;
      camera.top = frustumSize / 2;
      camera.bottom = frustumSize / -2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
  });
  resizeObserver.observe(viewerContainer);

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

init();
