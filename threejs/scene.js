// Lunar 3D scene for SENTINEL RESCUE-X (classic Three.js global build)
'use strict';

var lunarRenderer = null;
var lunarScene = null;
var lunarCamera = null;
var lunarIsActive = false;
var lunarGeneration = 0;
var astronautModel = null;
var roverModel = null;
var groundModel = null;
var emergencyLight = null;
var lunarGridGroup = null;
var lunarResizeBound = false;
var lunarPointerBound = false;
var lunarTextures = null;
var lunarMaterials = null;
var lunarFx = null;
var lunarClock = null;
var lunarGridSize = { cols: 16, rows: 11 };

var lunarRover = {
  x: -10, z: -5, targetX: -10, targetZ: -5,
  heading: 0, targetHeading: 0, wheelSpin: 0, moving: false, initialized: false
};

var lunarAstro = { collapsed: false, blend: 0 };

var lunarOrbit = {
  azimuth: 0.18, targetAzimuth: 0.18,
  distance: 20, targetDistance: 20,
  fitDistance: 20, holdUntil: 0, dragging: false, lastX: 0
};

function lunarClamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function lunarSmooth(a, b, x) {
  var t = lunarClamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function lunarRand(seed) {
  var s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    var t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lunarMakeCanvas(size) {
  var canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function lunarMakeRegolithTexture() {
  var canvas = lunarMakeCanvas(512);
  var ctx = canvas.getContext('2d');
  var rnd = lunarRand(20261030);
  ctx.fillStyle = '#9c9a96';
  ctx.fillRect(0, 0, 512, 512);

  for (var i = 0; i < 9000; i++) {
    var g = 108 + Math.floor(rnd() * 92);
    var a = 0.12 + rnd() * 0.5;
    ctx.fillStyle = 'rgba(' + g + ',' + g + ',' + (g - 3) + ',' + a.toFixed(2) + ')';
    var s = 1 + rnd() * 2.4;
    ctx.fillRect(rnd() * 512, rnd() * 512, s, s);
  }

  for (i = 0; i < 240; i++) {
    var bx = rnd() * 512;
    var by = rnd() * 512;
    var br = 6 + rnd() * 34;
    var grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    var dark = rnd() > 0.5;
    grad.addColorStop(0, dark ? 'rgba(70,68,66,0.16)' : 'rgba(196,194,190,0.14)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  for (i = 0; i < 110; i++) {
    var cx = rnd() * 512;
    var cy = rnd() * 512;
    var cr = 2 + rnd() * 15;
    ctx.strokeStyle = 'rgba(225,222,215,0.22)';
    ctx.lineWidth = 1 + rnd() * 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, Math.PI * 0.9, Math.PI * 2.1);
    ctx.stroke();
    ctx.fillStyle = 'rgba(58,56,54,0.16)';
    ctx.beginPath();
    ctx.arc(cx + cr * 0.12, cy + cr * 0.14, cr * 0.82, 0, Math.PI * 2);
    ctx.fill();
  }

  var tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 9);
  if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function lunarMakeBumpTexture(sourceCanvas) {
  var tex = new THREE.CanvasTexture(sourceCanvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 9);
  if ('colorSpace' in tex && THREE.NoColorSpace !== undefined) tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function lunarMakeSolarTexture() {
  var canvas = lunarMakeCanvas(256);
  var ctx = canvas.getContext('2d');
  var grd = ctx.createLinearGradient(0, 0, 256, 256);
  grd.addColorStop(0, '#0a2f4e');
  grd.addColorStop(0.5, '#0d3d63');
  grd.addColorStop(1, '#071f36');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(120,205,255,0.5)';
  ctx.lineWidth = 1;
  for (var x = 0; x <= 256; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
  }
  for (var y = 0; y <= 256; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(190,240,255,0.75)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 253, 253);
  var tex = new THREE.CanvasTexture(canvas);
  if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function lunarMakeEarthTexture() {
  var canvas = lunarMakeCanvas(256);
  var ctx = canvas.getContext('2d');
  var rnd = lunarRand(1969);
  ctx.fillStyle = '#123f6e';
  ctx.fillRect(0, 0, 256, 256);
  for (var i = 0; i < 70; i++) {
    var x = rnd() * 256;
    var y = rnd() * 256;
    var w = 12 + rnd() * 54;
    var h = 8 + rnd() * 32;
    ctx.fillStyle = rnd() > 0.45 ? 'rgba(60,120,90,0.65)' : 'rgba(210,222,230,0.55)';
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  var shade = ctx.createRadialGradient(80, 70, 10, 128, 128, 190);
  shade.addColorStop(0, 'rgba(140,210,255,0.22)');
  shade.addColorStop(1, 'rgba(2,8,20,0.6)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 256, 256);
  var tex = new THREE.CanvasTexture(canvas);
  if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function lunarMakeGlowTexture(inner, outer) {
  var canvas = lunarMakeCanvas(128);
  var ctx = canvas.getContext('2d');
  var grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.35, outer);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  var tex = new THREE.CanvasTexture(canvas);
  if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function lunarMakeLabel(text, color) {
  var canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 80;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 320, 80);
  ctx.fillStyle = 'rgba(4,12,24,0.72)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(6, 10, 308, 60, 12);
  } else {
    ctx.rect(6, 10, 308, 60);
  }
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 38px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 160, 42);
  var tex = new THREE.CanvasTexture(canvas);
  if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  var sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.15, 0.29, 1);
  return sprite;
}

function lunarAddBlinker(parent, color, size, position, phase, speed) {
  var mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 });
  var mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 10), mat);
  mesh.position.copy(position);
  parent.add(mesh);
  var glowMat = new THREE.SpriteMaterial({
    map: lunarTextures.glowWhite,
    color: color,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  var glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(size * 12);
  mesh.add(glow);
  var item = { mesh: mesh, mat: mat, glow: glowMat, phase: phase || 0, speed: speed || 2.2 };
  lunarFx.blinkers.push(item);
  return item;
}

function lunarLink(a, b, radius, material) {
  var dir = new THREE.Vector3().subVectors(b, a);
  var len = dir.length();
  var mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 8), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  return mesh;
}

function lunarDisposeGroup(group) {
  if (!group) return;
  if (group.parent) group.parent.remove(group);
  group.traverse(function (obj) {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.isSprite && obj.material && obj.material.map && obj.material.map !== lunarTextures.glowWhite) {
      obj.material.map.dispose();
    }
    if (obj.isSprite && obj.material) obj.material.dispose();
  });
}

