/* /js/configurator.js (Mobile-Optimized Version) */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// Enhanced mobile detection with tablet support
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

// --- START: Screenshot Functions ---
function getActiveModelName() {
  const activeModelSwitcher = document.querySelector('#model-switcher .model-switcher-item.active .model-name');
  return activeModelSwitcher ? activeModelSwitcher.textContent.trim() : 'Modell';
}

function getActiveColorName(swatchContainerId) {
  const activeSwatch = document.querySelector(`#${swatchContainerId} .swatch-option.active`);
  if (activeSwatch) {
    return activeSwatch.dataset.colorName;
  }
  return 'N-A';
}

function takeScreenshot() {
  renderer.render(scene, camera);
  const modelName = getActiveModelName();
  const frameColor = getActiveColorName('frame-swatches');
  const tableColor = getActiveColorName('tabletop-swatches');
  const sanitize = (name) => name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  const filename = `${sanitize(modelName)}_${sanitize(frameColor)}_Tisch-${sanitize(tableColor)}`;
  const dataURL = renderer.domElement.toDataURL('image/jpeg', 0.95);
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
// --- END: Screenshot Functions ---

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
    const objectNames = { frame: 'Gestell', tabletop: 'Tischplatte' };
    for (const [key, name] of Object.entries(objectNames)) {
      configurableObjects[key] = currentModel.getObjectByName(name);
    }
    const activeFrameMat = document.querySelector('#frame-swatches .active')?.dataset.material || Object.keys(materials.frame)[0];
    const activeTabletopMat = document.querySelector('#tabletop-swatches .active')?.dataset.material || Object.keys(materials.tabletop)[0];
    applyMaterial(configurableObjects.frame, materials.frame[activeFrameMat]);
    applyMaterial(configurableObjects.tabletop, materials.tabletop[activeTabletopMat]);
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
    item.className = 'model-switcher-item';
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
  camera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.1,
    100
  );

  // Renderer with mobile optimization
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: isMobile() ? "low-power" : "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio on mobile
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewerContainer.appendChild(renderer.domElement);

  // Enhanced mobile lighting for uniform, flat appearance
  if (isMobile()) {
    // Strong ambient light for uniform illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
    scene.add(ambientLight);

    // Front-facing directional light with minimal shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(0, 1, 2).normalize();
    scene.add(directionalLight);

    // Additional fill light from the side to reduce shadows
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(1, 0.5, 1).normalize();
    scene.add(fillLight);

    // Back light to minimize dark areas
    const backLight = new THREE.DirectionalLight(0xffffff, 0.6);
    backLight.position.set(-0.5, 0.5, -1).normalize();
    scene.add(backLight);
  } else {
    // Desktop: HDR environment for realistic lighting
    const rgbeLoader = new RGBELoader(loadingManager);
    rgbeLoader.load(config.environmentHdr,
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
      },
      undefined,
      (error) => {
        console.error("HDR failed, using fallback lights", error);
        scene.add(new THREE.AmbientLight(0xffffff, 1.5));
      }
    );
  }

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.8;
  controls.enableZoom = false;
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  controls.addEventListener('end', () => {
    if(!document.getElementById('save-screenshot-btn')?.matches(':hover')) {
      controls.autoRotate = true;
    }
  });

  gltfLoader = new GLTFLoader(loadingManager);

  const textureLoader = new THREE.TextureLoader();
  const galvanizedColorMap = textureLoader.load(config.galvanizedTexture);
  galvanizedColorMap.wrapS = THREE.RepeatWrapping;
  galvanizedColorMap.wrapT = THREE.RepeatWrapping;
  galvanizedColorMap.repeat.set(2, 2);

  const materials = { frame: {}, tabletop: {} };

  // Create materials with mobile-specific adjustments
  config.colorOptions.frame.forEach(opt => {
    if (opt.material === 'Feuerverzinkt') {
      materials.frame[opt.material] = new THREE.MeshStandardMaterial({
        metalness: 1,
        roughness: 0.3,
        map: galvanizedColorMap
      });
    } else {
      materials.frame[opt.material] = new THREE.MeshStandardMaterial({
        color: parseInt(opt.color.replace('#', '0x')),
        metalness: 1.0,
        roughness: 0.7
      });
    }

    // Mobile material adjustments for uniform appearance
    if (isMobile()) {
      materials.frame[opt.material].emissive = new THREE.Color(0x111111);
      materials.frame[opt.material].emissiveIntensity = 0.3;
      materials.frame[opt.material].metalness *= 0.5;
      materials.frame[opt.material].roughness = 0.8;
    }
  });



  config.colorOptions.tabletop.forEach(opt => {
    materials.tabletop[opt.material] = new THREE.MeshStandardMaterial({
      color: parseInt(opt.color.replace('#', '0x')),
      metalness: 0.1,
      roughness: 0.7
    });

    if (isMobile()) {
      materials.tabletop[opt.material].emissive = new THREE.Color(0x111111);
      materials.tabletop[opt.material].emissiveIntensity = 0.3;
      materials.tabletop[opt.material].roughness = 0.8;
    }
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
    if (!part || !materialName || !configurableObjects[part]) return;
    applyMaterial(configurableObjects[part], materials[part][materialName]);
    swatchOption.parentElement.querySelector('.active')?.classList.remove('active');
    swatchOption.classList.add('active');
  });

  const saveBtn = document.getElementById('save-screenshot-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', takeScreenshot);
  }

  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      loadModel(modelVariants[0], materials);
      // Reset color selections
      document.querySelectorAll('.swatches-container .swatch-option').forEach(swatch => {
        swatch.classList.remove('active');
      });
      // Activate first swatch in each category
      document.querySelectorAll('.swatches-container').forEach(container => {
        container.firstElementChild.classList.add('active');
      });
    });
  }

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
