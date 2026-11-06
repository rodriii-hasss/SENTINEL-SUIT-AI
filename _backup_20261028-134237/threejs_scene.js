// Lunar scene using Three.js - Cinematic Version
// This file handles the 3D environment for SENTINEL RESCUE-X

let lunarRenderer = null;
let lunarScene = null;
let lunarCamera = null;
let lunarIsActive = false;
let astronautModel = null;
let roverModel = null;
let groundModel = null;
let emergencyLight = null;

function initLunarScene() {
  const sceneDiv = document.getElementById('lunarScene');
  if (!sceneDiv) return;
  
  if (lunarRenderer && lunarRenderer.domElement) {
    lunarRenderer.domElement.remove();
  }
  
  lunarRenderer = new THREE.WebGLRenderer({ antialias: true });
  lunarRenderer.setSize(sceneDiv.clientWidth, sceneDiv.clientHeight);
  lunarRenderer.setPixelRatio(window.devicePixelRatio);
  lunarRenderer.shadowMap.enabled = true;
  lunarRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sceneDiv.appendChild(lunarRenderer.domElement);
  
  lunarScene = new THREE.Scene();
  lunarScene.background = new THREE.Color(0x02050a);
  lunarScene.fog = new THREE.FogExp2(0x02050a, 0.05);
  
  // --- CINEMATIC LIGHTING ---
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
  sunLight.position.set(10, 20, 10);
  sunLight.castShadow = true;
  sunLight.shadow.camera.left = -20;
  sunLight.shadow.camera.right = 20;
  sunLight.shadow.camera.top = 20;
  sunLight.shadow.camera.bottom = -20;
  lunarScene.add(sunLight);

  const ambientLight = new THREE.AmbientLight(0x4040ff, 0.2);
  lunarScene.add(ambientLight);

  emergencyLight = new THREE.PointLight(0xff0000, 0, 10);
  emergencyLight.position.set(0, 2, 0);
  lunarScene.add(emergencyLight);

  // --- LUNAR SURFACE ---
  const groundGeo = new THREE.PlaneGeometry(100, 100, 32, 32);
  // Deform ground for realism
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, Math.sin(x * 0.2) * Math.cos(z * 0.2) * 0.5);
  }
  const groundMat = new THREE.MeshStandardMaterial({ 
    color: 0x1a1a1a, 
    roughness: 0.9, 
    metalness: 0.1 
  });
  groundModel = new THREE.Mesh(groundGeo, groundMat);
  groundModel.rotation.x = -Math.PI / 2;
  groundModel.receiveShadow = true;
  lunarScene.add(groundModel);

  // --- ASTRONAUT MODEL ---
  astronautModel = new THREE.Group();
  const suitMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.3 });
  
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.6, 4, 8), suitMat);
  torso.position.y = 0.6;
  torso.castShadow = true;
  astronautModel.add(torso);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), suitMat);
  helmet.position.y = 1.1;
  helmet.castShadow = true;
  astronautModel.add(helmet);

  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 1, roughness: 0 })
  );
  visor.position.set(0, 1.15, 0.1);
  visor.rotation.x = Math.PI / 2;
  astronautModel.add(visor);

  astronautModel.position.set(0, 0, 0);
  lunarScene.add(astronautModel);

  // --- ROVER MODEL ---
  roverModel = new THREE.Group();
  const roverBody = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.6, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 })
  );
  roverBody.position.y = 0.4;
  roverBody.castShadow = true;
  roverModel.add(roverBody);

  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const wheelsPos = [[0.6, 0.3, 0.6], [-0.6, 0.3, 0.6], [0.6, 0.3, -0.6], [-0.6, 0.3, -0.6]];
  wheelsPos.forEach(pos => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(...pos);
    w.rotation.z = Math.PI / 2;
    w.castShadow = true;
    roverModel.add(w);
  });

  roverModel.position.set(-10, 0, -5);
  lunarScene.add(roverModel);

  // Camera
  lunarCamera = new THREE.PerspectiveCamera(45, sceneDiv.clientWidth / sceneDiv.clientHeight, 0.1, 1000);
  lunarCamera.position.set(5, 3, 8);
  lunarCamera.lookAt(0, 0, 0);

  function animate() {
    if (!lunarIsActive) return;
    
    // Subtle astronaut breathing movement
    if (astronautModel) {
      astronautModel.position.y = Math.sin(Date.now() * 0.002) * 0.02;
    }

    lunarRenderer.render(lunarScene, lunarCamera);
    requestAnimationFrame(animate);
  }
  animate();

  window.addEventListener('resize', () => {
    lunarRenderer.setSize(sceneDiv.clientWidth, sceneDiv.clientHeight);
    lunarCamera.aspect = sceneDiv.clientWidth / sceneDiv.clientHeight;
    lunarCamera.updateProjectionMatrix();
  });
  
  lunarIsActive = true;
}

function updateAstronautState(state) {
  if (!astronautModel) return;
  
  if (state === 'NORMAL') {
    astronautModel.rotation.z = 0;
    astronautModel.position.set(0, 0, 0);
    if (emergencyLight) emergencyLight.intensity = 0;
  } else if (state === 'COLLAPSED') {
    astronautModel.rotation.z = Math.PI / 2;
    astronautModel.position.set(0, 0.2, 0);
    if (emergencyLight) emergencyLight.intensity = 2;
  }
}

function moveRover(x, z) {
  if (!roverModel) return;
  roverModel.position.set(x, 0, z);
}

function toggleLunarScene(active) {
  if (active && !lunarIsActive) {
    initLunarScene();
  } else if (!active && lunarIsActive) {
    if (lunarRenderer && lunarRenderer.domElement) {
      lunarRenderer.domElement.style.display = 'none';
    }
    lunarIsActive = false;
  }
}

window.initLunarScene = initLunarScene;
window.toggleLunarScene = toggleLunarScene;
window.updateAstronautState = updateAstronautState;
window.moveRover = moveRover;