function lunarDisposeScene() {
  if (lunarScene) {
    var seen = new Set();
    lunarScene.traverse(function (obj) {
      if (obj.geometry) obj.geometry.dispose();
      var mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
      mats.forEach(function (m) {
        if (!m || seen.has(m)) return;
        seen.add(m);
        ['map', 'bumpMap', 'roughnessMap', 'emissiveMap', 'normalMap', 'alphaMap'].forEach(function (k) {
          if (m[k] && !seen.has(m[k])) { seen.add(m[k]); m[k].dispose(); }
        });
        m.dispose();
      });
    });
  }
  if (lunarRenderer) {
    try { lunarRenderer.dispose(); } catch (e) {}
    if (lunarRenderer.domElement && lunarRenderer.domElement.parentNode) {
      lunarRenderer.domElement.parentNode.removeChild(lunarRenderer.domElement);
    }
  }
  lunarRenderer = null;
  lunarScene = null;
  lunarCamera = null;
  astronautModel = null;
  roverModel = null;
  groundModel = null;
  emergencyLight = null;
  lunarGridGroup = null;
  lunarTextures = null;
  lunarMaterials = null;
  lunarFx = null;
  lunarClock = null;
}

function lunarBuildMaterials() {
  var regolithCanvas = lunarMakeRegolithTexture();
  var regolithMap = regolithCanvas;
  var bump = lunarMakeBumpTexture(regolithMap.image);

  lunarTextures = {
    regolith: regolithMap,
    regolithBump: bump,
    solar: lunarMakeSolarTexture(),
    earth: lunarMakeEarthTexture(),
    glowWhite: lunarMakeGlowTexture('rgba(255,255,255,1)', 'rgba(190,225,255,0.5)'),
    glowCyan: lunarMakeGlowTexture('rgba(180,245,255,1)', 'rgba(0,190,255,0.45)'),
    glowAmber: lunarMakeGlowTexture('rgba(255,232,170,1)', 'rgba(255,170,40,0.4)'),
    glowRed: lunarMakeGlowTexture('rgba(255,190,190,1)', 'rgba(255,40,70,0.4)')
  };

  var aniso = lunarRenderer.capabilities.getMaxAnisotropy ? Math.min(8, lunarRenderer.capabilities.getMaxAnisotropy()) : 1;
  ['regolith', 'regolithBump', 'solar', 'earth'].forEach(function (k) {
    if (lunarTextures[k]) lunarTextures[k].anisotropy = aniso;
  });

  lunarMaterials = {
    regolith: new THREE.MeshStandardMaterial({
      map: lunarTextures.regolith,
      bumpMap: lunarTextures.regolithBump,
      bumpScale: 0.05,
      color: 0xa9a49c,
      roughness: 0.97,
      metalness: 0.02
    }),
    rock: [
      new THREE.MeshStandardMaterial({ color: 0x6f6a64, roughness: 0.95, metalness: 0.04 }),
      new THREE.MeshStandardMaterial({ color: 0x7d786f, roughness: 0.93, metalness: 0.05 }),
      new THREE.MeshStandardMaterial({ color: 0x5c5852, roughness: 0.96, metalness: 0.03 })
    ],
    rockObstacle: new THREE.MeshStandardMaterial({ color: 0x5f6368, roughness: 0.9, metalness: 0.08 }),
    suit: new THREE.MeshStandardMaterial({ color: 0xf1f2f4, roughness: 0.46, metalness: 0.05 }),
    suitShade: new THREE.MeshStandardMaterial({ color: 0xd8dbe0, roughness: 0.6, metalness: 0.04 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x232b35, roughness: 0.55, metalness: 0.55 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb8c2cc, roughness: 0.34, metalness: 0.82 }),
    metalDark: new THREE.MeshStandardMaterial({ color: 0x3a444f, roughness: 0.4, metalness: 0.85 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd2a54a, roughness: 0.32, metalness: 1 }),
    visor: new THREE.MeshStandardMaterial({
      color: 0xf0b93c, roughness: 0.08, metalness: 1,
      emissive: 0x5a3a05, emissiveIntensity: 0.35
    }),
    solar: new THREE.MeshStandardMaterial({
      map: lunarTextures.solar, roughness: 0.28, metalness: 0.5,
      emissive: 0x061a2c, emissiveIntensity: 0.6
    }),
    tire: new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.92, metalness: 0.05 }),
    hub: new THREE.MeshStandardMaterial({ color: 0x9fabb8, roughness: 0.35, metalness: 0.8 }),
    pad: new THREE.MeshStandardMaterial({ color: 0x141c26, roughness: 0.4, metalness: 0.7 }),
    padRing: new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 }),
    route: new THREE.MeshBasicMaterial({
      color: 0x22d3ee, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false
    }),
    waypoint: new THREE.MeshBasicMaterial({
      color: 0x7fe9ff, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false
    }),
    grid: new THREE.LineBasicMaterial({ color: 0x2b5a78, transparent: true, opacity: 0.38 }),
    gridEdge: new THREE.LineBasicMaterial({ color: 0x3ad2ff, transparent: true, opacity: 0.55 }),
    astroRing: new THREE.MeshBasicMaterial({
      color: 0xfbbf24, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false
    }),
    astroBeam: new THREE.MeshBasicMaterial({
      color: 0xfbbf24, transparent: true, opacity: 0.1,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
  };
}

