/* /js/configurator.js (Finale Version für WORK-FREE) */
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
let configurableFrame = null;
let configurableSeat = null;
const viewerContainer = document.getElementById('configurator-container');
const loadingOverlay = document.getElementById('loading-overlay');
const frustumSize = 3;

// --- START: Screenshot-Funktionen ---
function getActiveModelName() {
  const activeModelSwitcher = document.querySelector('#model-switcher .model-switcher-item.active .model-name');
  return activeModelSwitcher ? activeModelSwitcher.textContent.trim() : 'Modell';
}

function getActiveColorName(part) {
    const selector = part === 'frame' ? '#frame-swatches' : '#seat-swatches';
    const activeSwatch = document.querySelector(`${selector} .swatch-option.active`);
    return activeSwatch ? activeSwatch.dataset.colorName : 'Standard';
}


function takeScreenshot() {
  renderer.render(scene, camera);
  const modelName = getActiveModelName();
  const frameColor = getActiveColorName('frame');
  const seatColor = getActiveColorName('seat');
  const sanitize = (name) => name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  const filename = `${sanitize(modelName)}_${sanitize(frameColor)}_${sanitize(seatColor)}.jpg`;
  const dataURL = renderer.domElement.toDataURL('image/jpeg', 0.95);
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
// --- END: Screenshot-Funktionen ---

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

function updateConditionalSwatches(variantName, materials) {
    const seatSwatchesContainer = document.getElementById('seat-swatches');
    if (!seatSwatchesContainer) return;

    const plasticSwatch = seatSwatchesContainer.querySelector('[data-color-name="Recycling-Kunststoff"]');
    if (!plasticSwatch) return;

    const is3Seater = (variantName === 'RELAX 3-Sitzer');
    plasticSwatch.style.display = is3Seater ? '' : 'none';

    if (!is3Seater && plasticSwatch.classList.contains('active')) {
        plasticSwatch.classList.remove('active');
        const firstAvailableSwatch = seatSwatchesContainer.querySelector('.swatch-option:not([data-color-name="Recycling-Kunststoff"])');

        if (firstAvailableSwatch) {
            firstAvailableSwatch.classList.add('active');
            const materialName = firstAvailableSwatch.dataset.material;
            if (materialName && configurableSeat && materials.seat[materialName]) {
                applyMaterial(configurableSeat, materials.seat[materialName]);
            }
        }
    }
}

function loadModel(variant, materials) {
  if (!variant) return;
  loadingOverlay.style.opacity = '1';
  loadingOverlay.style.display = 'flex';
  if (currentModel) scene.remove(currentModel);

  gltfLoader.load(variant.modelFile, (gltf) => {
    currentModel = gltf.scene;
    scene.add(currentModel);

    configurableFrame = currentModel.getObjectByName('Gestell');
    configurableSeat = currentModel.getObjectByName('Holz');

    if (!configurableFrame) console.error("Objekt 'Gestell' konnte im Modell nicht gefunden werden.");
    if (!configurableSeat) console.error("Objekt 'Holz' konnte im Modell nicht gefunden werden.");

    const activeFrameMaterialName = document.querySelector('#frame-swatches .active')?.dataset.material;
    if (activeFrameMaterialName && materials.frame[activeFrameMaterialName]) {
      applyMaterial(configurableFrame, materials.frame[activeFrameMaterialName]);
    }
    const activeSeatMaterialName = document.querySelector('#seat-swatches .active')?.dataset.material;
    if (activeSeatMaterialName && materials.seat[activeSeatMaterialName]) {
      applyMaterial(configurableSeat, materials.seat[activeSeatMaterialName]);
    }

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
      if (item.classList.contains('active')) return;
      document.querySelector('#model-switcher .active')?.classList.remove('active');
      item.classList.add('active');

      updateConditionalSwatches(variant.name, materials);
      loadModel(variant, materials);
    });
    container.appendChild(item);
  });
  container.firstChild?.classList.add('active');
}

async function init() {
  const config = await loadProductConfig();
  if (!config) {
      console.error("Config konnte nicht geladen werden, init abgebrochen.");
      return;
  }
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
    frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 0.1, 100
  );
  renderer = new THREE.WebGLRenderer({
    antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: isMobile() ? "low-power" : "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewerContainer.appendChild(renderer.domElement);
  if (isMobile()) {
    scene.add(new THREE.AmbientLight(0xffffff, 3.0));
  } else {
    new RGBELoader(loadingManager).load(config.environmentHdr, (texture) => {
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
  controls.addEventListener('end', () => {
    if(!document.getElementById('save-screenshot-btn')?.matches(':hover')) {
      controls.autoRotate = true;
    }
  });
  gltfLoader = new GLTFLoader(loadingManager);
  const textureLoader = new THREE.TextureLoader(loadingManager);

  const materials = { frame: {}, seat: {} };

  // Load frame materials
  config.colorOptions.frame.forEach(opt => {
    const texture = textureLoader.load(opt.color);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    // ** REMOVED ** The GLTF loader will handle this from the Blender file now.
    // texture.wrapS = THREE.RepeatWrapping;
    // texture.wrapT = THREE.RepeatWrapping;
    // texture.repeat.set(25, 25);
    materials.frame[opt.name] = new THREE.MeshStandardMaterial({ map: texture, metalness: 0.1, roughness: 0.8 });
  });

  // Load seat materials
  config.colorOptions.seat.forEach(opt => {
    const texture = textureLoader.load(opt.color);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    // The GLTF loader will handle rotation and scale automatically for the seat as well.
    materials.seat[opt.name] = new THREE.MeshStandardMaterial({ map: texture, metalness: 0.0, roughness: 0.9 });
  });

  const modelVariants = config.modelVariants;
  populateModelSwitcher(modelVariants, materials);

  updateConditionalSwatches(modelVariants[0].name, materials);
  loadModel(modelVariants[0], materials);

  // Event listeners remain the same...
  document.getElementById('frame-swatches')?.addEventListener('click', (e) => {
    const swatchOption = e.target.closest('.swatch-option');
    if (!swatchOption) return;
    controls.autoRotate = true;
    const materialName = swatchOption.dataset.material;
    if (materialName && configurableFrame && materials.frame[materialName]) {
      applyMaterial(configurableFrame, materials.frame[materialName]);
      swatchOption.parentElement.querySelector('.active')?.classList.remove('active');
      swatchOption.classList.add('active');
    }
  });

  document.getElementById('seat-swatches')?.addEventListener('click', (e) => {
    const swatchOption = e.target.closest('.swatch-option');
    if (!swatchOption) return;
    controls.autoRotate = true;
    const materialName = swatchOption.dataset.material;
    if (materialName && configurableSeat && materials.seat[materialName]) {
      applyMaterial(configurableSeat, materials.seat[materialName]);
      swatchOption.parentElement.querySelector('.active')?.classList.remove('active');
      swatchOption.classList.add('active');
    }
  });


  document.getElementById('save-screenshot-btn')?.addEventListener('click', takeScreenshot);
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      const { width, height } = entry.contentRect;
      const aspect = width / height;
      camera.left = frustumSize * aspect / -2; camera.right = frustumSize * aspect / 2;
      camera.top = frustumSize / 2; camera.bottom = frustumSize / -2;
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