function lunarBuildSky() {
  var scene = lunarScene;
  var starGeo = new THREE.BufferGeometry();
  var count = 1100;
  var positions = new Float32Array(count * 3);
  var colors = new Float32Array(count * 3);
  var rnd = lunarRand(424242);
  var color = new THREE.Color();
  for (var i = 0; i < count; i++) {
    var r = 90 + rnd() * 130;
    var theta = rnd() * Math.PI * 2;
    var phi = Math.acos(rnd() * 1.35 - 0.35);
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.abs(Math.cos(phi)) * r * 0.75 + 8;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    color.setHSL(0.55 + rnd() * 0.08, 0.25 + rnd() * 0.4, 0.62 + rnd() * 0.35);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  var starMat = new THREE.PointsMaterial({
    size: 0.85,
    map: lunarTextures.glowWhite,
    transparent: true,
    opacity: 0.9,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  var stars = new THREE.Points(starGeo, starMat);
  stars.name = 'stars';
  scene.add(stars);

  var earth = new THREE.Mesh(
    new THREE.SphereGeometry(5.4, 32, 32),
    new THREE.MeshStandardMaterial({
      map: lunarTextures.earth,
      roughness: 0.85,
      metalness: 0.05,
      emissive: 0x0a2340,
      emissiveIntensity: 1.1
    })
  );
  earth.position.set(-26, 25, -34);
  earth.name = 'earth';
  scene.add(earth);

  var haloMat = new THREE.SpriteMaterial({
    map: lunarTextures.glowWhite,
    color: 0x4aa8ff,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  var halo = new THREE.Sprite(haloMat);
  halo.position.copy(earth.position);
  halo.scale.setScalar(16);
  halo.name = 'earthHalo';
  scene.add(halo);

  var sunMat = new THREE.SpriteMaterial({
    map: lunarTextures.glowAmber,
    color: 0xfff2cf,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  var sun = new THREE.Sprite(sunMat);
  sun.position.set(42, 44, 28);
  sun.scale.setScalar(22);
  scene.add(sun);
}

function lunarBuildTerrain() {
  var geo = new THREE.PlaneGeometry(130, 130, 130, 130);
  var pos = geo.attributes.position;
  var rnd = lunarRand(7319);
  var craters = [];
  for (var i = 0; i < 60; i++) {
    craters.push({
      x: (rnd() - 0.5) * 120,
      z: (rnd() - 0.5) * 120,
      r: 1.1 + rnd() * 5.4,
      d: 0.1 + rnd() * 0.45
    });
  }
  for (i = 0; i < pos.count; i++) {
    var x = pos.getX(i);
    var y = pos.getY(i);
    var h = Math.sin(x * 0.13) * Math.cos(y * 0.11) * 0.35 +
            Math.sin(x * 0.34 + 1.7) * Math.cos(y * 0.29) * 0.12 +
            Math.sin((x + y) * 0.07) * 0.18;
    for (var c = 0; c < craters.length; c++) {
      var cr = craters[c];
      var dx = x - cr.x;
      var dz = y - cr.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < cr.r) {
        var q = dist / cr.r;
        h -= cr.d * (1 - q * q);
        h += cr.d * 0.28 * Math.exp(-Math.pow((dist - cr.r * 0.92) / (cr.r * 0.16), 2));
      }
    }
    h *= lunarSmooth(10.5, 19, Math.sqrt(x * x + y * y));
    pos.setZ(i, h);
  }
  geo.computeVertexNormals();

  groundModel = new THREE.Mesh(geo, lunarMaterials.regolith);
  groundModel.rotation.x = -Math.PI / 2;
  groundModel.receiveShadow = true;
  lunarScene.add(groundModel);

  var boulderGroup = new THREE.Group();
  for (i = 0; i < 22; i++) {
    var ang = rnd() * Math.PI * 2;
    var rad = 17 + rnd() * 28;
    var scale = 0.35 + rnd() * 1.15;
    var rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(scale, 0),
      lunarMaterials.rock[i % lunarMaterials.rock.length]
    );
    rock.position.set(Math.cos(ang) * rad, scale * 0.4 - 0.05, Math.sin(ang) * rad);
    rock.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
    rock.scale.y = 0.6 + rnd() * 0.5;
    rock.castShadow = true;
    rock.receiveShadow = true;
    boulderGroup.add(rock);
  }
  boulderGroup.name = 'boulders';
  lunarScene.add(boulderGroup);
}

function lunarBuildLights() {
  var lowPower = Math.min(window.innerWidth || 1024, window.innerHeight || 768) < 700;

  var sunLight = new THREE.DirectionalLight(0xfff1dc, 2.7);
  sunLight.position.set(16, 26, 14);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = lowPower ? 1024 : 2048;
  sunLight.shadow.mapSize.height = lowPower ? 1024 : 2048;
  sunLight.shadow.camera.left = -24;
  sunLight.shadow.camera.right = 24;
  sunLight.shadow.camera.top = 24;
  sunLight.shadow.camera.bottom = -24;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 90;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.02;
  lunarScene.add(sunLight);

  var hemi = new THREE.HemisphereLight(0x3d5f8f, 0x0b0c10, 0.6);
  lunarScene.add(hemi);

  var ambient = new THREE.AmbientLight(0x22334a, 0.42);
  lunarScene.add(ambient);

  var rim = new THREE.DirectionalLight(0x2fa8ff, 0.85);
  rim.position.set(-16, 10, -14);
  lunarScene.add(rim);

  emergencyLight = new THREE.PointLight(0xff2f4f, 0, 15, 2);
  emergencyLight.position.set(0, 2.6, 0);
  lunarScene.add(emergencyLight);
}

function lunarBuildAstronaut() {
  astronautModel = new THREE.Group();
  var g = astronautModel;
  var suit = lunarMaterials.suit;
  var shade = lunarMaterials.suitShade;
  var dark = lunarMaterials.dark;

  var torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.48, 6, 16), suit);
  torso.position.y = 0.82;
  torso.castShadow = true;
  g.add(torso);

  var hip = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.16, 16), shade);
  hip.position.y = 0.5;
  hip.castShadow = true;
  g.add(hip);

  var pack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.56, 0.24), suit);
  pack.position.set(0, 0.88, -0.29);
  pack.castShadow = true;
  g.add(pack);

  var packPlate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.03), dark);
  packPlate.position.set(0, 0.9, -0.42);
  g.add(packPlate);

  for (var v = 0; v < 3; v++) {
    var vent = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.02), lunarMaterials.metalDark);
    vent.position.set(0, 0.76 + v * 0.09, -0.435);
    g.add(vent);
  }

  var chest = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.13), shade);
  chest.position.set(0, 0.86, 0.22);
  chest.castShadow = true;
  g.add(chest);

  var screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.1, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x06303e, emissive: 0x22d3ee, emissiveIntensity: 0.9, roughness: 0.3 })
  );
  screen.position.set(0, 0.89, 0.29);
  g.add(screen);

  [-0.09, 0.09].forEach(function (bx) {
    var btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.014, 10),
      new THREE.MeshStandardMaterial({ color: 0x330a0a, emissive: 0xff3d5e, emissiveIntensity: 0.7 })
    );
    btn.rotation.x = Math.PI / 2;
    btn.position.set(bx, 0.79, 0.29);
    g.add(btn);
  });

  [-1, 1].forEach(function (side) {
    var shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 14), shade);
    shoulder.position.set(side * 0.29, 1.0, 0);
    shoulder.castShadow = true;
    g.add(shoulder);

    var upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.24, 4, 10), suit);
    upper.position.set(side * 0.36, 0.83, 0.02);
    upper.rotation.z = side * 0.28;
    upper.castShadow = true;
    g.add(upper);

    var lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.22, 4, 10), shade);
    lower.position.set(side * 0.42, 0.6, 0.06);
    lower.rotation.z = side * 0.18;
    lower.castShadow = true;
    g.add(lower);

    var glove = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 12), dark);
    glove.position.set(side * 0.45, 0.44, 0.1);
    glove.castShadow = true;
    g.add(glove);

    var leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.38, 4, 10), suit);
    leg.position.set(side * 0.14, 0.3, 0);
    leg.castShadow = true;
    g.add(leg);

    var knee = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.14), dark);
    knee.position.set(side * 0.14, 0.22, 0.02);
    g.add(knee);

    var boot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.3), shade);
    boot.position.set(side * 0.14, 0.065, 0.06);
    boot.castShadow = true;
    g.add(boot);

    var sole = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.31), dark);
    sole.position.set(side * 0.14, 0.02, 0.06);
    g.add(sole);
  });

  var helmet = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 24), suit);
  helmet.position.y = 1.28;
  helmet.castShadow = true;
  g.add(helmet);

  var visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.235, 24, 18, Math.PI * 1.12, Math.PI * 0.76, Math.PI * 0.22, Math.PI * 0.5),
    lunarMaterials.visor
  );
  visor.position.set(0, 1.29, 0.045);
  visor.rotation.y = Math.PI;
  g.add(visor);

  var rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.018, 8, 26), lunarMaterials.metal);
  rimRing.position.set(0, 1.29, 0.06);
  g.add(rimRing);

  var lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, 0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff4d6, emissiveIntensity: 1.4 })
  );
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(0.14, 1.4, 0.19);
  g.add(lamp);

  var hoseCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.2, 0.95, -0.32),
    new THREE.Vector3(-0.5, 1.05, -0.1),
    new THREE.Vector3(-0.2, 1.18, 0.02)
  );
  var hose = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 16, 0.025, 6, false), shade);
  hose.castShadow = true;
  g.add(hose);

  lunarAddBlinker(g, 0xffb400, 0.045, new THREE.Vector3(0.28, 1.2, 0.06), 0, 2.6);

  var label = lunarMakeLabel('EVA-04', '#fbbf24');
  label.position.set(0, 1.72, 0);
  label.scale.set(0.95, 0.24, 1);
  g.add(label);

  var ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.015, 8, 40), lunarMaterials.astroRing);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.015;
  ring.name = 'astroRing';
  g.add(ring);

  var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.4, 2.4, 16, 1, true), lunarMaterials.astroBeam);
  beam.position.y = 1.2;
  beam.name = 'astroBeam';
  g.add(beam);

  g.scale.setScalar(0.72);
  g.position.set(0, 0, 0);
  lunarScene.add(g);
}

function lunarBuildRover() {
  roverModel = new THREE.Group();
  var r = roverModel;
  var metal = lunarMaterials.metal;
  var metalDark = lunarMaterials.metalDark;

  var chassis = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.26, 1.48), metalDark);
  chassis.position.y = 0.48;
  chassis.castShadow = true;
  r.add(chassis);

  var deck = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.18, 1.12), metal);
  deck.position.y = 0.68;
  deck.castShadow = true;
  r.add(deck);

  var nose = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.2), lunarMaterials.suitShade);
  nose.position.set(0, 0.62, 0.76);
  nose.castShadow = true;
  r.add(nose);

  var goldBox = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.3), lunarMaterials.gold);
  goldBox.position.set(0.26, 0.72, -0.42);
  goldBox.castShadow = true;
  r.add(goldBox);

  var instrument = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.24), lunarMaterials.suitShade);
  instrument.position.set(-0.28, 0.7, -0.38);
  instrument.castShadow = true;
  r.add(instrument);

  var panelFrame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 1.18), lunarMaterials.metalDark);
  panelFrame.position.set(0, 0.81, -0.02);
  panelFrame.rotation.x = -0.1;
  panelFrame.castShadow = true;
  r.add(panelFrame);

  var panel = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.035, 1.12), lunarMaterials.solar);
  panel.position.set(0, 0.845, -0.02);
  panel.rotation.x = -0.1;
  panel.castShadow = true;
  r.add(panel);

  [-0.54, 0.54].forEach(function (side) {
    var fender = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 1.42), metalDark);
    fender.position.set(side, 0.66, 0);
    fender.castShadow = true;
    r.add(fender);

    var strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.035, 0.8),
      new THREE.MeshBasicMaterial({ color: 0x2fd8ff })
    );
    strip.position.set(side * 1.01, 0.56, 0);
    r.add(strip);

    r.add(lunarLink(
      new THREE.Vector3(side * 0.42, 0.52, 0.55),
      new THREE.Vector3(side * 0.62, 0.32, 0.55),
      0.028, metal
    ));
    r.add(lunarLink(
      new THREE.Vector3(side * 0.42, 0.52, -0.55),
      new THREE.Vector3(side * 0.62, 0.32, -0.55),
      0.028, metal
    ));
    r.add(lunarLink(
      new THREE.Vector3(side * 0.62, 0.32, 0.55),
      new THREE.Vector3(side * 0.62, 0.32, -0.55),
      0.03, metalDark
    ));
  });

  var wheelGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.17, 22);
  var hubGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.185, 14);
  var treadGeo = new THREE.BoxGeometry(0.16, 0.028, 0.055);
  lunarFx.wheels = [];

  var positions = [];
  [0.55, 0, -0.55].forEach(function (z) {
    positions.push([0.63, 0.25, z]);
    positions.push([-0.63, 0.25, z]);
  });

  positions.forEach(function (p) {
    var wheelGroup = new THREE.Group();
    wheelGroup.position.set(p[0], p[1], p[2]);
    r.add(wheelGroup);

    var tire = new THREE.Mesh(wheelGeo, lunarMaterials.tire);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheelGroup.add(tire);

    var hub = new THREE.Mesh(hubGeo, lunarMaterials.hub);
    hub.rotation.z = Math.PI / 2;
    wheelGroup.add(hub);

    for (var k = 0; k < 14; k++) {
      var a = (k / 14) * Math.PI * 2;
      var tread = new THREE.Mesh(treadGeo, metalDark);
      tread.position.set(0, Math.cos(a) * 0.235, Math.sin(a) * 0.235);
      tread.rotation.x = a;
      wheelGroup.add(tread);
    }
    lunarFx.wheels.push(wheelGroup);
  });

  var mastBase = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.1, 12), metalDark);
  mastBase.position.set(0, 0.77, 0.42);
  r.add(mastBase);

  var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.5, 10), metal);
  mast.position.set(0, 1.02, 0.42);
  mast.castShadow = true;
  r.add(mast);

  var head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.14), lunarMaterials.suitShade);
  head.position.set(0, 1.3, 0.42);
  head.castShadow = true;
  r.add(head);

  [-0.062, 0.062].forEach(function (ox) {
    var lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.05, 14),
      new THREE.MeshStandardMaterial({ color: 0x05131f, emissive: 0x2fd8ff, emissiveIntensity: 0.7, metalness: 0.8, roughness: 0.2 })
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.set(ox, 1.3, 0.5);
    r.add(lens);
  });

  var dish = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xe8ebee, metalness: 0.25, roughness: 0.65, side: THREE.DoubleSide })
  );
  dish.scale.set(1, 0.45, 1);
  dish.rotation.x = -2.3;
  dish.position.set(-0.3, 1.02, -0.42);
  dish.castShadow = true;
  r.add(dish);

  var dishArm = lunarLink(
    new THREE.Vector3(-0.3, 0.71, -0.4),
    new THREE.Vector3(-0.3, 0.94, -0.4),
    0.018, metal
  );
  r.add(dishArm);

  var whip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 8), metal);
  whip.position.set(-0.38, 1.05, 0.22);
  r.add(whip);

  lunarAddBlinker(r, 0xff3d5e, 0.035, new THREE.Vector3(-0.38, 1.38, 0.22), 0.4, 3.1);
  lunarAddBlinker(r, 0x22d3ee, 0.028, new THREE.Vector3(0.4, 1.14, 0.34), 1.7, 1.7);

  [-0.26, 0.26].forEach(function (hx) {
    var lightMat = new THREE.MeshStandardMaterial({
      color: 0x101820, emissive: 0x9fe8ff, emissiveIntensity: 1.6, roughness: 0.2
    });
    var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), lightMat);
    lamp.position.set(hx, 0.66, 0.83);
    r.add(lamp);
  });

  var frontGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: lunarTextures.glowCyan,
    color: 0x8fe6ff,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  frontGlow.position.set(0, 0.64, 0.9);
  frontGlow.scale.set(1.8, 0.8, 1);
  r.add(frontGlow);

  var roverLight = new THREE.PointLight(0x8fe6ff, 1.4, 5, 2);
  roverLight.position.set(0, 0.62, 0.95);
  r.add(roverLight);
  lunarFx.roverLight = roverLight;

  var label = lunarMakeLabel('RX-1', '#22d3ee');
  label.position.set(0, 1.62, 0);
  r.add(label);

  r.scale.setScalar(0.78);
  r.position.set(-10, 0, -5);
  lunarScene.add(r);
}

function lunarCameraFit() {
  var host = document.getElementById('lunarScene');
  if (!host || !lunarCamera) return;
  var w = Math.max(1, host.clientWidth);
  var h = Math.max(1, host.clientHeight);
  var aspect = w / h;
  var dist = 20.5 * (aspect < 0.95 ? 1.32 : 1);
  lunarOrbit.fitDistance = dist;
  lunarOrbit.distance = lunarClamp(lunarOrbit.distance, dist * 0.7, dist * 1.6);
  lunarOrbit.targetDistance = lunarClamp(lunarOrbit.targetDistance, dist * 0.7, dist * 1.6);
  lunarCamera.aspect = aspect;
  lunarCamera.updateProjectionMatrix();
}

function lunarBindPointer() {
  if (lunarPointerBound || !lunarRenderer) return;
  lunarPointerBound = true;
  var canvas = lunarRenderer.domElement;
  canvas.style.touchAction = 'pan-y';

  canvas.addEventListener('pointerdown', function (e) {
    lunarOrbit.dragging = true;
    lunarOrbit.lastX = e.clientX;
    lunarOrbit.holdUntil = performance.now() + 6500;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!lunarOrbit.dragging) return;
    var dx = e.clientX - lunarOrbit.lastX;
    lunarOrbit.lastX = e.clientX;
    lunarOrbit.targetAzimuth -= dx * 0.006;
    lunarOrbit.holdUntil = performance.now() + 6500;
  });

  function endDrag() { lunarOrbit.dragging = false; }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', endDrag);

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    lunarOrbit.targetDistance = lunarClamp(lunarOrbit.targetDistance + e.deltaY * 0.012, 12, 36);
    lunarOrbit.holdUntil = performance.now() + 6500;
  }, { passive: false });

  canvas.addEventListener('dblclick', function () {
    lunarOrbit.targetAzimuth = 0.18;
    lunarOrbit.targetDistance = lunarOrbit.fitDistance;
  });
}

function initLunarScene() {
  var sceneDiv = document.getElementById('lunarScene');
  if (!sceneDiv || typeof THREE === 'undefined') return;

  lunarGeneration++;
  var generation = lunarGeneration;
  lunarIsActive = true;

  lunarDisposeScene();

  lunarFx = { blinkers: [], wheels: [], gridBlinkers: [] };
  lunarRover.initialized = false;
  lunarAstro.collapsed = false;
  lunarAstro.blend = 0;

  lunarRenderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  lunarRenderer.setSize(Math.max(1, sceneDiv.clientWidth), Math.max(1, sceneDiv.clientHeight));
  lunarRenderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  lunarRenderer.shadowMap.enabled = true;
  lunarRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if ('outputColorSpace' in lunarRenderer && THREE.SRGBColorSpace) {
    lunarRenderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  if ('toneMapping' in lunarRenderer) {
    lunarRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    lunarRenderer.toneMappingExposure = 1.08;
  }
  lunarRenderer.domElement.style.display = 'block';
  lunarRenderer.domElement.style.width = '100%';
  lunarRenderer.domElement.style.height = '100%';
  sceneDiv.appendChild(lunarRenderer.domElement);

  lunarScene = new THREE.Scene();
  lunarScene.background = new THREE.Color(0x01030a);
  lunarScene.fog = new THREE.FogExp2(0x01030a, 0.0095);

  lunarBuildMaterials();
  lunarBuildLights();
  lunarBuildSky();
  lunarBuildTerrain();
  lunarBuildAstronaut();
  lunarBuildRover();

  lunarCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
  lunarCameraFit();
  lunarCamera.position.set(0, 15, 20);
  lunarCamera.lookAt(0, 0.4, 0);

  lunarClock = new THREE.Clock();
  lunarBindPointer();

  function animate() {
    if (generation !== lunarGeneration || !lunarIsActive) return;
    requestAnimationFrame(animate);
    if (document.hidden) return;

    var dt = Math.min(0.05, lunarClock.getDelta());
    var t = lunarClock.elapsedTime;
    var now = performance.now();

    if (now > lunarOrbit.holdUntil) lunarOrbit.targetAzimuth += dt * 0.055;
    lunarOrbit.azimuth += (lunarOrbit.targetAzimuth - lunarOrbit.azimuth) * Math.min(1, dt * 5);
    lunarOrbit.distance += (lunarOrbit.targetDistance - lunarOrbit.distance) * Math.min(1, dt * 4);

    var dist = lunarOrbit.distance;
    lunarCamera.position.set(
      Math.sin(lunarOrbit.azimuth) * dist,
      dist * 0.74,
      Math.cos(lunarOrbit.azimuth) * dist
    );
    lunarCamera.lookAt(0, 0.5, 0);

    var stars = lunarScene.getObjectByName('stars');
    if (stars) stars.rotation.y += dt * 0.006;
    var earth = lunarScene.getObjectByName('earth');
    if (earth) earth.rotation.y += dt * 0.05;

    if (roverModel) {
      var dx = lunarRover.targetX - lunarRover.x;
      var dz = lunarRover.targetZ - lunarRover.z;
      var moved = Math.sqrt(dx * dx + dz * dz);
      lunarRover.moving = moved > 0.002;
      var ease = Math.min(1, dt * 4.2);
      var px = lunarRover.x;
      var pz = lunarRover.z;
      lunarRover.x += dx * ease;
      lunarRover.z += dz * ease;
      if (moved > 0.04) {
        lunarRover.targetHeading = Math.atan2(dx, dz);
      }
      var diff = lunarRover.targetHeading - lunarRover.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      lunarRover.heading += diff * Math.min(1, dt * 4);
      roverModel.position.set(lunarRover.x, 0, lunarRover.z);
      roverModel.rotation.y = lunarRover.heading;

      var step = Math.sqrt(Math.pow(lunarRover.x - px, 2) + Math.pow(lunarRover.z - pz, 2));
      lunarRover.wheelSpin += step / 0.23;
      if (lunarFx.wheels) {
        lunarFx.wheels.forEach(function (w) { w.rotation.x = lunarRover.wheelSpin; });
      }
      var bob = lunarRover.moving ? Math.sin(t * 14) * 0.008 : 0;
      roverModel.position.y = bob;
      if (lunarFx.roverLight) {
        lunarFx.roverLight.intensity = lunarRover.moving ? 1.8 : 1.2 + Math.sin(t * 2.2) * 0.15;
      }
    }

    if (astronautModel) {
      var targetBlend = lunarAstro.collapsed ? 1 : 0;
      lunarAstro.blend += (targetBlend - lunarAstro.blend) * Math.min(1, dt * 5);
      astronautModel.rotation.z = lunarAstro.blend * Math.PI * 0.48;
      astronautModel.position.y = lunarAstro.blend * 0.2 + (1 - lunarAstro.blend) * Math.sin(t * 1.5) * 0.008;
      var ring = astronautModel.getObjectByName('astroRing');
      if (ring) {
        ring.rotation.z += dt * 0.7;
        ring.scale.setScalar(1 + Math.sin(t * 2.4) * 0.08);
        lunarMaterials.astroRing.opacity = 0.45 + Math.sin(t * 2.4) * 0.22;
      }
      var beam = astronautModel.getObjectByName('astroBeam');
      if (beam) lunarMaterials.astroBeam.opacity = 0.07 + Math.sin(t * 1.8) * 0.03;
      if (emergencyLight) {
        emergencyLight.position.set(astronautModel.position.x, 2.4, astronautModel.position.z);
        emergencyLight.intensity = lunarAstro.blend * (2.2 + Math.sin(t * 9) * 1.5);
      }
    }

    if (lunarFx.blinkers) {
      lunarFx.blinkers.forEach(function (b) {
        var pulse = 0.45 + 0.55 * Math.pow(Math.sin(t * b.speed + b.phase) * 0.5 + 0.5, 2);
        b.mat.opacity = 0.35 + pulse * 0.65;
        b.mesh.scale.setScalar(0.8 + pulse * 0.6);
        if (b.glow) b.glow.opacity = 0.15 + pulse * 0.5;
      });
    }

    if (lunarMaterials) {
      lunarMaterials.route.opacity = 0.55 + Math.sin(t * 2.6) * 0.18;
      lunarMaterials.waypoint.opacity = 0.35 + Math.sin(t * 3.1) * 0.2;
    }

    lunarRenderer.render(lunarScene, lunarCamera);
  }
  animate();

  if (!lunarResizeBound) {
    lunarResizeBound = true;
    window.addEventListener('resize', function () {
      var host = document.getElementById('lunarScene');
      if (!host || !lunarRenderer || !lunarCamera) return;
      var w = Math.max(1, host.clientWidth);
      var h = Math.max(1, host.clientHeight);
      lunarRenderer.setSize(w, h);
      lunarCamera.aspect = w / h;
      lunarCamera.updateProjectionMatrix();
      lunarCameraFit();
    });
  }
}

function lunarCellPos(c, r, cols, rows) {
  var scale = 1.25;
  return {
    x: (c - (cols - 1) / 2) * scale,
    z: (r - (rows - 1) / 2) * scale
  };
}

function lunarBuildRoute(routePoints) {
  if (routePoints.length < 2) return;
  var curve = new THREE.CatmullRomCurve3(routePoints, false, 'catmullrom', 0.1);
  var tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.min(320, routePoints.length * 8), 0.035, 6, false),
    lunarMaterials.route
  );
  lunarGridGroup.add(tube);
  routePoints.forEach(function (p) {
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.014, 6, 20), lunarMaterials.waypoint);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(p.x, 0.055, p.z);
    lunarGridGroup.add(ring);
  });
}

function setLunarGrid(opts) {
  if (!lunarScene) initLunarScene();
  if (!lunarScene) return;
  var o = opts || {};
  var cols = o.cols || 16;
  var rows = o.rows || 11;
  lunarGridSize.cols = cols;
  lunarGridSize.rows = rows;
  if (lunarFx && lunarFx.gridBlinkers && lunarFx.gridBlinkers.length) {
    var drop = new Set(lunarFx.gridBlinkers);
    lunarFx.blinkers = lunarFx.blinkers.filter(function (b) { return !drop.has(b); });
    lunarFx.gridBlinkers = [];
  }
  if (lunarGridGroup) lunarDisposeGroup(lunarGridGroup);

  var group = new THREE.Group();
  lunarGridGroup = group;
  lunarScene.add(group);

  var scale = 1.25;
  var halfW = ((cols - 1) * scale) / 2;
  var halfH = ((rows - 1) * scale) / 2;

  var points = [];
  for (var c = 0; c < cols; c++) {
    var gx = (c - (cols - 1) / 2) * scale;
    points.push(new THREE.Vector3(gx, 0.03, -halfH), new THREE.Vector3(gx, 0.03, halfH));
  }
  for (var rr = 0; rr < rows; rr++) {
    var gz = (rr - (rows - 1) / 2) * scale;
    points.push(new THREE.Vector3(-halfW, 0.03, gz), new THREE.Vector3(halfW, 0.03, gz));
  }
  var gridGeo = new THREE.BufferGeometry().setFromPoints(points);
  group.add(new THREE.LineSegments(gridGeo, lunarMaterials.grid));

  var edgeGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-halfW, 0.04, -halfH), new THREE.Vector3(halfW, 0.04, -halfH),
    new THREE.Vector3(halfW, 0.04, -halfH), new THREE.Vector3(halfW, 0.04, halfH),
    new THREE.Vector3(halfW, 0.04, halfH), new THREE.Vector3(-halfW, 0.04, halfH),
    new THREE.Vector3(-halfW, 0.04, halfH), new THREE.Vector3(-halfW, 0.04, -halfH)
  ]);
  group.add(new THREE.LineSegments(edgeGeo, lunarMaterials.gridEdge));

  var rnd = lunarRand(991);
  (o.obstacles || []).forEach(function (p) {
    var pos = lunarCellPos(p[0], p[1], cols, rows);
    var cluster = new THREE.Group();
    cluster.position.set(pos.x, 0, pos.z);
    var count = 2 + Math.floor(rnd() * 2);
    for (var i = 0; i < count; i++) {
      var size = 0.2 + rnd() * 0.26;
      var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), lunarMaterials.rockObstacle);
      rock.position.set((rnd() - 0.5) * 0.55, size * 0.7, (rnd() - 0.5) * 0.55);
      rock.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
      rock.scale.y = 0.7 + rnd() * 0.5;
      rock.castShadow = true;
      rock.receiveShadow = true;
      cluster.add(rock);
    }
    group.add(cluster);
  });

  var base = o.base || [1, 8];
  var basePos = lunarCellPos(base[0], base[1], cols, rows);
  var pad = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.56, 0.06, 28), lunarMaterials.pad);
  pad.position.set(basePos.x, 0.055, basePos.z);
  pad.receiveShadow = true;
  group.add(pad);

  var padRing = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.016, 8, 36), lunarMaterials.padRing);
  padRing.rotation.x = Math.PI / 2;
  padRing.position.set(basePos.x, 0.09, basePos.z);
  group.add(padRing);

  var crossA = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.012, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x78e6ff, transparent: true, opacity: 0.75 })
  );
  crossA.position.set(basePos.x, 0.095, basePos.z);
  group.add(crossA);
  var crossB = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.012, 0.34),
    new THREE.MeshBasicMaterial({ color: 0x78e6ff, transparent: true, opacity: 0.75 })
  );
  crossB.position.set(basePos.x, 0.095, basePos.z);
  group.add(crossB);

  for (var k = 0; k < 4; k++) {
    var ang = (k / 4) * Math.PI * 2 + Math.PI / 4;
    var mark = lunarAddBlinker(
      group,
      0x22d3ee,
      0.02,
      new THREE.Vector3(basePos.x + Math.cos(ang) * 0.5, 0.1, basePos.z + Math.sin(ang) * 0.5),
      k * 0.8,
      1.9
    );
    if (mark) lunarFx.gridBlinkers.push(mark);
  }

  if (Array.isArray(o.route) && o.route.length > 1) {
    var routePoints = o.route.map(function (p) {
      var pos = lunarCellPos(p[0], p[1], cols, rows);
      return new THREE.Vector3(pos.x, 0.1, pos.z);
    });
    lunarBuildRoute(routePoints);
  }

  var astro = o.astro || [13, 2];
  var astroPos = lunarCellPos(astro[0], astro[1], cols, rows);
  placeAstronaut(astroPos.x, astroPos.z);
  moveRover(basePos.x, basePos.z);
}

function placeAstronaut(x, z) {
  if (!astronautModel) return;
  astronautModel.position.x = x;
  astronautModel.position.z = z;
}

function updateAstronautState(state) {
  lunarAstro.collapsed = state === 'COLLAPSED';
}

function moveRover(x, z) {
  if (!roverModel) return;
  lunarRover.targetX = x;
  lunarRover.targetZ = z;
  if (!lunarRover.initialized) {
    lunarRover.initialized = true;
    lunarRover.x = x;
    lunarRover.z = z;
    roverModel.position.set(x, 0, z);
  }
}

function toggleLunarScene(active) {
  if (active) {
    if (!lunarScene || !lunarRenderer) initLunarScene();
    else {
      lunarIsActive = true;
      lunarRenderer.domElement.style.display = 'block';
    }
  } else {
    lunarIsActive = false;
    if (lunarRenderer && lunarRenderer.domElement) lunarRenderer.domElement.style.display = 'none';
  }
}

window.initLunarScene = initLunarScene;
window.toggleLunarScene = toggleLunarScene;
window.updateAstronautState = updateAstronautState;
window.moveRover = moveRover;
window.placeAstronaut = placeAstronaut;
window.setLunarGrid = setLunarGrid;
